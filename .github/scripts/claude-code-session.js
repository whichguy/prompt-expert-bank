#!/usr/bin/env node

/**
 * Claude Code Integration Session Manager
 * Main entry point for handling @prompt-expert commands in GitHub Issues/PRs
 */

const Anthropic = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const ClaudeToolExecutor = require('./lib/ClaudeToolExecutor');
const { StructuredLogger } = require('./lib/StructuredLogger');
const { CommandParser } = require('./lib/CommandParser');
const { ContextBuilder } = require('./lib/ContextBuilder');
const { getToolsForContext, formatToolsForClaude } = require('./lib/ToolDefinitions');

async function main() {
  const logger = new StructuredLogger({
    pr: process.env.PR_NUMBER,
    issue: process.env.ISSUE_NUMBER,
    repository: process.env.GITHUB_REPOSITORY
  });

  try {
    logger.log('info', 'Starting Claude Code session');

    // Parse command from comment
    const parser = new CommandParser();
    const command = parser.parse(process.env.COMMENT_BODY);
    
    if (!command) {
      logger.log('error', 'Failed to parse command from comment');
      process.exit(1);
    }

    logger.log('info', 'Parsed command', { command });

    // Initialize clients
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Build context
    const contextBuilder = new ContextBuilder(octokit, logger);
    const context = await contextBuilder.buildContext({
      repository: `${process.env.GITHUB_REPOSITORY_OWNER}/${process.env.GITHUB_REPOSITORY_NAME || process.env.GITHUB_REPOSITORY.split('/')[1]}`,
      prNumber: process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER) : null,
      issueNumber: process.env.ISSUE_NUMBER ? parseInt(process.env.ISSUE_NUMBER) : null,
      comment: process.env.COMMENT_BODY,
      actor: process.env.GITHUB_ACTOR
    });

    // Add command to context
    context.command = command;
    
    logger.log('info', 'Context built successfully', {
      contextType: context.pr ? 'PR' : context.issue ? 'Issue' : 'Unknown',
      repository: context.repository?.fullName
    });

    // Initialize tool executor
    const executor = new ClaudeToolExecutor(octokit, context, anthropic, logger);

    // Get tools for context and format for Claude
    const tools = getToolsForContext(context.type);
    const formattedTools = formatToolsForClaude(tools);

    // Prepare initial message for Claude
    const initialMessage = prepareInitialMessage(context, command, tools);

    logger.log('info', 'Sending initial message to Claude', { 
      toolCount: tools.length 
    });

    // Create Claude conversation
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: initialMessage
        }
      ],
      tools: formattedTools,
      tool_choice: { type: 'auto' }
    });

    logger.log('info', 'Received response from Claude');

    // Process Claude's response and tool calls
    await processClaudeResponse(response, executor, anthropic, context, logger, formattedTools);

    // Generate summary report
    const summary = logger.generateSummaryReport();
    logger.log('info', 'Session completed successfully', { summary });

    // Post summary to PR/Issue
    await postSessionSummary(octokit, context, summary);

  } catch (error) {
    logger.log('error', 'Session failed', {
      error: error.message,
      stack: error.stack,
      critical: true
    });
    process.exit(1);
  }
}

function prepareInitialMessage(context, command, tools) {
  const toolList = tools.map(t => `- **${t.name}**: ${t.description}`).join('\n');
  
  return `
# Claude Code Integration Session

You are Claude Code, integrated into a GitHub Actions workflow for the prompt-expert system. You have been invoked to help with a ${context.pr ? 'pull request' : 'issue'}.

## Your Capabilities

You have access to the following tools:
${toolList}

## Current Context

${context.pr ? `
### Pull Request Information
- PR #${context.pr.number}: ${context.pr.title}
- Author: ${context.pr.author}
- Branch: ${context.pr.branch.head} → ${context.pr.branch.base}
- Files Changed: ${context.files?.total || 0}
- Status: ${context.pr.status.state}
` : ''}

${context.issue ? `
### Issue Information
- Issue #${context.issue.number}: ${context.issue.title}
- Author: ${context.issue.author}
- State: ${context.issue.state}
- Labels: ${context.issue.labels?.join(', ') || 'None'}
` : ''}

### Repository
- Repository: ${context.repository.fullName}
- Default Branch: ${context.repository.defaultBranch}
- Visibility: ${context.repository.visibility}

### Workflow Execution
- Triggered by: ${context.workflow.triggeredBy}
- Actor: ${context.workflow.actor}
- Run: #${context.workflow.runNumber}

## User Request

Expert: ${command.expert}
Options: ${JSON.stringify(command.options)}
Prompt: ${command.prompt}

## Your Task

Analyze the context and user request, then use the available tools to accomplish the requested task. Be proactive but careful, and always explain your actions.

Important Guidelines:
1. Always use tools to perform actions - don't just describe what should be done
2. Request approval for destructive operations
3. Maintain code quality - run tests and linting after modifications
4. Be explicit about actions - clearly state what you're doing and why
5. Handle errors gracefully - provide fallback options if operations fail
6. Respect security boundaries - don't expose secrets or sensitive data
`;
}

