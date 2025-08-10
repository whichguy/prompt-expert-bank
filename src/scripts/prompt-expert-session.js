#!/usr/bin/env node

/**
 * @fileoverview Prompt Expert Integration Session Manager
 * @description Expert-driven A/B testing and evaluation system for GitHub Actions
 * @module PromptExpertSession
 * @requires @anthropic-ai/sdk
 * @requires @octokit/rest
 * @author Prompt Expert Team
 * @version 1.0.0
 */

const Anthropic = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const { PromptRoleManager } = require('../lib/evaluation/PromptRoleManager');
const { ExpertEvaluationIntegration } = require('../lib/evaluation/ExpertEvaluationIntegration');
const { StructuredSystemPrompt } = require('../lib/evaluation/StructuredSystemPrompt');
const { ABTestTool } = require('../lib/abtest/ABTestTool');

/**
 * @class PromptExpertSession
 * @description Manages the lifecycle of a Prompt Expert evaluation session triggered by GitHub comments
 * @property {string} sessionId - Unique identifier for this session
 * @property {number} startTime - Session start timestamp
 * @property {string} repoOwner - GitHub repository owner
 * @property {string} repoName - GitHub repository name
 * @property {Function} log - Thread-safe logging function
 * @property {Object} metrics - Session metrics tracking
 * @property {PromptRoleManager|null} roleManager - Role management instance
 * @property {Object|null} currentRole - Currently loaded expert role
 * @property {ExpertEvaluationIntegration|null} expertIntegration - Expert evaluation integration
 * @property {ABTestTool|null} abTestTool - A/B testing tool instance
 * @property {StructuredSystemPrompt} promptBuilder - System prompt builder
 */
