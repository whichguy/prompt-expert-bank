/**
 * Claude Tool Executor
 * Handles execution of all Claude tools with retry logic and error handling
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const ExpertLoader = require('../../../scripts/expert-loader');
const { ErrorRecovery } = require('./ErrorRecovery');

class ClaudeToolExecutor {
  constructor(octokit, context, anthropic, logger) {
    this.octokit = octokit;
    this.context = context;
    this.anthropic = anthropic;
    this.logger = logger || console;
    this.executionLog = [];
    this.gitConfigured = false;
    this.retryAttempts = {};
    this.maxRetries = 3;
    this.safeCommands = [
      'ls', 'cat', 'grep', 'find', 'npm test', 'npm run lint',
      'jest', 'mocha', 'pytest', 'eslint', 'prettier', 'npm audit',
      'yarn test', 'yarn lint', 'pnpm test', 'pnpm lint'
    ];
  }

  async ensureGitConfig() {
    if (this.gitConfigured) return;

    try {
      this.logger.log('info', 'Configuring git environment');
      
      // Check if we're in a git repository
      try {
        await execAsync('git rev-parse --git-dir');
      } catch (e) {
        throw new Error('Not in a git repository. Workflow may not have checked out the code.');
      }
      
      // Configure git user for commits
      await execAsync('git config user.name "Claude Code"');
      await execAsync('git config user.email "claude@anthropic.com"');
      
      // Check current branch
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      const prBranch = this.context.pr?.branch?.head;
      
      if (!prBranch) {
        this.logger.log('warn', 'No PR branch specified, using current branch', { 
          currentBranch: currentBranch.trim() 
        });
      } else if (currentBranch.trim() !== prBranch) {
        // Ensure we're on the PR branch
        this.logger.log('info', `Switching to PR branch: ${prBranch}`);
        
        // Fetch the branch first
        await execAsync(`git fetch origin ${prBranch}:${prBranch}`, { timeout: 30000 })
          .catch(() => this.logger.log('warn', 'Branch fetch failed, may already exist locally'));
        
        // Checkout the branch
        await execAsync(`git checkout ${prBranch}`);
      }
      
      this.gitConfigured = true;
      this.logger.log('info', 'Git configuration complete');
      
    } catch (error) {
      this.logger.log('error', 'Failed to configure git environment', { 
        error: error.message,
        critical: true 
      });
      throw error;
    }
  }

  async withRetry(operation, operationName) {
    const key = operationName || operation.name || 'unknown';
    this.retryAttempts[key] = this.retryAttempts[key] || 0;
    
    while (this.retryAttempts[key] < this.maxRetries) {
      try {
        this.logger.log('debug', `Executing operation: ${key}`, { 
          attempt: this.retryAttempts[key] + 1 
        });
        
        const result = await operation();
        
        // Reset retry count on success
        this.retryAttempts[key] = 0;
        return result;
        
      } catch (error) {
        this.retryAttempts[key]++;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || this.retryAttempts[key] >= this.maxRetries) {
          this.logger.log('error', `Operation failed: ${key}`, {
            error: error.message,
            attempts: this.retryAttempts[key],
            retryable: isRetryable
          });
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, this.retryAttempts[key] - 1), 10000);
        this.logger.log('warn', `Retrying operation: ${key}`, { 
          attempt: this.retryAttempts[key],
          delay: delay,
          error: error.message 
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    
    // GitHub API rate limiting
    if (error.status === 429 || error.status === 403) return true;
    
    // Server errors
    if (error.status >= 500 && error.status < 600) return true;
    
    // Git lock errors
    if (error.message?.includes('index.lock')) return true;
    
    return false;
  }

  async executeTool(toolCall) {
    const { name, arguments: args } = toolCall;
    const startTime = Date.now();
    
    this.logger.log('info', `Executing tool: ${name}`, { args });
    
    try {
      let result;
      
      // Wrap operations that might need retry
      const retryableTools = ['pr_merge', 'git_commit', 'git_command', 'run_command'];
      
      if (retryableTools.includes(name)) {
        result = await this.withRetry(
          () => this.executeToolInternal(name, args),
          name
        );
      } else {
        result = await this.executeToolInternal(name, args);
      }
      
      const duration = Date.now() - startTime;
      this.logger.log('info', `Tool execution completed: ${name}`, { 
        duration,
        success: result.success 
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Try error recovery
      const recovery = await ErrorRecovery.recover(error, this);
      if (recovery.retry) {
        return this.executeTool(toolCall);
      }
      
      this.logger.log('error', `Tool execution failed: ${name}`, {
        error: error.message,
        stack: error.stack,
        duration,
        args
      });
      
      return {
        success: false,
        error: error.message,
        tool: name,
        duration
      };
    }
  }

  async executeToolInternal(name, args) {
    switch(name) {
      // Prompt Evaluation Tools
      case 'evaluate_prompt':
        return await this.evaluatePrompt(args);
      case 'run_prompt_ab_test':
        return await this.runPromptABTest(args);
      case 'analyze_prompt_performance':
        return await this.analyzePromptPerformance(args);
        
      // File Operations
      case 'read_file':
        return await this.readFile(args.path, args.ref, args.encoding);
      case 'write_file':
        return await this.writeFile(args.path, args.content, args.mode, args.encoding);
      case 'delete_file':
        return await this.deleteFile(args.path);
        
      // Search Operations
      case 'search_repository':
        return await this.searchRepository(args.query, args.type, args.fileExtension);
      case 'list_directory':
        return await this.listDirectory(args.path, args.recursive);
        
      // Git Operations
      case 'git_diff':
        return await this.gitDiff(args.path, args.base);
      case 'git_commit':
        return await this.gitCommit(args.message, args.files);
      case 'git_command':
        return await this.gitCommand(args.command, args.args);
        
      // PR Operations (only if PR context)
      case 'pr_comment':
        return await this.prComment(args.body, args.replyTo);
      case 'pr_review':
        return await this.prReview(args.body, args.event, args.comments);
      case 'pr_request_reviewers':
        return await this.prRequestReviewers(args.reviewers, args.teams);
      case 'pr_add_labels':
        return await this.prAddLabels(args.labels);
      case 'pr_remove_labels':
        return await this.prRemoveLabels(args.labels);
      case 'pr_update_title':
        return await this.prUpdateTitle(args.title);
      case 'pr_update_description':
        return await this.prUpdateDescription(args.body);
      case 'pr_merge':
        return await this.prMerge(args.method, args.message);
      case 'pr_close':
        return await this.prClose(args.comment);
        
      // Issue Operations (only if Issue context)
      case 'issue_comment':
        return await this.issueComment(args.body);
      case 'issue_add_labels':
        return await this.issueAddLabels(args.labels);
      case 'issue_remove_labels':
        return await this.issueRemoveLabels(args.labels);
      case 'issue_assign':
        return await this.issueAssign(args.assignees);
      case 'issue_unassign':
        return await this.issueUnassign(args.assignees);
      case 'issue_update_title':
        return await this.issueUpdateTitle(args.title);
      case 'issue_update_body':
        return await this.issueUpdateBody(args.body);
      case 'issue_close':
        return await this.issueClose(args.reason, args.comment);
      case 'issue_reopen':
        return await this.issueReopen(args.comment);
        
      // Command Execution
      case 'run_command':
        return await this.runCommand(args.command, args.workingDir, args.safe);
      case 'run_tests':
        return await this.runTests(args.pattern, args.framework);
        
      // Environment
      case 'get_env_variable':
        return await this.getEnvVariable(args.name);
      case 'access_secret':
        return await this.accessSecret(args.name, args.reason);
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // === Prompt Evaluation Methods ===
  
  async evaluatePrompt(args) {
    const { prompt, expert = 'programming', testScenarios = [], compareWith = 'none', customBaseline, autoImplement = false } = args;
    
    // Load expert prompt
    const expertLoader = new ExpertLoader({ baseDir: process.cwd() });
    await expertLoader.initialize();
    const expertData = await expertLoader.loadExpert(expert);
    
    // Generate default test scenarios if none provided
    const scenarios = testScenarios.length > 0 ? testScenarios : [
      { input: "Write a function that reverses a string", expectedBehavior: "Provide working code" },
      { input: "Explain how to handle errors", expectedBehavior: "Clear error handling guidance" },
      { input: "What are best practices?", expectedBehavior: "Domain-specific best practices" }
    ];
    
    const results = {
      prompt: prompt,
      expert: expert,
      scenarios: [],
      comparison: null,
      improvements: null,
      autoImplemented: false
    };
    
    // Execute prompt with each test scenario
    for (const scenario of scenarios) {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nTest scenario: ${scenario.input}`
          }
        ]
      });
      
      // Expert evaluation of the response
      const evaluation = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `${expertData.content}
            
Evaluate this response for the ${expert} domain:

Test Input: ${scenario.input}
Expected Behavior: ${scenario.expectedBehavior}

Response:
${response.content[0].text}

Provide:
1. Score (1-10)
2. Strengths
3. Weaknesses
4. Suggestions for improvement
5. Specific code or text improvements (if applicable)`
          }
        ]
      });
      
      results.scenarios.push({
        input: scenario.input,
        response: response.content[0].text,
        evaluation: evaluation.content[0].text,
        score: this.extractScore(evaluation.content[0].text)
      });
    }
    
    // Calculate average score
    const avgScore = results.scenarios.reduce((sum, s) => sum + (s.score || 0), 0) / results.scenarios.length;
    results.averageScore = avgScore;
    
    // Check if improvements are needed
    if (avgScore < 8.0) {
      results.improvements = await this.generateImprovements(prompt, results, expert);
      
      // Auto-implement improvements if requested
      if (autoImplement && results.improvements) {
        results.autoImplemented = await this.implementImprovements(results.improvements, expert);
      }
    }
    
    return {
      success: true,
      results: results,
      summary: `Evaluated prompt with ${expert} expert across ${scenarios.length} scenarios. Average score: ${avgScore.toFixed(1)}/10${results.autoImplemented ? ' (improvements implemented)' : ''}`
    };
  }

  extractScore(evaluationText) {
    const scoreMatch = evaluationText.match(/Score[:\s]+(\d+(?:\.\d+)?)\s*\/\s*10/i);
    return scoreMatch ? parseFloat(scoreMatch[1]) : 5.0;
  }

  async generateImprovements(originalPrompt, evaluationResults, expert) {
    const improvements = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Based on these evaluation results, generate an improved version of the prompt.

Original Prompt:
${originalPrompt}

Evaluation Results:
${JSON.stringify(evaluationResults.scenarios.map(s => ({
  input: s.input,
  evaluation: s.evaluation,
  score: s.score
})), null, 2)}

Average Score: ${evaluationResults.averageScore.toFixed(1)}/10

Generate an improved prompt that addresses the weaknesses identified. The improved prompt should:
1. Maintain the original intent
2. Address all identified weaknesses
3. Incorporate suggested improvements
4. Be clear and actionable

Provide:
1. The improved prompt (full text)
2. List of specific changes made
3. Expected score improvement`
        }
      ]
    });
    
    return improvements.content[0].text;
  }

  async implementImprovements(improvements, expert) {
    try {
      // Extract the improved prompt from the response
      const improvedPromptMatch = improvements.match(/Improved Prompt[:\s]+([\s\S]+?)(?:\n\n|List of|Changes|$)/i);
      if (!improvedPromptMatch) {
        this.logger.log('warn', 'Could not extract improved prompt from suggestions');
        return false;
      }
      
      const improvedPrompt = improvedPromptMatch[1].trim();
      
      // Determine the file path for the expert prompt
      const promptFile = `prompts/${expert}.md`;
      
      // Check if file exists
      const fileExists = await this.readFile(promptFile, 'head')
        .then(result => result.success)
        .catch(() => false);
      
      // Write the improved prompt
      await this.writeFile(
        promptFile,
        improvedPrompt,
        fileExists ? 'update' : 'create'
      );
      
      // Commit the changes
      await this.gitCommit(
        `Claude Code: Auto-implement prompt improvements for ${expert}

Based on evaluation feedback, automatically implemented the following improvements:
${improvements.split('\n').slice(0, 5).join('\n')}

Average score improved from evaluation.`,
        [promptFile]
      );
      
      // Add a comment about the implementation
      if (this.context.pr) {
        await this.prComment(`## ✨ Prompt Improvements Auto-Implemented

I've automatically implemented the suggested improvements to the ${expert} prompt based on the evaluation results.

**Changes Made:**
${improvements}

The improved prompt has been committed to the PR. Please review the changes and run additional tests if needed.

To re-evaluate the improved prompt, comment:
\`@prompt-expert ${expert} --evaluate "Re-test the improved prompt"\`
`);
      }
      
      this.logger.log('info', 'Successfully auto-implemented prompt improvements', {
        expert,
        file: promptFile
      });
      
      return true;
    } catch (error) {
      this.logger.log('error', 'Failed to auto-implement improvements', {
        error: error.message,
        expert
      });
      return false;
    }
  }

  // === File Operations ===
  
  async readFile(path, ref = 'head', encoding = 'utf8') {
    // Validate path
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid file path provided');
    }
    
    // Sanitize path to prevent directory traversal
    if (path.includes('..') || path.startsWith('/')) {
      throw new Error('Invalid path: directory traversal not allowed');
    }
    
    const refMap = {
      'head': this.context.pr?.branch?.head || 'HEAD',
      'base': this.context.pr?.branch?.base || this.context.repository?.defaultBranch,
      'main': this.context.repository?.defaultBranch || 'main'
    };
    
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        path: path,
        ref: refMap[ref] || ref
      });
      
      // Handle directories
      if (Array.isArray(data)) {
        return {
          success: true,
          type: 'directory',
          path: path,
          contents: data.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size
          }))
        };
      }
      
      // Check file size limits
      if (data.size > 100 * 1024 * 1024) {
        this.logger.log('warn', `File too large for API: ${path}`, { size: data.size });
        return {
          success: false,
          error: 'File too large (>100MB)',
          path: path,
          size: data.size
        };
      }
      
      // Detect binary files
      const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar', '.gz'
      ];
      const isBinary = binaryExtensions.some(ext => path.toLowerCase().endsWith(ext));
      
      if (isBinary || encoding === 'base64') {
        return {
          success: true,
          content: data.content,
          encoding: 'base64',
          path: path,
          sha: data.sha,
          size: data.size
        };
      }
      
      // Text files - decode from base64
      return {
        success: true,
        content: Buffer.from(data.content, 'base64').toString(encoding),
        encoding: encoding,
        path: path,
        sha: data.sha
      };
      
    } catch (error) {
      if (error.status === 404) {
        return {
          success: false,
          error: 'File not found',
          path: path
        };
      }
      throw error;
    }
  }

  async writeFile(path, content, mode = 'update', encoding = 'utf8') {
    let sha;
    
    // Get current file SHA if updating
    if (mode === 'update') {
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.context.repository.owner,
          repo: this.context.repository.name,
          path: path,
          ref: this.context.pr?.branch?.head || 'HEAD'
        });
        sha = data.sha;
      } catch (e) {
        if (mode === 'update' && e.status === 404) {
          mode = 'create';
        }
      }
    }
    
    const message = `Claude Code: ${mode} ${path}`;
    
    // Handle binary content
    let encodedContent;
    if (encoding === 'base64') {
      encodedContent = content;
    } else {
      encodedContent = Buffer.from(content, encoding).toString('base64');
    }
    
    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      path: path,
      message: message,
      content: encodedContent,
      branch: this.context.pr?.branch?.head || 'main',
      sha: sha
    });
    
    return {
      success: true,
      path: path,
      mode: mode,
      message: message,
      encoding: encoding
    };
  }

  // === PR Operations ===
  
  async prComment(body, replyTo = null) {
    if (!this.context.pr) {
      return {
        success: false,
        error: 'Not in PR context'
      };
    }
    
    const comment = await this.octokit.issues.createComment({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.pr.number,
      body: `🤖 **Claude Code**\n\n${body}`
    });
    
    return {
      success: true,
      commentId: comment.data.id,
      url: comment.data.html_url
    };
  }

  async prAddLabels(labels) {
    if (!this.context.pr) {
      return {
        success: false,
        error: 'Not in PR context'
      };
    }
    
    await this.octokit.issues.addLabels({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.pr.number,
      labels: labels
    });
    
    return {
      success: true,
      labels: labels,
      action: 'added'
    };
  }

  async prMerge(method = 'squash', message = '') {
    if (!this.context.pr) {
      return {
        success: false,
        error: 'Not in PR context'
      };
    }
    
    const result = await this.octokit.pulls.merge({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      pull_number: this.context.pr.number,
      merge_method: method,
      commit_message: message || `Merge PR #${this.context.pr.number} via Claude Code`
    });
    
    return {
      success: true,
      sha: result.data.sha,
      merged: result.data.merged,
      message: result.data.message
    };
  }

  // === Git Operations ===
  
  async gitCommand(command, args = []) {
    await this.ensureGitConfig();
    
    const fullCommand = `git ${command} ${args.join(' ')}`.trim();
    
    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout: 60000
      });
      
      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
        command: fullCommand
      };
    } catch (error) {
      // Handle common git errors
      if (error.message.includes('nothing to commit')) {
        return {
          success: true,
          message: 'No changes to commit',
          command: fullCommand
        };
      }
      
      return {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        command: fullCommand
      };
    }
  }

  // === Command Execution ===
  
  async runCommand(command, workingDir = '.', safe = true) {
    // Security check for safe mode
    if (safe && !this.safeCommands.some(cmd => command.startsWith(cmd))) {
      return {
        success: false,
        error: `Command '${command}' not allowed in safe mode`,
        allowedCommands: this.safeCommands
      };
    }
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 30000
      });
      
      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
        command: command
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        command: command
      };
    }
  }

  // === Additional Missing Tool Implementations ===

  async deleteFile(path) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        path: path,
        ref: this.context.pr?.branch?.head || 'HEAD'
      });
      
      await this.octokit.repos.deleteFile({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        path: path,
        message: `Claude Code: Delete ${path}`,
        sha: data.sha,
        branch: this.context.pr?.branch?.head || 'main'
      });
      
      return {
        success: true,
        path: path,
        action: 'deleted'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: path
      };
    }
  }

  async searchRepository(query, type = 'content', fileExtension = null) {
    try {
      let searchQuery = `${query} repo:${this.context.repository.owner}/${this.context.repository.name}`;
      
      if (fileExtension) {
        searchQuery += ` extension:${fileExtension}`;
      }
      
      const { data } = await this.octokit.search.code({
        q: searchQuery,
        per_page: 20
      });
      
      return {
        success: true,
        results: data.items.map(item => ({
          name: item.name,
          path: item.path,
          repository: item.repository.name,
          html_url: item.html_url,
          score: item.score
        })),
        total_count: data.total_count
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        query: query
      };
    }
  }

  async listDirectory(path = '', recursive = false) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        path: path,
        ref: this.context.pr?.branch?.head || 'HEAD'
      });
      
      if (!Array.isArray(data)) {
        return {
          success: false,
          error: 'Path is not a directory',
          path: path
        };
      }
      
      let contents = data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size
      }));
      
      // Recursive listing if requested
      if (recursive) {
        for (const item of data.filter(i => i.type === 'dir')) {
          const subDir = await this.listDirectory(item.path, true);
          if (subDir.success) {
            contents = contents.concat(subDir.contents);
          }
        }
      }
      
      return {
        success: true,
        path: path,
        contents: contents
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: path
      };
    }
  }

  async gitDiff(path = '', base = 'HEAD') {
    try {
      const { stdout } = await execAsync(`git diff ${base} ${path}`, {
        timeout: 30000
      });
      
      return {
        success: true,
        diff: stdout,
        path: path,
        base: base
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: path
      };
    }
  }

  async gitCommit(message, files = []) {
    await this.ensureGitConfig();
    
    try {
      // Stage files if specified
      if (files.length > 0) {
        await execAsync(`git add ${files.join(' ')}`);
      } else {
        await execAsync('git add -A');
      }
      
      // Create commit
      await execAsync(`git commit -m "${message}"`);
      
      return {
        success: true,
        message: message,
        files: files
      };
    } catch (error) {
      if (error.message.includes('nothing to commit')) {
        return {
          success: true,
          message: 'No changes to commit'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async prReview(body, event = 'COMMENT', comments = []) {
    try {
      const review = await this.octokit.pulls.createReview({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        pull_number: this.context.pr.number,
        body: body,
        event: event,
        comments: comments
      });
      
      return {
        success: true,
        reviewId: review.data.id,
        state: review.data.state,
        url: review.data.html_url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async prRequestReviewers(reviewers = [], teams = []) {
    try {
      await this.octokit.pulls.requestReviewers({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        pull_number: this.context.pr.number,
        reviewers: reviewers,
        team_reviewers: teams
      });
      
      return {
        success: true,
        reviewers: reviewers,
        teams: teams
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async prRemoveLabels(labels) {
    try {
      for (const label of labels) {
        await this.octokit.issues.removeLabel({
          owner: this.context.repository.owner,
          repo: this.context.repository.name,
          issue_number: this.context.pr.number,
          name: label
        });
      }
      
      return {
        success: true,
        labels: labels,
        action: 'removed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async prUpdateTitle(title) {
    try {
      await this.octokit.pulls.update({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        pull_number: this.context.pr.number,
        title: title
      });
      
      return {
        success: true,
        title: title
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async prUpdateDescription(body) {
    try {
      await this.octokit.pulls.update({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        pull_number: this.context.pr.number,
        body: body
      });
      
      return {
        success: true,
        body: body
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async prClose(comment = '') {
    try {
      // Add closing comment if provided
      if (comment) {
        await this.prComment(comment);
      }
      
      await this.octokit.pulls.update({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        pull_number: this.context.pr.number,
        state: 'closed'
      });
      
      return {
        success: true,
        action: 'closed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async runTests(pattern = '**/*.test.js', framework = 'auto') {
    // Auto-detect test framework
    if (framework === 'auto') {
      try {
        const packageJson = await this.readFile('package.json');
        if (packageJson.success) {
          const pkg = JSON.parse(packageJson.content);
          if (pkg.devDependencies?.jest || pkg.dependencies?.jest) {
            framework = 'jest';
          } else if (pkg.devDependencies?.mocha || pkg.dependencies?.mocha) {
            framework = 'mocha';
          } else if (pkg.devDependencies?.pytest) {
            framework = 'pytest';
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    const testCommands = {
      jest: `npx jest ${pattern}`,
      mocha: `npx mocha ${pattern}`,
      pytest: `pytest ${pattern}`,
      auto: 'npm test'
    };
    
    const command = testCommands[framework] || testCommands.auto;
    
    return await this.runCommand(command, '.', true);
  }

  async getEnvVariable(name) {
    // Only allow safe environment variables
    const safeVars = [
      'NODE_ENV', 'CI', 'GITHUB_ACTIONS', 'GITHUB_WORKSPACE',
      'GITHUB_REPOSITORY', 'GITHUB_REF', 'GITHUB_SHA',
      'RUNNER_OS', 'RUNNER_ARCH'
    ];
    
    if (!safeVars.includes(name)) {
      return {
        success: false,
        error: 'Access to this environment variable is restricted',
        allowedVars: safeVars
      };
    }
    
    return {
      success: true,
      name: name,
      value: process.env[name] || null
    };
  }

  async accessSecret(name, reason) {
    // Log the secret access request
    this.logger.log('warn', 'Secret access requested', {
      name: name,
      reason: reason,
      actor: this.context.actor
    });
    
    // Add comment requesting approval
    if (this.context.pr) {
      await this.prComment(`## 🔐 Secret Access Request

**Secret Name:** ${name}
**Reason:** ${reason}
**Requested by:** Claude Code

⚠️ **Manual approval required** - A maintainer must approve this secret access.

To approve, comment: \`@prompt-expert approve-secret ${name}\`
`);
    }
    
    return {
      success: false,
      error: 'Secret access requires manual approval',
      name: name,
      reason: reason
    };
  }

  // === Issue Operations (for Issue context) ===
  
  async issueComment(body) {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    const comment = await this.octokit.issues.createComment({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.issue.number,
      body: `🤖 **Claude Code**\n\n${body}`
    });
    
    return {
      success: true,
      commentId: comment.data.id,
      url: comment.data.html_url
    };
  }

  async issueAddLabels(labels) {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    await this.octokit.issues.addLabels({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.issue.number,
      labels: labels
    });
    
    return {
      success: true,
      labels: labels,
      action: 'added'
    };
  }

  async issueRemoveLabels(labels) {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    for (const label of labels) {
      await this.octokit.issues.removeLabel({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        issue_number: this.context.issue.number,
        name: label
      });
    }
    
    return {
      success: true,
      labels: labels,
      action: 'removed'
    };
  }

  async issueAssign(assignees) {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    await this.octokit.issues.addAssignees({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.issue.number,
      assignees: assignees
    });
    
    return {
      success: true,
      assignees: assignees
    };
  }

  async issueUnassign(assignees) {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    await this.octokit.issues.removeAssignees({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.issue.number,
      assignees: assignees
    });
    
    return {
      success: true,
      assignees: assignees
    };
  }

  async issueUpdateTitle(title) {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    await this.octokit.issues.update({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.issue.number,
      title: title
    });
    
    return {
      success: true,
      title: title
    };
  }

  async issueUpdateBody(body) {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    await this.octokit.issues.update({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.issue.number,
      body: body
    });
    
    return {
      success: true,
      body: body
    };
  }

  async issueClose(reason = 'completed', comment = '') {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    // Add closing comment if provided
    if (comment) {
      await this.issueComment(comment);
    }
    
    await this.octokit.issues.update({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.issue.number,
      state: 'closed',
      state_reason: reason
    });
    
    return {
      success: true,
      action: 'closed',
      reason: reason
    };
  }

  async issueReopen(comment = '') {
    if (!this.context.issue) {
      return {
        success: false,
        error: 'Not in Issue context'
      };
    }
    
    // Add reopening comment if provided
    if (comment) {
      await this.issueComment(comment);
    }
    
    await this.octokit.issues.update({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.issue.number,
      state: 'open'
    });
    
    return {
      success: true,
      action: 'reopened'
    };
  }

  async runPromptABTest(args) {
    const { promptA, promptB, testCases = [], evaluationCriteria = [] } = args;
    
    // Generate test cases if none provided
    const tests = testCases.length > 0 ? testCases : [
      "Implement a basic function",
      "Handle error cases",
      "Optimize for performance"
    ];
    
    const resultsA = [];
    const resultsB = [];
    
    // Test both prompts
    for (const test of tests) {
      // Test Prompt A
      const responseA = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: `${promptA}\n\nTest: ${test}` }
        ]
      });
      resultsA.push({ test, response: responseA.content[0].text });
      
      // Test Prompt B
      const responseB = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: `${promptB}\n\nTest: ${test}` }
        ]
      });
      resultsB.push({ test, response: responseB.content[0].text });
    }
    
    // Compare results
    const comparison = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `Compare these two prompts and their results:

Prompt A: ${promptA}
Results A: ${JSON.stringify(resultsA, null, 2)}

Prompt B: ${promptB}
Results B: ${JSON.stringify(resultsB, null, 2)}

Evaluation Criteria: ${evaluationCriteria.join(', ')}

Determine which prompt performs better and provide specific recommendations.`
        }
      ]
    });
    
    return {
      success: true,
      promptA: { prompt: promptA, results: resultsA },
      promptB: { prompt: promptB, results: resultsB },
      comparison: comparison.content[0].text,
      testCases: tests
    };
  }

  async analyzePromptPerformance(args) {
    const { prompt, metrics = ['clarity', 'specificity', 'efficiency', 'robustness'] } = args;
    
    const analysis = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `Analyze this prompt across the following metrics: ${metrics.join(', ')}

Prompt: ${prompt}

For each metric, provide:
1. Score (1-10)
2. Strengths
3. Weaknesses
4. Specific improvements

Overall assessment and recommendations.`
        }
      ]
    });
    
    return {
      success: true,
      prompt: prompt,
      metrics: metrics,
      analysis: analysis.content[0].text
    };
  }
}

module.exports = ClaudeToolExecutor;