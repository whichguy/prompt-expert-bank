#!/usr/bin/env node

/**
 * Optimized Claude Code Integration Session Manager
 * Production-ready with comprehensive logging, error recovery, and performance monitoring
 */

const Anthropic = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const ClaudeToolExecutorOptimized = require('./lib/ClaudeToolExecutorOptimized');
const { StructuredLogger } = require('./lib/StructuredLogger');
const { CommandParser } = require('./lib/CommandParser');
const { ContextBuilder } = require('./lib/ContextBuilder');
const { getToolsForContext, formatToolsForClaude } = require('./lib/ToolDefinitions');
const { PerformanceMonitor } = require('./lib/PerformanceMonitor');
const { ErrorRecoveryEnhanced } = require('./lib/ErrorRecoveryEnhanced');
const { RepositoryCache } = require('./lib/RepositoryCache');
const { GitHubCLIAdapter } = require('./lib/GitHubCLIAdapter');

class ClaudeCodeSessionOptimized {
  constructor() {
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    
    // FIX: Parse repository owner and name once
    const [repoOwner, repoName] = (process.env.GITHUB_REPOSITORY || '/').split('/');
    this.repoOwner = repoOwner || 'unknown';
    this.repoName = repoName || 'unknown';
    
    // Initialize components
    this.logger = new StructuredLogger({
      correlationId: this.sessionId,
      pr: process.env.PR_NUMBER,
      issue: process.env.ISSUE_NUMBER,
      repository: process.env.GITHUB_REPOSITORY
    });
    
    this.performanceMonitor = new PerformanceMonitor({
      sessionId: this.sessionId,
      logger: this.logger
    });
    
    this.errorRecovery = new ErrorRecoveryEnhanced({
      logger: this.logger
    });
    
    this.cache = new RepositoryCache({
      logger: this.logger
    });
    
    this.ghCli = new GitHubCLIAdapter(this.logger);
  }

  /**
   * Main entry point
   */
  async run() {
    const mainOpId = this.performanceMonitor.startOperation('main_session');
    
    try {
      this.logger.log('info', '🚀 Starting Optimized Claude Code session', {
        sessionId: this.sessionId,
        nodeVersion: process.version,
        platform: process.platform
      });
      
      // Initialize all components
      await this.initialize();
      
      // Parse command
      const command = await this.parseCommand();
      if (!command) {
        throw new Error('Failed to parse command from comment');
      }
      
      // Build context
      const context = await this.buildContext(command);
      
      // Initialize Claude and executor
      const { anthropic, executor } = await this.initializeClaudeComponents(context);
      
      // Process the request
      const result = await this.processRequest(command, context, anthropic, executor);
      
      // Generate and post reports (FIX: Pass executor separately)
      await this.generateReports(context, result, executor);
      
      this.performanceMonitor.endOperation(mainOpId, { success: true });
      
      // Success reaction
      await this.updateReaction('rocket');
      
      this.logger.log('info', '✅ Session completed successfully', {
        sessionId: this.sessionId,
        duration: Date.now() - this.startTime
      });
      
      process.exit(0);
    } catch (error) {
      this.performanceMonitor.endOperation(mainOpId, { success: false });
      this.performanceMonitor.trackError(error, { phase: 'main' });
      
      await this.handleFatalError(error);
      process.exit(1);
    }
  }

  /**
   * Initialize all components with error handling
   */
  async initialize() {
    const initOpId = this.performanceMonitor.startOperation('initialization');
    
    try {
      this.logger.log('info', '🔧 Initializing components...');
      
      // Add initial reaction
      await this.updateReaction('eyes');
      
      // Initialize cache
      const cacheInit = await this.cache.init();
      if (!cacheInit) {
        this.logger.log('warn', 'Cache initialization failed, continuing without cache');
      }
      
      // Verify GitHub CLI
      try {
        await this.ghCli.verify();
        this.useGitHubCLI = true;
        this.logger.log('info', '✅ GitHub CLI verified');
      } catch (error) {
        this.logger.log('warn', 'GitHub CLI not available, using Octokit', {
          error: error.message
        });
        this.useGitHubCLI = false;
      }
      
      // Check environment variables
      this.validateEnvironment();
      
      this.performanceMonitor.endOperation(initOpId, { success: true });
      this.performanceMonitor.checkpoint('initialization_complete');
      
    } catch (error) {
      this.performanceMonitor.endOperation(initOpId, { success: false });
      throw error;
    }
  }