async function processClaudeResponse(response, executor, anthropic, context, logger, tools) {
  const maxIterations = 10;
  let iteration = 0;
  let currentResponse = response;
  const messages = [
    {
      role: 'user',
      content: prepareInitialMessage(context, context.command || { expert: 'programming', options: {}, prompt: 'Analyze the request' }, tools)
    }
  ];

  while (iteration < maxIterations) {
    iteration++;
    logger.log('debug', `Processing response iteration ${iteration}`);

    // Check if Claude wants to use tools
    const toolUses = currentResponse.content.filter(c => c.type === 'tool_use');
    
    if (toolUses.length === 0) {
      // No tool use, just text response
      const textContent = currentResponse.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      if (textContent) {
        await postComment(executor.octokit, context, textContent);
      }
      break;
    }

    // Execute tool calls
    const toolResults = [];
    for (const toolUse of toolUses) {
      logger.log('info', `Executing tool: ${toolUse.name}`, { args: toolUse.input });
      
      try {
        const result = await executor.executeTool({
          name: toolUse.name,
          arguments: toolUse.input
        });
        
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      } catch (error) {
        logger.log('error', `Tool execution failed: ${toolUse.name}`, {
          error: error.message
        });
        
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: false,
            error: error.message
          })
        });
      }
    }

    // Build conversation history
    messages.push({
      role: 'assistant',
      content: currentResponse.content
    });
    
    messages.push({
      role: 'user',
      content: toolResults
    });

    // Send tool results back to Claude
    if (toolResults.length > 0) {
      currentResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: messages,
        tools: tools,
        tool_choice: { type: 'auto' }
      });
    } else {
      break;
    }
  }

  if (iteration >= maxIterations) {
    logger.log('warn', 'Max iterations reached, stopping processing');
  }
}

async function postComment(octokit, context, text) {
  const body = `🤖 **Claude Code Response**\n\n${text}`;
  
  if (context.pr) {
    await octokit.issues.createComment({
      owner: context.repository.owner,
      repo: context.repository.name,
      issue_number: context.pr.number,
      body
    });
  } else if (context.issue) {
    await octokit.issues.createComment({
      owner: context.repository.owner,
      repo: context.repository.name,
      issue_number: context.issue.number,
      body
    });
  }
}

async function postSessionSummary(octokit, context, summary) {
  const body = `
## 📊 Claude Code Session Summary

**Session ID**: ${summary.correlationId}
**Duration**: ${summary.duration}ms
**Tools Executed**: ${summary.toolsExecuted}

### Metrics
- **Errors**: ${summary.errors.length}
- **Warnings**: ${summary.warnings.length}
- **Success Rate**: ${((summary.toolsExecuted - summary.errors.length) / summary.toolsExecuted * 100).toFixed(1)}%

${summary.errors.length > 0 ? `
### ⚠️ Errors Encountered
${summary.errors.map(e => `- ${e.message}`).join('\n')}
` : ''}

---
*Generated by Claude Code Integration System*
`;

  if (context.pr) {
    await octokit.issues.createComment({
      owner: context.repository.owner,
      repo: context.repository.name,
      issue_number: context.pr.number,
      body
    });
  } else if (context.issue) {
    await octokit.issues.createComment({
      owner: context.repository.owner,
      repo: context.repository.name,
      issue_number: context.issue.number,
      body
    });
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, prepareInitialMessage, processClaudeResponse };