class PromptExpertSession {
  /**
   * @constructor
   * @description Initializes a new Prompt Expert session with unique ID and logging
   */
  constructor() {
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    
    // Parse repository info once
    const [repoOwner, repoName] = (process.env.GITHUB_REPOSITORY || '/').split('/');
    this.repoOwner = repoOwner || 'unknown';
    this.repoName = repoName || 'unknown';
    
    // Thread-safe logging with session isolation and improved formatting
    this.log = (level, message, data = {}) => {
      const timestamp = new Date().toISOString();
      const sessionShort = this.sessionId.split('-').pop();
      
      // Create structured log entry
      const logEntry = {
        timestamp,
        level,
        message,
        sessionId: this.sessionId,
        repository: process.env.GITHUB_REPOSITORY,
        pr: process.env.PR_NUMBER || 'none',
        issue: process.env.ISSUE_NUMBER || 'none',
        actor: process.env.GITHUB_ACTOR,
        runId: process.env.GITHUB_RUN_ID,
        threadContext: `${this.sessionId}`,
        ...data
      };
      
      // Format for better readability based on log level
      if (level === 'api_request' || level === 'api_response') {
        // Special formatting for API calls
        console.log(`\n${'='.repeat(80)}`);
        console.log(`[${timestamp}] [${sessionShort}] ${message}`);
        console.log(`${'='.repeat(80)}`);
        if (data.payload) {
          console.log('PAYLOAD:', JSON.stringify(data.payload, null, 2));
        }
        if (data.response) {
          console.log('RESPONSE:', JSON.stringify(data.response, null, 2));
        }
        console.log(`${'='.repeat(80)}\n`);
      } else if (level === 'tool_call' || level === 'tool_response') {
        // Special formatting for tool calls
        console.log(`\n[${timestamp}] [${sessionShort}] ${'-'.repeat(60)}`);
        console.log(`TOOL ${level === 'tool_call' ? 'CALL' : 'RESPONSE'}: ${message}`);
        if (data.tool) console.log(`  Tool: ${data.tool}`);
        if (data.input) console.log(`  Input: ${JSON.stringify(data.input, null, 2)}`);
        if (data.result) console.log(`  Result: ${JSON.stringify(data.result, null, 2)}`);
        console.log(`${'-'.repeat(60)}\n`);
      } else {
        // Standard JSON logging for other messages
        console.log(`[${this.sessionId}] ${JSON.stringify(logEntry)}`);
      }
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
    this.abTestTool = null;
    this.promptBuilder = new StructuredSystemPrompt();
  }

  /**
   * @method run
   * @async
   * @description Main entry point for the Prompt Expert session
   * @returns {Promise<void>} Exits process on completion
   * @throws {Error} Handles and logs any errors during execution
   */
  async run() {
    try {
      this.log('info', '🚀 Starting Prompt Expert session', {
        conversationThread: this.sessionId,
        startTime: new Date().toISOString(),
        githubContext: {
          repository: process.env.GITHUB_REPOSITORY,
          pr: process.env.PR_NUMBER,
          issue: process.env.ISSUE_NUMBER,
          actor: process.env.GITHUB_ACTOR,
          event: process.env.GITHUB_EVENT_NAME
        }
      });
      
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

      // Initialize AB Test tool
      this.abTestTool = new ABTestTool({
        octokit,
        anthropic,
        repoOwner: this.repoOwner,
        repoName: this.repoName,
        workspace: context.workspace
      });

      // Load role if specified
      if (command.role) {
        try {
          this.currentRole = await this.roleManager.loadRole(command.role);
          this.log('info', `Loaded role: ${this.currentRole.name}`, {
            role: command.role,
            source: this.currentRole.source
          });
        } catch (error) {
          this.log('warn', `Could not load role ${command.role}, continuing without it`, {
            error: error.message
          });
        }
      }
      
      // Process request with Claude
      const result = await this.processRequest(command, context, anthropic, octokit);
      
      // Post results
      await this.postResults(context, result, octokit);
      
      this.log('info', '✅ Session completed', {
        conversationThread: this.sessionId,
        duration: Date.now() - this.startTime,
        toolCalls: this.metrics.toolCalls,
        errors: this.metrics.errors,
        endTime: new Date().toISOString(),
        sessionSummary: `Session ${this.sessionId} processed ${this.metrics.toolCalls} tool calls with ${this.metrics.errors} errors in ${Date.now() - this.startTime}ms`
      });
      
      process.exit(0);
    } catch (error) {
      await this.handleError(error);
      process.exit(1);
    }
  }

  /**
   * @method validateEnvironment
   * @description Validates that all required environment variables are present
   * @throws {Error} If any required environment variables are missing
   * @private
   */
  validateEnvironment() {
    const required = ['GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GITHUB_REPOSITORY', 'COMMENT_BODY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * @method parseCommand
   * @description Parses the @prompt-expert command from GitHub comment body
   * @returns {Object} Parsed command object
   * @returns {string} returns.prompt - User's full request text (everything after @prompt-expert)
   * @returns {string} returns.raw - Original comment text
   * @returns {string} returns.mode - Command mode ('expert' for prompt evaluation)
   * @returns {string|null} returns.role - Expert role if specified inline
   * @throws {Error} If command format is invalid
   * @private
   */
  parseCommand() {
    const comment = process.env.COMMENT_BODY || '';
    
    // Extract everything after @prompt-expert as the user prompt
    const match = comment.match(/@prompt-expert\s+(.*)/is);
    if (match) {
      const fullPrompt = match[1].trim();
      
      // Check if the first word might be an expert name (single word followed by space)
      // This allows both formats:
      // @prompt-expert security-expert analyze the PR
      // @prompt-expert analyze the PR with security focus
      let role = null;
      let prompt = fullPrompt;
      
      const expertMatch = fullPrompt.match(/^([a-z-]+)\s+(.+)/i);
      if (expertMatch && this.isKnownExpert(expertMatch[1])) {
        role = expertMatch[1];
        prompt = expertMatch[2];
      }
      
      // If no prompt provided, use the full input or a default
      prompt = prompt || fullPrompt || 'Please analyze and help with this pull request';
      
      return {
        prompt: prompt,
        raw: comment,
        mode: 'expert', // Keep expert mode for evaluation tools
        role: role
      };
    }
    
    throw new Error('Invalid command format. Use: @prompt-expert <request>');
  }

  /**
   * @method isKnownExpert
   * @description Checks if a string matches a known expert role
   * @param {string} name - Potential expert name
   * @returns {boolean} Whether this is a known expert
   * @private
   */
  isKnownExpert(name) {
    const knownExperts = [
      'security', 'security-expert',
      'programming', 'programming-expert', 
      'financial', 'financial-expert',
      'data-analysis', 'data-expert',
      'general', 'general-expert'
    ];
    return knownExperts.includes(name.toLowerCase());
  }

  /**
   * @method buildContext
   * @description Builds execution context from environment variables
   * @returns {Object} Context object
   * @returns {string} returns.repository - Full repository name
   * @returns {string} returns.repoOwner - Repository owner
   * @returns {string} returns.repoName - Repository name
   * @returns {string} returns.actor - GitHub actor who triggered the action
   * @returns {string} returns.runId - GitHub Actions run ID
   * @returns {string} returns.workspace - Workspace directory path
   * @returns {Object} [returns.pr] - PR context if available
   * @returns {Object} [returns.issue] - Issue context if available
   * @private
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
   * @method initializeClients
   * @description Initializes Anthropic and GitHub API clients
   * @returns {Object} Initialized clients
   * @returns {Anthropic} returns.anthropic - Anthropic Claude API client
   * @returns {Octokit} returns.octokit - GitHub API client
   * @private
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
   * @method processRequest
   * @async
   * @description Processes the user request through Claude with available tools
   * @param {Object} command - Parsed command object
   * @param {Object} context - Execution context
   * @param {Anthropic} anthropic - Anthropic API client
   * @param {Octokit} octokit - GitHub API client
   * @returns {Promise<Object>} Processing results
   * @returns {string} returns.response - Final response text
   * @returns {Array} returns.toolCalls - Array of tool call results
   * @private
   */
  async processRequest(command, context, anthropic, octokit) {
    // Define available tools based on mode
    const tools = this.getTools(context, command.mode);
    
    // Prepare initial message with role-aware system prompt
    const systemMessage = this.buildSystemMessage(context, command);
    const userMessage = this.buildUserMessage(command, context);
    
    // Log the complete initial prompts before sending
    this.log('info', '📝 INITIAL PROMPTS PREPARED:', {
      systemMessageLength: systemMessage.length,
      userMessageLength: userMessage.length,
      fullSystemMessage: systemMessage,
      fullUserMessage: userMessage,
      mode: command.mode,
      role: command.role || 'none',
      availableTools: tools.map(t => t.name).join(', ')
    });
    
    // Start conversation
    const initialContent = `${systemMessage}\n\n${userMessage}`;
    let messages = [
      { role: 'user', content: initialContent }
    ];
    
    // Log the exact message being sent to Claude
    this.log('api_request', 'CLAUDE API REQUEST - Initial Message', {
      payload: {
        messages: messages,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: tools.map(t => ({ name: t.name, description: t.description })),
        tool_choice: { type: 'auto' }
      }
    });
    
    let iterations = 0;
    const maxIterations = 10;
    const results = {
      response: '',
      toolCalls: []
    };
    
    while (iterations < maxIterations) {
      iterations++;
      
      // Log the API request payload for each iteration
      const apiPayload = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: messages,
        tools: tools,
        tool_choice: { type: 'auto' }
      };
      
      this.log('api_request', `CLAUDE API REQUEST - Iteration ${iterations}`, {
        payload: {
          messageCount: messages.length,
          toolsAvailable: tools.length,
          lastMessage: messages[messages.length - 1]
        }
      });
      
      // Call Claude API with retry logic
      const response = await this.callClaudeWithRetry(anthropic, apiPayload);
      
      // Log the API response
      this.log('api_response', `CLAUDE API RESPONSE - Iteration ${iterations}`, {
        response: {
          id: response.id,
          model: response.model,
          stop_reason: response.stop_reason,
          usage: response.usage,
          content_preview: response.content.slice(0, 2) // First 2 content blocks
        }
      });
      
      // Check for tool use
      const toolUses = response.content.filter(c => c.type === 'tool_use');
      
      if (toolUses.length === 0) {
        // No tools, get final response
        const textContent = response.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        
        this.log('info', '✅ FINAL RESPONSE GENERATED', {
          responseLength: textContent.length,
          totalIterations: iterations,
          finalText: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : '')
        });
        
        results.response = textContent;
        break;
      }
      
      // Log each tool request individually
      for (const tool of toolUses) {
        this.log('tool_call', `${tool.name}`, {
          tool: tool.name,
          id: tool.id,
          input: tool.input,
          iteration: iterations
        });
      }
      
      // Execute tools
      const toolResults = await this.executeTools(toolUses, context, octokit);
      results.toolCalls.push(...toolResults);
      
      // Log each tool response individually
      for (const result of toolResults) {
        this.log('tool_response', `${result.name}`, {
          tool: result.name,
          id: result.id,
          success: !result.result.error,
          result: result.result,
          iteration: iterations
        });
      }
      
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
   * @method executeTools
   * @async
   * @description Executes tool calls requested by Claude
   * @param {Array<Object>} toolUses - Array of tool use requests from Claude
   * @param {Object} context - Execution context
   * @param {Octokit} octokit - GitHub API client
   * @returns {Promise<Array>} Array of tool execution results
   * @private
   */
  async executeTools(toolUses, context, octokit) {
    const results = [];
    
    for (const tool of toolUses) {
      this.metrics.toolCalls++;
      
      try {
        let result;
        
        // Check if it's an expert evaluation tool or AB test
        const evaluationTools = ['evaluate_prompt_changes', 'get_prompt_history', 'compare_prompt_versions', 'get_expert_feedback'];
        
        if (tool.name === 'ab_test') {
          result = await this.abTestTool.executeABTest(
            tool.input.pathToExpertPromptDefinition,
            tool.input.pathToPromptA,
            tool.input.pathToPromptB,
            tool.input.testContextPaths || []
          );
        } else if (evaluationTools.includes(tool.name)) {
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
   * @method getFile
   * @async
   * @description Tool implementation: Reads file contents from workspace
   * @param {Object} args - Tool arguments
   * @param {string} args.path - File path relative to workspace
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} File content
   * @returns {string} returns.content - File content as string
   * @throws {Error} If path is invalid or file cannot be read
   * @private
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
   * @method updateFile
   * @async
   * @description Tool implementation: Writes content to file in workspace
   * @param {Object} args - Tool arguments
   * @param {string} args.path - File path relative to workspace
   * @param {string} args.content - Content to write
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Update result
   * @returns {boolean} returns.success - Whether update succeeded
   * @returns {string} returns.path - Path that was updated
   * @throws {Error} If path is invalid or file cannot be written
   * @private
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
   * @method listFiles
   * @async
   * @description Tool implementation: Lists files in a directory
   * @param {Object} args - Tool arguments
   * @param {string} [args.path=''] - Directory path relative to workspace
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Directory listing
   * @returns {Array<string>} returns.files - Array of file names
   * @throws {Error} If path is invalid or directory cannot be read
   * @private
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
   * @method runCommand
   * @async
   * @description Tool implementation: Executes safe shell commands
   * @param {Object} args - Tool arguments
   * @param {string} args.command - Command to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Command execution result
   * @returns {string} [returns.stdout] - Standard output
   * @returns {string} [returns.stderr] - Standard error
   * @returns {string} [returns.error] - Error message if command failed
   * @private
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
   * @method githubApi
   * @async
   * @description Tool implementation: Makes GitHub API calls
   * @param {Object} args - Tool arguments
   * @param {string} [args.method='GET'] - HTTP method
   * @param {string} args.endpoint - API endpoint path
   * @param {Object} [args.data] - Request data for POST/PATCH
   * @param {Octokit} octokit - GitHub API client
   * @returns {Promise<Object>} API response data
   * @private
   */
  async githubApi(args, octokit) {
    const { method = 'GET', endpoint, data } = args;
    
    const response = await octokit.request(`${method} ${endpoint}`, data);
    return response.data;
  }

  /**
   * @method getTools
   * @description Gets available tool definitions based on mode
   * @param {Object} context - Execution context
   * @param {string} [mode='standard'] - Tool mode ('standard' or 'expert')
   * @returns {Array<Object>} Array of tool definitions for Claude
   * @private
   */
  getTools(context, mode = 'standard') {
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

    // Add AB test tool (always available)
    const abTestTool = ABTestTool.getToolDefinition();
    
    // Only add expert evaluation tools in expert mode
    if (mode === 'expert' && this.expertIntegration) {
      const evaluationTools = this.expertIntegration.getEvaluationTools();
      return [...standardTools, abTestTool, ...evaluationTools];
    }

    return [...standardTools, abTestTool];
  }

  /**
   * @method buildSystemMessage
   * @description Builds system message for Claude with role and context
   * @param {Object} context - Execution context
   * @param {Object} command - Parsed command object
   * @returns {string} System message for Claude
   * @private
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
   * @method buildUserMessage
   * @description Builds user message for Claude based on command mode
   * @param {Object} command - Parsed command object
   * @param {Object} context - Execution context
   * @returns {string} User message for Claude
   * @private
   */
  buildUserMessage(command, context) {
    // For expert mode, still pass through the user's request directly
    // The expert tools and system prompt will guide the behavior
    return command.prompt;
  }

  /**
   * @method callClaudeWithRetry
   * @async
   * @description Calls Claude API with retry logic and exponential backoff
   * @param {Anthropic} anthropic - Anthropic API client
   * @param {Object} payload - API request payload
   * @returns {Promise<Object>} Claude API response
   * @throws {Error} If all retry attempts fail
   * @private
   */
  async callClaudeWithRetry(anthropic, payload) {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay for Claude API
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // If this is a retry, wait with exponential backoff
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Add jitter
          this.log('info', `Retrying Claude API call (attempt ${attempt}/${maxRetries})`, {
            delay: Math.round(delay),
            lastError: lastError?.message || 'Unknown error'
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Make the API call
        const response = await anthropic.messages.create(payload);
        
        // Success - return the response
        if (attempt > 0) {
          this.log('info', `Claude API call succeeded after ${attempt} retries`);
        }
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isClaudeErrorRetryable(error);
        
        if (!isRetryable || attempt === maxRetries) {
          // Not retryable or final attempt - throw the error
          this.log('error', `Claude API call failed after ${attempt + 1} attempts`, {
            error: error.message,
            errorType: error.type || 'unknown',
            statusCode: error.status || 'unknown',
            headers: error.headers || {}
          });
          throw error;
        }
        
        // Log retry information
        this.log('warn', `Claude API call failed (attempt ${attempt + 1}/${maxRetries + 1})`, {
          error: error.message,
          errorType: error.type || 'unknown',
          statusCode: error.status || 'unknown',
          willRetry: true
        });
      }
    }
    
    // Should never reach here, but just in case
    throw lastError || new Error('Failed to call Claude API after all retries');
  }

  /**
   * @method isClaudeErrorRetryable
   * @description Determines if a Claude API error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is retryable
   * @private
   */
  isClaudeErrorRetryable(error) {
    // Check error status if available
    if (error.status) {
      const retryableStatuses = [
        408, // Request Timeout
        429, // Too Many Requests (rate limit)
        500, // Internal Server Error
        502, // Bad Gateway
        503, // Service Unavailable
        504, // Gateway Timeout
        520, // Cloudflare errors
        521,
        522,
        523,
        524,
      ];
      
      if (retryableStatuses.includes(error.status)) {
        return true;
      }
    }
    
    // Check error types specific to Anthropic SDK
    const retryableTypes = [
      'rate_limit_error',
      'overloaded_error',
      'api_error', // General API errors are often transient
      'timeout_error',
      'connection_error',
      'network_error'
    ];
    
    if (error.type && retryableTypes.includes(error.type)) {
      return true;
    }
    
    // Check error message for known retryable patterns
    const message = error.message || error.toString();
    const retryablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'socket hang up',
      'Network',
      'Timeout',
      'temporarily unavailable',
      'overloaded',
      'rate limit',
      'Too Many Requests',
      'Service Unavailable'
    ];
    
    for (const pattern of retryablePatterns) {
      if (message.includes(pattern)) {
        return true;
      }
    }
    
    // Non-retryable errors
    const nonRetryableTypes = [
      'invalid_request_error', // Bad request - won't get better with retry
      'authentication_error',  // Auth issues need fixing, not retrying
      'permission_error',      // Permission issues won't resolve with retry
      'not_found_error',       // Resource not found
      'request_too_large',     // Request size issues
      'invalid_api_key'
    ];
    
    if (error.type && nonRetryableTypes.includes(error.type)) {
      return false;
    }
    
    // Default to not retrying unknown errors
    return false;
  }

  /**
   * @method postResults
   * @async
   * @description Posts Claude's response back to GitHub as a comment
   * @param {Object} context - Execution context
   * @param {Object} result - Processing results from Claude
   * @param {Octokit} octokit - GitHub API client
   * @returns {Promise<void>}
   * @private
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
   * @method handleError
   * @async
   * @description Handles and logs errors, attempts to post error message to GitHub
   * @param {Error} error - Error object
   * @returns {Promise<void>}
   * @private
   */
  async handleError(error) {
    this.log('error', 'Session failed', {
      error: error.message,
      stack: error.stack
    });
    
    // Try to post error message with workflow link
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      
      // Build workflow run URL
      const runId = process.env.GITHUB_RUN_ID;
      const workflowUrl = runId 
        ? `https://github.com/${this.repoOwner}/${this.repoName}/actions/runs/${runId}`
        : null;
      
      // Build error message with hyperlink
      let body = `## ❌ Prompt Expert Error

**Error:** ${error.message}

**Session ID:** \`${this.sessionId}\``;

      if (workflowUrl) {
        body += `\n\n### 🔍 Debug Information
        
[**Click here to view the full workflow logs →**](${workflowUrl})

**To investigate this error:**
1. Click the link above to open the workflow run
2. Look for session ID: \`${this.sessionId}\` in the logs
3. Check the detailed logs for API requests and responses
4. Review any tool execution failures`;
      } else {
        body += `\n\nPlease check the GitHub Actions tab for workflow logs.`;
      }

      body += `\n\n---\n<sub>Run ID: ${runId || 'unknown'} | Session: ${this.sessionId.split('-').pop()}</sub>`;

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
  const session = new PromptExpertSession();
  session.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = PromptExpertSession;