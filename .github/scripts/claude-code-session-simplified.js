#!/usr/bin/env node

/**
 * Simplified Claude Code Integration Session Manager
 * Consolidated and cleaned up version with reduced complexity
 */

const Anthropic = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const { PromptRoleManager } = require('./lib/PromptRoleManager');
const { ExpertEvaluationIntegration } = require('./lib/ExpertEvaluationIntegration');
const { StructuredSystemPrompt } = require('./lib/StructuredSystemPrompt');

class ClaudeCodeSession {
  constructor() {
    this.sessionId = `session-${Date.now()}`;
    this.startTime = Date.now();
    
    // Parse repository info once
    const [repoOwner, repoName] = (process.env.GITHUB_REPOSITORY || '/').split('/');
    this.repoOwner = repoOwner || 'unknown';
    this.repoName = repoName || 'unknown';
    
    // Simple logging
    this.log = (level, message, data = {}) => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        sessionId: this.sessionId,
        ...data
      }));
    };
    
    // Basic metrics
    this.metrics = {
      toolCalls: 0,
      errors: 0
    };

    // Initialize role manager
    this.roleManager = null;
    this.currentRole = null;
    this.expertIntegration = null;
    this.promptBuilder = new StructuredSystemPrompt();
  }

  /**
   * Main entry point
   */
  async run() {
    try {
      this.log('info', '🚀 Starting Claude Code session');
      
      // Validate environment
      this.validateEnvironment();
      
      // Parse command from comment
      const command = this.parseCommand();
      
      // Build context
      const context = this.buildContext();
      
      // Initialize clients
      const { anthropic, octokit } = this.initializeClients();
      
      // Initialize role manager
      this.roleManager = new PromptRoleManager({
        octokit,
        repoOwner: this.repoOwner,
        repoName: this.repoName,
        workspace: context.workspace
      });

      // Initialize expert evaluation integration
      this.expertIntegration = new ExpertEvaluationIntegration({
        octokit,
        anthropic,
        repoOwner: this.repoOwner,
        repoName: this.repoName,
        workspace: context.workspace
      });

      // Load role if specified
      if (command.role) {
        this.currentRole = await this.roleManager.loadRole(command.role);
        this.log('info', `Loaded role: ${this.currentRole.name}`, {
          role: command.role,
          source: this.currentRole.source
        });
      }
      
      // Process request with Claude
      const result = await this.processRequest(command, context, anthropic, octokit);
      
      // Post results
      await this.postResults(context, result, octokit);
      
      this.log('info', '✅ Session completed', {
        duration: Date.now() - this.startTime,
        toolCalls: this.metrics.toolCalls,
        errors: this.metrics.errors
      });
      
      process.exit(0);
    } catch (error) {
      await this.handleError(error);
      process.exit(1);
    }
  }

  /**
   * Validate required environment variables
   */
  validateEnvironment() {
    const required = ['GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GITHUB_REPOSITORY', 'COMMENT_BODY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Parse command from comment body
   */
  parseCommand() {
    const comment = process.env.COMMENT_BODY || '';
    
    // Enhanced command parsing to support role-based execution
    let match = comment.match(/@claude-code\s+--role=(\S+)\s+(.+)/i);
    if (match) {
      return {
        role: match[1],
        prompt: match[2].trim(),
        raw: comment,
        mode: 'role'
      };
    }

    // Check for prompt-expert commands
    match = comment.match(/@prompt-expert\s+(\S+)\s*(.*)/i);
    if (match) {
      return {
        role: match[1], // Domain expert
        prompt: match[2].trim() || 'Please evaluate the prompt changes in this PR',
        raw: comment,
        mode: 'expert'
      };
    }

    // Standard claude-code command
    match = comment.match(/@claude-code\s+(.+)/i);
    if (match) {
      return {
        prompt: match[1].trim(),
        raw: comment,
        mode: 'standard'
      };
    }
    
    throw new Error('Invalid command format. Use: @claude-code <request>, @claude-code --role=<role> <request>, or @prompt-expert <domain> <request>');
  }

  /**
   * Build context from environment
   */
  buildContext() {
    const context = {
      repository: process.env.GITHUB_REPOSITORY,
      repoOwner: this.repoOwner,
      repoName: this.repoName,
      actor: process.env.GITHUB_ACTOR,
      runId: process.env.GITHUB_RUN_ID,
      workspace: process.env.GITHUB_WORKSPACE || process.cwd()
    };
    
    // Add PR context if available
    if (process.env.PR_NUMBER) {
      context.pr = {
        number: parseInt(process.env.PR_NUMBER),
        action: process.env.GITHUB_EVENT_NAME
      };
    }
    
    // Add issue context if available
    if (process.env.ISSUE_NUMBER) {
      context.issue = {
        number: parseInt(process.env.ISSUE_NUMBER),
        action: process.env.GITHUB_EVENT_NAME
      };
    }
    
    return context;
  }

  /**
   * Initialize API clients
   */
  initializeClients() {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 3,
      timeout: 60000
    });
    
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      retry: { enabled: true, retries: 3 }
    });
    
    return { anthropic, octokit };
  }

  /**
   * Process request with Claude
   */
  async processRequest(command, context, anthropic, octokit) {
    // Define available tools
    const tools = this.getTools(context);
    
    // Prepare initial message with role-aware system prompt
    const systemMessage = this.buildSystemMessage(context, command);
    const userMessage = this.buildUserMessage(command, context);
    
    // Start conversation
    let messages = [
      { role: 'user', content: `${systemMessage}\n\n${userMessage}` }
    ];
    
    let iterations = 0;
    const maxIterations = 10;
    const results = {
      response: '',
      toolCalls: []
    };
    
    while (iterations < maxIterations) {
      iterations++;
      
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: messages,
        tools: tools,
        tool_choice: { type: 'auto' }
      });
      
      // Check for tool use
      const toolUses = response.content.filter(c => c.type === 'tool_use');
      
      if (toolUses.length === 0) {
        // No tools, get final response
        const textContent = response.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        
        results.response = textContent;
        break;
      }
      
      // Execute tools
      const toolResults = await this.executeTools(toolUses, context, octokit);
      results.toolCalls.push(...toolResults);
      
      // Add to conversation
      messages.push({
        role: 'assistant',
        content: response.content
      });
      
      messages.push({
        role: 'user',
        content: toolResults.map(tr => ({
          type: 'tool_result',
          tool_use_id: tr.id,
          content: JSON.stringify(tr.result)
        }))
      });
      
      // Limit message history to prevent token overflow
      if (messages.length > 20) {
        // Keep first message and last 15
        messages = [messages[0], ...messages.slice(-15)];
      }
    }
    
    return results;
  }

  /**
   * Execute tool calls
   */
  async executeTools(toolUses, context, octokit) {
    const results = [];
    
    for (const tool of toolUses) {
      this.metrics.toolCalls++;
      
      try {
        let result;
        
        // Check if it's an expert evaluation tool
        const evaluationTools = ['evaluate_prompt_changes', 'get_prompt_history', 'compare_prompt_versions', 'get_expert_feedback'];
        
        if (evaluationTools.includes(tool.name)) {
          result = await this.expertIntegration.executeEvaluationTool(tool.name, tool.input, context);
        } else {
          // Standard tools
          switch (tool.name) {
            case 'get_file':
              result = await this.getFile(tool.input, context);
              break;
            case 'update_file':
              result = await this.updateFile(tool.input, context);
              break;
            case 'list_files':
              result = await this.listFiles(tool.input, context);
              break;
            case 'run_command':
              result = await this.runCommand(tool.input, context);
              break;
            case 'github_api':
              result = await this.githubApi(tool.input, octokit);
              break;
            default:
              result = { error: `Unknown tool: ${tool.name}` };
          }
        }
        
        results.push({
          id: tool.id,
          name: tool.name,
          result
        });
      } catch (error) {
        this.metrics.errors++;
        results.push({
          id: tool.id,
          name: tool.name,
          result: { error: error.message }
        });
      }
    }
    
    return results;
  }

  /**
   * Tool: Get file contents
   */
  async getFile(args, context) {
    // Validate path doesn't escape workspace
    const normalizedPath = path.normalize(args.path);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }
    
    const filePath = path.join(context.workspace, normalizedPath);
    const content = await fs.readFile(filePath, 'utf8');
    return { content };
  }

  /**
   * Tool: Update file
   */
  async updateFile(args, context) {
    // Validate path doesn't escape workspace
    const normalizedPath = path.normalize(args.path);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }
    
    const filePath = path.join(context.workspace, normalizedPath);
    await fs.writeFile(filePath, args.content, 'utf8');
    return { success: true, path: args.path };
  }

  /**
   * Tool: List files
   */
  async listFiles(args, context) {
    // Validate path doesn't escape workspace
    const normalizedPath = path.normalize(args.path || '');
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }
    
    const dirPath = path.join(context.workspace, normalizedPath);
    const files = await fs.readdir(dirPath);
    return { files };
  }

  /**
   * Tool: Run command
   */
  async runCommand(args, context) {
    // Allow safe commands including gh and git for analysis
    const allowedCommands = ['ls', 'pwd', 'echo', 'cat', 'grep', 'find', 'gh', 'git'];
    
    // Extract command more safely
    const cmdMatch = args.command.match(/^(\S+)/);
    if (!cmdMatch) {
      return { error: 'Invalid command format' };
    }
    
    const cmd = cmdMatch[1];
    if (!allowedCommands.includes(cmd)) {
      return { error: `Command not allowed: ${cmd}` };
    }
    
    // Parse arguments safely
    const parts = args.command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const command = parts[0];
    const commandArgs = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));
    
    try {
      const { stdout, stderr } = await execFileAsync(command, commandArgs, {
        cwd: context.workspace,
        timeout: 30000
      });
      return { stdout, stderr };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Tool: GitHub API call
   */
  async githubApi(args, octokit) {
    const { method = 'GET', endpoint, data } = args;
    
    const response = await octokit.request(`${method} ${endpoint}`, data);
    return response.data;
  }

  /**
   * Get tool definitions
   */
  getTools(context) {
    // Start with standard tools
    const standardTools = [
      {
        name: 'get_file',
        description: 'Read file contents',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to workspace' }
          },
          required: ['path']
        }
      },
      {
        name: 'update_file',
        description: 'Write file contents. Update existing files.',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to workspace' },
            content: { type: 'string', description: 'File content' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_files',
        description: 'List files in a directory',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path relative to workspace' }
          }
        }
      },
      {
        name: 'run_command',
        description: 'Run shell commands for repository analysis. IMPORTANT for PR analysis: Use "gh pr diff <number>" to see PR changes. Use "gh pr view <number>" for PR details. IMPORTANT for Issue analysis: Use "gh issue view <number>" for issue details. Use "git log" for commit history. Use "git diff" for uncommitted changes.',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to run. Examples: "gh pr diff 19" for PR changes. "gh issue view 21" for issue details. "git log --oneline -10" for commit history.' }
          },
          required: ['command']
        }
      },
      {
        name: 'github_api',
        description: 'Make GitHub API calls for detailed information. Key endpoints: /repos/{owner}/{repo}/pulls/{pr}/files for PR file changes. /repos/{owner}/{repo}/pulls/{pr}/commits for PR commits. /repos/{owner}/{repo}/issues/{issue}/comments for issue comments. /repos/{owner}/{repo}/pulls/{pr} for PR details.',
        input_schema: {
          type: 'object',
          properties: {
            method: { type: 'string', description: 'HTTP method (default: GET)' },
            endpoint: { type: 'string', description: 'API endpoint path. Example: /repos/whichguy/prompt-expert-bank/pulls/19/files' },
            data: { type: 'object', description: 'Request data for POST. Request data for PATCH.' }
          },
          required: ['endpoint']
        }
      }
    ];

    // Add expert evaluation tools if integration is available
    if (this.expertIntegration) {
      const evaluationTools = this.expertIntegration.getEvaluationTools();
      return [...standardTools, ...evaluationTools];
    }

    return standardTools;
  }

  /**
   * Build system message (action-oriented v3.0)
   */
  buildSystemMessage(context, command) {
    // If we have a specific role, blend it with structured prompt
    if (this.currentRole) {
      // Get role-based system message
      const roleMessage = this.roleManager.buildRoleSystemMessage(this.currentRole, context);
      // Get concise structured prompt for efficiency
      const structuredBase = this.promptBuilder.buildConcisePrompt(context, command);
      // Combine role specifics with action-oriented instructions
      return `${roleMessage}\n\n${structuredBase}`;
    }

    // Use concise action-oriented prompt for maximum efficiency
    return this.promptBuilder.buildConcisePrompt(context, command);
  }

  /**
   * Build user message (mode-aware)
   */
  buildUserMessage(command, context) {
    if (command.mode === 'expert') {
      // Expert evaluation mode - integrate with existing evaluation system
      return `As a ${command.role} expert, please evaluate the prompt changes in this PR and provide feedback. 

${command.prompt}

Focus on:
1. Domain-specific best practices
2. Technical accuracy and completeness
3. Potential improvements or issues
4. Overall quality assessment

Use your expert tools to examine the changed files and provide detailed analysis.`;
    }

    return command.prompt;
  }

  /**
   * Post results back to GitHub
   */
  async postResults(context, result, octokit) {
    // Build response with minimal stats footer
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    
    // Build minimal stats line
    const tools = result.toolCalls.length > 0 
      ? `tools: ${result.toolCalls.map(t => t.name).join(', ')} | ` 
      : '';
    const errors = this.metrics.errors > 0 
      ? `errors: ${this.metrics.errors} | ` 
      : '';
    
    const body = `${result.response}

---
<sub>${tools}${errors}${duration}s | session: ${this.sessionId.split('-').pop()}</sub>`;

    if (context.pr) {
      await octokit.issues.createComment({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: context.pr.number,
        body
      });
    } else if (context.issue) {
      await octokit.issues.createComment({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: context.issue.number,
        body
      });
    }
  }

  /**
   * Handle errors
   */
  async handleError(error) {
    this.log('error', 'Session failed', {
      error: error.message,
      stack: error.stack
    });
    
    // Try to post error message
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const body = `## ❌ Claude Code Error

${error.message}

Please check the workflow logs for details.`;

      const issueNumber = parseInt(process.env.PR_NUMBER || process.env.ISSUE_NUMBER);
      if (issueNumber) {
        await octokit.issues.createComment({
          owner: this.repoOwner,
          repo: this.repoName,
          issue_number: issueNumber,
          body
        });
      }
    } catch (e) {
      this.log('error', 'Failed to post error', { error: e.message });
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const session = new ClaudeCodeSession();
  session.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ClaudeCodeSession;