  /**
   * Validate required environment variables
   */
  validateEnvironment() {
    const required = [
      'GITHUB_TOKEN',
      'ANTHROPIC_API_KEY',
      'GITHUB_REPOSITORY',
      'COMMENT_BODY'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Validate optional but recommended variables
    const recommended = [
      'GITHUB_ACTIONS',
      'GITHUB_WORKSPACE',
      'GITHUB_RUN_ID'
    ];
    
    const missingRecommended = recommended.filter(key => !process.env[key]);
    if (missingRecommended.length > 0) {
      this.logger.log('warn', 'Missing recommended environment variables', {
        missing: missingRecommended
      });
    }
  }

  /**
   * Parse command from comment with validation
   */
  async parseCommand() {
    const parseOpId = this.performanceMonitor.startOperation('parse_command');
    
    try {
      const parser = new CommandParser();
      const command = parser.parse(process.env.COMMENT_BODY);
      
      if (!command) {
        throw new Error('Invalid command format');
      }
      
      // Validate command
      if (!command.expert) {
        throw new Error('Expert not specified in command');
      }
      
      if (!command.prompt || command.prompt.trim().length === 0) {
        throw new Error('Prompt is empty');
      }
      
      this.logger.log('info', '📝 Command parsed successfully', {
        expert: command.expert,
        options: Object.keys(command.options),
        promptLength: command.prompt.length
      });
      
      this.performanceMonitor.endOperation(parseOpId, { success: true });
      return command;
      
    } catch (error) {
      this.performanceMonitor.endOperation(parseOpId, { success: false });
      this.logger.log('error', 'Failed to parse command', {
        error: error.message,
        comment: process.env.COMMENT_BODY?.substring(0, 200)
      });
      throw error;
    }
  }

  /**
   * Build comprehensive context with caching
   */
  async buildContext(command) {
    const contextOpId = this.performanceMonitor.startOperation('build_context');
    
    try {
      // FIX: Parse numbers consistently for cache key
      const cacheKey = this.cache.getCacheKey({
        repository: process.env.GITHUB_REPOSITORY,
        pr: process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER) : null,
        issue: process.env.ISSUE_NUMBER ? parseInt(process.env.ISSUE_NUMBER) : null
      });
      
      // FIX: Pass proper context object instead of just cacheKey
      let context = await this.cache.getCachedContextData({
        repository: process.env.GITHUB_REPOSITORY,
        pr: process.env.PR_NUMBER ? { number: process.env.PR_NUMBER } : null,
        issue: process.env.ISSUE_NUMBER ? { number: process.env.ISSUE_NUMBER } : null
      });
      
      if (context && Date.now() - context.timestamp < 300000) { // 5 minutes
        this.logger.log('info', '📦 Using cached context', {
          age: Date.now() - context.timestamp
        });
        this.performanceMonitor.trackMetric('cache_hit', 1);
      } else {
        // Build fresh context
        this.logger.log('info', '🔨 Building fresh context');
        
        const octokit = new Octokit({
          auth: process.env.GITHUB_TOKEN
        });
        
        const contextBuilder = new ContextBuilder(octokit, this.logger);
        context = await contextBuilder.buildContext({
          repository: process.env.GITHUB_REPOSITORY,
          prNumber: process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER) : null,
          issueNumber: process.env.ISSUE_NUMBER ? parseInt(process.env.ISSUE_NUMBER) : null,
          comment: process.env.COMMENT_BODY,
          actor: process.env.GITHUB_ACTOR
        });
        
        // Cache the context
        await this.cache.cacheContextData(context);
        this.performanceMonitor.trackMetric('cache_miss', 1);
      }
      
      // Add command to context
      context.command = command;
      context.sessionId = this.sessionId;
      
      this.logger.log('info', '📋 Context ready', {
        type: context.type,
        repository: context.repository?.fullName,
        pr: context.pr?.number,
        issue: context.issue?.number
      });
      
      this.performanceMonitor.endOperation(contextOpId, { success: true });
      this.performanceMonitor.checkpoint('context_ready');
      
      return context;
      
    } catch (error) {
      this.performanceMonitor.endOperation(contextOpId, { success: false });
      
      // Try to recover
      const recovery = await this.errorRecovery.attemptRecovery(error, {
        phase: 'context_building'
      });
      
      if (recovery.success && recovery.retry) {
        this.logger.log('info', 'Retrying context building after recovery');
        return this.buildContext(command);
      }
      
      throw error;
    }
  }

  /**
   * Initialize Claude components with proper error handling
   */
  async initializeClaudeComponents(context) {
    const claudeOpId = this.performanceMonitor.startOperation('initialize_claude');
    
    try {
      // Initialize Octokit (always needed as fallback)
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
        retry: {
          enabled: true,
          retries: 3
        },
        throttle: {
          enabled: true,
          onRateLimit: (retryAfter, options) => {
            this.logger.log('warn', `Rate limit hit, retrying after ${retryAfter}s`);
            return true;
          },
          onSecondaryRateLimit: (retryAfter, options) => {
            this.logger.log('warn', `Secondary rate limit hit, retrying after ${retryAfter}s`);
            return true;
          }
        }
      });
      
      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxRetries: 3,
        timeout: 60000 // 60 seconds
      });
      
      // Initialize optimized executor
      const executor = new ClaudeToolExecutorOptimized(
        octokit,
        context,
        anthropic,
        this.logger
      );
      
      // Initialize executor components
      await executor.initialize();
      
      this.logger.log('info', '🤖 Claude components initialized');
      
      this.performanceMonitor.endOperation(claudeOpId, { success: true });
      
      return { anthropic, executor };
      
    } catch (error) {
      this.performanceMonitor.endOperation(claudeOpId, { success: false });
      throw error;
    }
  }

  /**
   * Process the main request with Claude
   */
  async processRequest(command, context, anthropic, executor) {
    const processOpId = this.performanceMonitor.startOperation('process_request');
    
    try {
      // Get tools for context
      const tools = getToolsForContext(context.type);
      const formattedTools = formatToolsForClaude(tools);
      
      this.logger.log('info', '🛠️ Tools loaded', {
        count: tools.length,
        contextType: context.type
      });
      
      // Prepare initial message
      const initialMessage = this.prepareInitialMessage(context, command, tools);
      
      // Track token usage
      const tokenEstimate = this.estimateTokens(initialMessage);
      this.performanceMonitor.trackMetric('initial_tokens', tokenEstimate);
      
      this.logger.log('info', '📨 Sending request to Claude', {
        model: 'claude-sonnet-4-20250514',
        toolCount: tools.length,
        estimatedTokens: tokenEstimate
      });
      
      // Create conversation with Claude
      const response = await this.executeWithRetry(async () => {
        return anthropic.messages.create({
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
      }, 'claude_api_call');
      
      this.logger.log('info', '📬 Received response from Claude');
      
      // Process Claude's response
      const result = await this.processClaudeResponse(
        response,
        executor,
        anthropic,
        context,
        formattedTools
      );
      
      this.performanceMonitor.endOperation(processOpId, { success: true });
      this.performanceMonitor.checkpoint('request_processed');
      
      return result;
      
    } catch (error) {
      this.performanceMonitor.endOperation(processOpId, { success: false });
      
      // Try to recover from Claude-specific errors
      const recovery = await this.errorRecovery.attemptRecovery(error, {
        phase: 'claude_request',
        operation: 'process_request'
      });
      
      if (recovery.success && recovery.retry) {
        this.logger.log('info', 'Retrying Claude request after recovery');
        return this.processRequest(command, context, anthropic, executor);
      }
      
      throw error;
    }
  }

  /**
   * Process Claude's response with tool execution
   */
  async processClaudeResponse(response, executor, anthropic, context, tools) {
    const responseOpId = this.performanceMonitor.startOperation('process_response');
    
    const maxIterations = 10;
    let iteration = 0;
    let currentResponse = response;
    const messages = [
      {
        role: 'user',
        content: this.prepareInitialMessage(
          context,
          context.command,
          tools
        )
      }
    ];
    
    const results = {
      toolExecutions: [],
      finalResponse: null,
      errors: []
    };
    
    try {
      while (iteration < maxIterations) {
        iteration++;
        
        this.logger.log('debug', `Processing response iteration ${iteration}`);
        this.performanceMonitor.checkpoint(`iteration_${iteration}`);
        
        // Check for tool use
        const toolUses = currentResponse.content.filter(c => c.type === 'tool_use');
        
        if (toolUses.length === 0) {
          // No more tool use, get final text response
          const textContent = currentResponse.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');
          
          if (textContent) {
            results.finalResponse = textContent;
            await this.postComment(context, textContent);
          }
          break;
        }
        
        // Execute tool calls
        const toolResults = await this.executeToolCalls(
          toolUses,
          executor,
          iteration
        );
        
        results.toolExecutions.push(...toolResults);
        
        // Build conversation history
        messages.push({
          role: 'assistant',
          content: currentResponse.content
        });
        
        // FIX: Safe stringify with circular reference handling
        const safeStringify = (obj) => {
          try {
            return JSON.stringify(obj, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (value instanceof Error) {
                  return { error: value.message, stack: value.stack };
                }
              }
              return value;
            });
          } catch (e) {
            return JSON.stringify({ error: 'Failed to serialize', message: e.message });
          }
        };
        
        messages.push({
          role: 'user',
          content: toolResults.map(tr => ({
            type: 'tool_result',
            tool_use_id: tr.tool_use_id,
            content: safeStringify(tr.result)
          }))
        });
        
        // FIX: Prevent unbounded message growth
        if (messages.length > 30) {
          this.logger.log('warn', 'Trimming message history to prevent memory issues');
          messages.splice(1, messages.length - 20); // Keep first and last 20
        }
        
        // Continue conversation if tools were executed
        if (toolResults.length > 0) {
          currentResponse = await this.executeWithRetry(async () => {
            return anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 8000,
              messages: messages,
              tools: tools,
              tool_choice: { type: 'auto' }
            });
          }, `claude_continuation_${iteration}`);
        } else {
          break;
        }
      }
      
      if (iteration >= maxIterations) {
        this.logger.log('warn', 'Max iterations reached, stopping processing');
      }
      
      this.performanceMonitor.endOperation(responseOpId, { success: true });
      
      return results;
      
    } catch (error) {
      this.performanceMonitor.endOperation(responseOpId, { success: false });
      results.errors.push(error);
      throw error;
    }
  }

  /**
   * Execute tool calls with comprehensive error handling
   */
  async executeToolCalls(toolUses, executor, iteration) {
    const results = [];
    
    for (const toolUse of toolUses) {
      const toolOpId = this.performanceMonitor.startOperation(
        `tool_${toolUse.name}`,
        { iteration }
      );
      
      this.logger.log('info', `🔧 Executing tool: ${toolUse.name}`, {
        id: toolUse.id,
        iteration
      });
      
      try {
        const result = await executor.executeTool({
          name: toolUse.name,
          arguments: toolUse.input
        });
        
        results.push({
          tool_use_id: toolUse.id,
          tool_name: toolUse.name,
          success: true,
          result
        });
        
        this.performanceMonitor.endOperation(toolOpId, { success: true });
        
      } catch (error) {
        this.logger.log('error', `Tool execution failed: ${toolUse.name}`, {
          error: error.message,
          iteration
        });
        
        // Try recovery
        const recovery = await this.errorRecovery.attemptRecovery(error, {
          tool: toolUse.name,
          arguments: toolUse.input,
          iteration
        });
        
        if (recovery.success && recovery.retry) {
          // Retry tool execution
          try {
            const result = await executor.executeTool({
              name: toolUse.name,
              arguments: toolUse.input
            });
            
            results.push({
              tool_use_id: toolUse.id,
              tool_name: toolUse.name,
              success: true,
              result,
              recovered: true
            });
            
            this.performanceMonitor.endOperation(toolOpId, {
              success: true,
              recovered: true
            });
          } catch (retryError) {
            results.push({
              tool_use_id: toolUse.id,
              tool_name: toolUse.name,
              success: false,
              result: {
                error: retryError.message
              }
            });
            
            this.performanceMonitor.endOperation(toolOpId, { success: false });
          }
        } else {
          results.push({
            tool_use_id: toolUse.id,
            tool_name: toolUse.name,
            success: false,
            result: {
              error: error.message
            }
          });
          
          this.performanceMonitor.endOperation(toolOpId, { success: false });
        }
      }
    }
    
    return results;
  }

  /**
   * Generate and post performance reports
   */
  // FIX: Accept executor as parameter
  async generateReports(context, result, executor) {
    const reportOpId = this.performanceMonitor.startOperation('generate_reports');
    
    try {
      // Capture final resource snapshot
      this.performanceMonitor.captureResourceSnapshot('session_end');
      
      // Generate performance report
      const perfReport = this.performanceMonitor.generateReport();
      
      // Get cache statistics
      const cacheStats = this.cache.getStats();
      
      // Get error recovery statistics
      const recoveryStats = this.errorRecovery.getStats();
      
      // FIX: Get executor performance correctly - executor is passed separately
      const executorPerf = executor?.getPerformanceReport
        ? await executor.getPerformanceReport()
        : null;
      
      // Combine all reports
      const fullReport = {
        session: {
          id: this.sessionId,
          duration: Date.now() - this.startTime,
          success: !result.errors || result.errors.length === 0
        },
        performance: perfReport,
        cache: cacheStats,
        errorRecovery: recoveryStats,
        executor: executorPerf,
        toolExecutions: result.toolExecutions?.length || 0
      };
      
      // Write to GitHub Actions summary
      await this.performanceMonitor.writeToGitHubSummary(perfReport);
      
      // Post summary comment
      await this.postSessionSummary(context, fullReport);
      
      // Export metrics to file for analysis
      if (process.env.GITHUB_WORKSPACE) {
        const metricsPath = `${process.env.GITHUB_WORKSPACE}/claude-metrics-${this.sessionId}.json`;
        await this.performanceMonitor.exportMetrics(metricsPath);
      }
      
      this.logger.log('info', '📊 Reports generated', {
        performanceScore: perfReport.operations.successRate,
        cacheHitRate: cacheStats.hitRate,
        errorRecoveryRate: recoveryStats.recoveryRate
      });
      
      this.performanceMonitor.endOperation(reportOpId, { success: true });
      
    } catch (error) {
      this.performanceMonitor.endOperation(reportOpId, { success: false });
      this.logger.log('error', 'Failed to generate reports', {
        error: error.message
      });
    }
  }

  /**
   * Post session summary to PR/Issue
   */
  async postSessionSummary(context, report) {
    const summary = this.formatSessionSummary(report);
    
    try {
      if (this.useGitHubCLI) {
        if (context.pr) {
          await this.ghCli.addPRComment(
            context.repository.fullName,
            context.pr.number,
            summary
          );
        } else if (context.issue) {
          await this.ghCli.addIssueComment(
            context.repository.fullName,
            context.issue.number,
            summary
          );
        }
      } else {
        // Fallback to Octokit
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        
        await octokit.issues.createComment({
          owner: context.repository.owner,
          repo: context.repository.name,
          issue_number: context.pr?.number || context.issue?.number,
          body: summary
        });
      }
      
      this.logger.log('info', 'Session summary posted');
    } catch (error) {
      this.logger.log('error', 'Failed to post session summary', {
        error: error.message
      });
    }
  }

  /**
   * Format session summary for posting
   */
  formatSessionSummary(report) {
    const duration = (report.session.duration / 1000).toFixed(2);
    const emoji = report.session.success ? '✅' : '⚠️';
    
    // FIX: Use nullish coalescing for proper 0 handling
    const successRate = report.performance?.operations?.successRate ?? 0;
    const avgDuration = report.performance?.operations?.averageDuration ?? 0;
    const cacheHitRate = report.cache?.hitRate ?? '0%';
    const recoveryRate = report.errorRecovery?.recoveryRate ?? '0%';
    
    return `
## ${emoji} Claude Code Session Summary

**Session ID**: \`${report.session.id}\`
**Duration**: ${duration}s
**Tool Executions**: ${report.toolExecutions}

### Performance Metrics
- **Success Rate**: ${successRate.toFixed(1)}%
- **Average Operation Time**: ${avgDuration.toFixed(0)}ms
- **Cache Hit Rate**: ${cacheHitRate}
- **Error Recovery Rate**: ${recoveryRate}

${report.performance.suggestions.length > 0 ? `
### 💡 Optimization Suggestions
${report.performance.suggestions.map(s => `- ${s.message}`).join('\n')}
` : ''}

${report.errorRecovery.totalErrors > 0 ? `
### 🛡️ Error Recovery
- **Total Errors**: ${report.errorRecovery.totalErrors}
- **Recovered**: ${report.errorRecovery.recoveredErrors}
- **Unrecoverable**: ${report.errorRecovery.unrecoverableErrors}
` : ''}

---
*Optimized Claude Code Integration v2.0*
`;
  }

  /**
   * Post comment to PR/Issue
   */
  async postComment(context, text) {
    const body = `🤖 **Claude Code Response**\n\n${text}`;
    
    try {
      if (this.useGitHubCLI) {
        if (context.pr) {
          await this.ghCli.addPRComment(
            context.repository.fullName,
            context.pr.number,
            body
          );
        } else if (context.issue) {
          await this.ghCli.addIssueComment(
            context.repository.fullName,
            context.issue.number,
            body
          );
        }
      } else {
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        
        await octokit.issues.createComment({
          owner: context.repository.owner,
          repo: context.repository.name,
          issue_number: context.pr?.number || context.issue?.number,
          body
        });
      }
    } catch (error) {
      this.logger.log('error', 'Failed to post comment', {
        error: error.message
      });
    }
  }

  /**
   * Update GitHub reaction
   */
  async updateReaction(emoji) {
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      
      // FIX: Parse GITHUB_EVENT if it exists and is JSON
      let commentId = process.env.COMMENT_ID;
      if (!commentId && process.env.GITHUB_EVENT) {
        try {
          const event = JSON.parse(process.env.GITHUB_EVENT);
          commentId = event.comment?.id;
        } catch (e) {
          // Not JSON, ignore
        }
      }
      
      commentId = parseInt(commentId);
      
      if (!commentId) {
        this.logger.log('warn', 'No comment ID available for reaction');
        return;
      }
      
      // Remove existing reactions
      try {
        const reactions = await octokit.reactions.listForIssueComment({
          owner: this.repoOwner,
          repo: this.repoName,
          comment_id: commentId
        });
        
        const botReactions = reactions.data.filter(
          r => r.user.login === 'github-actions[bot]'
        );
        
        for (const reaction of botReactions) {
          await octokit.reactions.deleteForIssueComment({
            owner: this.repoOwner,
            repo: this.repoName,
            comment_id: commentId,
            reaction_id: reaction.id
          }).catch(() => {}); // FIX: Ignore deletion errors
        }
      } catch (error) {
        this.logger.log('debug', 'Could not remove existing reactions', {
          error: error.message
        });
      }
      
      // Add new reaction
      await octokit.reactions.createForIssueComment({
        owner: this.repoOwner,
        repo: this.repoName,
        comment_id: commentId,
        content: emoji
      });
      
      this.logger.log('debug', `Reaction updated: ${emoji}`);
    } catch (error) {
      this.logger.log('debug', 'Failed to update reaction', {
        error: error.message
      });
    }
  }

  /**
   * Handle fatal errors
   */
  async handleFatalError(error) {
    this.logger.log('error', '💥 Fatal error in session', {
      sessionId: this.sessionId,
      error: error.message,
      stack: error.stack
    });
    
    // Try to post error message
    try {
      const errorMessage = `
## ❌ Claude Code Session Failed

**Error**: ${error.message}
**Session ID**: \`${this.sessionId}\`

Please check the workflow logs for more details.
`;
      
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      
      await octokit.issues.createComment({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: parseInt(process.env.PR_NUMBER || process.env.ISSUE_NUMBER),
        body: errorMessage
      });
    } catch (commentError) {
      this.logger.log('error', 'Failed to post error comment', {
        error: commentError.message
      });
    }
    
    // Update reaction to confused
    await this.updateReaction('confused');
    
    // Write error to GitHub Actions summary if available
    if (process.env.GITHUB_STEP_SUMMARY) {
      const fs = require('fs').promises;
      const errorSummary = `
## ❌ Session Failed

**Error**: ${error.message}
**Session ID**: ${this.sessionId}
**Time**: ${new Date().toISOString()}

\`\`\`
${error.stack}
\`\`\`
`;
      
      try {
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, errorSummary);
      } catch (writeError) {
        this.logger.log('error', 'Failed to write error summary', {
          error: writeError.message
        });
      }
    }
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry(func, operation) {
    let lastError;
    let delay = 1000;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await func();
      } catch (error) {
        lastError = error;
        
        this.logger.log('warn', `Attempt ${attempt} failed for ${operation}`, {
          error: error.message,
          attempt,
          maxRetries
        });
        
        if (attempt < maxRetries) {
          await this.sleep(delay);
          delay *= 2; // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Prepare initial message for Claude
   */
  prepareInitialMessage(context, command, tools) {
    const toolList = tools.map(t => `- **${t.name}**: ${t.description}`).join('\n');
    
    return `
# Claude Code Integration Session (Optimized)

You are Claude Code, integrated into an optimized GitHub Actions workflow. This session uses performance-enhanced tools with caching, GitHub CLI, and comprehensive error recovery.

## Session Information
- Session ID: ${this.sessionId}
- Context Type: ${context.type}
- Repository: ${context.repository.fullName}

## Available Tools
${toolList}

## Current Context
${context.pr ? `
### Pull Request #${context.pr.number}
- Title: ${context.pr.title}
- Author: ${context.pr.author}
- Branch: ${context.pr.branch.head} → ${context.pr.branch.base}
- Status: ${context.pr.state}
` : ''}

${context.issue ? `
### Issue #${context.issue.number}
- Title: ${context.issue.title}
- Author: ${context.issue.author}
- State: ${context.issue.state}
` : ''}

## User Request
- Expert: ${command.expert}
- Options: ${JSON.stringify(command.options)}
- Prompt: ${command.prompt}

## Performance Guidelines
1. Tools are optimized with caching - repeated operations are fast
2. GitHub CLI is preferred over API calls when available
3. Error recovery is automatic - operations will retry on failure
4. All operations are monitored for performance

## Your Task
Analyze the request and use the available tools to accomplish the task. Be efficient and leverage the optimizations available.

Important:
- Use tools to perform actions
- Explain what you're doing
- Handle any errors gracefully
- Complete the task thoroughly
`;
  }

  /**
   * Estimate token count for a message
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if executed directly
if (require.main === module) {
  const session = new ClaudeCodeSessionOptimized();
  session.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ClaudeCodeSessionOptimized;