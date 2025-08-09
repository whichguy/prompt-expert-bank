/**
 * Optimized Claude Tool Executor with GitHub CLI and Caching
 * Enhanced with comprehensive logging and error checking
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

const { GitHubCLIAdapter } = require('./GitHubCLIAdapter');
const { RepositoryCache } = require('./RepositoryCache');
const { ErrorRecovery } = require('./ErrorRecovery');
const { StructuredLogger } = require('./StructuredLogger');

class ClaudeToolExecutorOptimized {
  constructor(octokit, context, anthropic, logger) {
    // Initialize logger with correlation ID
    this.logger = logger || new StructuredLogger({
      correlationId: `session-${Date.now()}`,
      context: {
        repository: context.repository?.fullName,
        pr: context.pr?.number,
        issue: context.issue?.number
      }
    });
    
    this.octokit = octokit;
    this.context = context;
    this.anthropic = anthropic;
    
    // Initialize optimized components
    this.ghCli = new GitHubCLIAdapter(this.logger);
    this.cache = new RepositoryCache({
      logger: this.logger,
      cacheDir: process.env.CACHE_DIR || '/tmp/claude-cache'
    });
    
    // Performance tracking
    this.metrics = {
      toolExecutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      ghCliCalls: 0,
      octokitCalls: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    // Error recovery configuration
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    this.retryDelay = 1000; // Start with 1 second delay
    
    // FIX: Add initialization flag
    this.initialized = false;
    
    this.logger.log('info', 'ClaudeToolExecutorOptimized initialized', {
      useGHCli: true,
      cacheEnabled: true,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Initialize all components
   */
  async initialize() {
    const initStart = Date.now();
    
    try {
      this.logger.log('info', 'Initializing optimized components...');
      
      // Initialize GitHub CLI
      try {
        await this.ghCli.verify();
        this.logger.log('info', '✅ GitHub CLI verified and ready');
      } catch (error) {
        this.logger.log('warn', '⚠️ GitHub CLI not available, falling back to Octokit', {
          error: error.message
        });
        this.useOctokitFallback = true;
      }
      
      // Initialize cache
      const cacheInitialized = await this.cache.init();
      if (cacheInitialized) {
        this.logger.log('info', '✅ Repository cache initialized');
        
        // Try to load cached context
        const cachedContext = await this.cache.getCachedContextData(this.context);
        if (cachedContext) {
          this.logger.log('info', '📦 Loaded context from cache', {
            age: Date.now() - cachedContext.timestamp
          });
          this.metrics.cacheHits++;
        }
      } else {
        this.logger.log('warn', '⚠️ Cache initialization failed, continuing without cache');
      }
      
      const initDuration = Date.now() - initStart;
      this.logger.log('info', `Initialization completed in ${initDuration}ms`);
      
      // FIX: Set initialization flag
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.log('error', 'Initialization failed', {
        error: error.message,
        stack: error.stack
      });
      
      // Continue without optimizations rather than failing
      return false;
    }
  }

  /**
   * Execute tool with comprehensive error handling and logging
   */
  async executeTool(tool) {
    // FIX: Check initialization
    if (!this.initialized) {
      throw new Error('Executor not initialized. Call initialize() first.');
    }
    
    const startTime = Date.now();
    const toolId = `${tool.name}-${Date.now()}`;
    
    this.logger.log('info', `🔧 Executing tool: ${tool.name}`, {
      toolId,
      arguments: tool.arguments
    });
    
    this.metrics.toolExecutions++;
    
    try {
      // Check if tool method exists
      if (!this[tool.name]) {
        throw new Error(`Tool ${tool.name} not implemented`);
      }
      
      // Execute with retry logic
      const result = await this.executeWithRetry(
        () => this[tool.name](tool.arguments),
        tool.name,
        toolId
      );
      
      const duration = Date.now() - startTime;
      
      this.logger.log('info', `✅ Tool ${tool.name} completed`, {
        toolId,
        duration,
        success: true
      });
      
      // Add performance metrics to result
      if (typeof result === 'object' && result !== null) {
        result._metrics = {
          duration,
          cacheUsed: result._fromCache || false
        };
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.errors++;
      
      this.logger.log('error', `❌ Tool ${tool.name} failed`, {
        toolId,
        duration,
        error: error.message,
        stack: error.stack
      });
      
      // Try to recover from specific errors
      const recovery = await this.attemptErrorRecovery(error, tool, toolId);
      if (recovery.success) {
        return recovery.result;
      }
      
      throw error;
    }
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry(func, operation, toolId) {
    let lastError;
    let delay = this.retryDelay;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.log('debug', `Attempt ${attempt}/${this.maxRetries} for ${operation}`, {
          toolId
        });
        
        return await func();
      } catch (error) {
        lastError = error;
        
        this.logger.log('warn', `Attempt ${attempt} failed for ${operation}`, {
          toolId,
          error: error.message,
          retriesLeft: this.maxRetries - attempt
        });
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          this.logger.log('error', 'Error is not retryable', {
            toolId,
            errorType: error.constructor.name
          });
          throw error;
        }
        
        // Wait before retry with exponential backoff
        if (attempt < this.maxRetries) {
          this.logger.log('info', `Waiting ${delay}ms before retry...`, { toolId });
          await this.sleep(delay);
          delay *= 2; // Exponential backoff
        }
      }
    }
    
    this.logger.log('error', `All ${this.maxRetries} attempts failed for ${operation}`, {
      toolId
    });
    
    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const message = error.message?.toLowerCase() || '';
    
    const retryablePatterns = [
      'rate limit',
      'timeout',
      'econnreset',
      'enotfound',
      'econnrefused',
      'socket hang up',
      'gateway timeout',
      '502',
      '503',
      '504',
      'index.lock'
    ];
    
    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Attempt to recover from specific errors
   */
  async attemptErrorRecovery(error, tool, toolId) {
    this.logger.log('info', '🔄 Attempting error recovery', {
      toolId,
      errorType: error.constructor.name
    });
    
    const message = error.message?.toLowerCase() || '';
    
    // Git lock recovery
    if (message.includes('index.lock')) {
      this.logger.log('info', 'Attempting to recover from git lock', { toolId });
      
      try {
        await execAsync('rm -f .git/index.lock');
        this.logger.log('info', 'Git lock removed, retrying operation', { toolId });
        
        // Retry the original operation
        const result = await this[tool.name](tool.arguments);
        return { success: true, result };
      } catch (recoveryError) {
        this.logger.log('error', 'Git lock recovery failed', {
          toolId,
          error: recoveryError.message
        });
      }
    }
    
    // Rate limit recovery
    if (message.includes('rate limit')) {
      const resetTime = this.extractRateLimitReset(error);
      if (resetTime) {
        const waitTime = Math.max(0, resetTime - Date.now());
        
        this.logger.log('info', `Rate limit hit, waiting ${waitTime}ms`, {
          toolId,
          resetTime: new Date(resetTime).toISOString()
        });
        
        await this.sleep(waitTime);
        
        try {
          const result = await this[tool.name](tool.arguments);
          return { success: true, result };
        } catch (recoveryError) {
          this.logger.log('error', 'Rate limit recovery failed', {
            toolId,
            error: recoveryError.message
          });
        }
      }
    }
    
    return { success: false };
  }

  /**
   * Extract rate limit reset time from error
   */
  extractRateLimitReset(error) {
    // Try to extract from various error formats
    const patterns = [
      /reset[s]? (?:at|in) (\d+)/i,
      /x-ratelimit-reset[:\s]+(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = error.message?.match(pattern);
      if (match) {
        const resetTime = parseInt(match[1]);
        // Check if it's a timestamp or duration
        if (resetTime > 1000000000) {
          return resetTime * 1000; // Convert seconds to milliseconds
        } else {
          return Date.now() + (resetTime * 1000); // Add duration to current time
        }
      }
    }
    
    return null;
  }

  // File Operations with Caching

  async read_file(args) {
    const { path: filePath } = args;
    const startTime = Date.now();
    
    this.logger.log('debug', `Reading file: ${filePath}`);
    
    try {
      // Check cache first
      const cacheKey = `file-${filePath}-${this.context.sha || 'latest'}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        this.logger.log('debug', `Cache hit for file: ${filePath}`, {
          duration: Date.now() - startTime
        });
        this.metrics.cacheHits++;
        return { ...cached, _fromCache: true };
      }
      
      this.metrics.cacheMisses++;
      
      // Read from filesystem or API
      let content;
      let encoding = 'utf8';
      
      // Try local file first
      try {
        const stats = await fs.stat(filePath);
        
        if (stats.size > 100 * 1024 * 1024) {
          throw new Error(`File too large: ${stats.size} bytes`);
        }
        
        // Detect binary files
        const ext = path.extname(filePath).toLowerCase();
        const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar', '.gz'];
        
        if (binaryExtensions.includes(ext)) {
          encoding = 'base64';
          content = await fs.readFile(filePath, 'base64');
        } else {
          content = await fs.readFile(filePath, 'utf8');
        }
        
        this.logger.log('debug', `Read local file: ${filePath}`, {
          size: stats.size,
          encoding,
          duration: Date.now() - startTime
        });
      } catch (localError) {
        // Fall back to API
        this.logger.log('debug', `Local read failed, trying API: ${filePath}`);
        
        const { data } = await this.octokit.repos.getContent({
          owner: this.context.repository.owner,
          repo: this.context.repository.name,
          path: filePath,
          ref: this.context.pr?.branch?.head || this.context.repository.defaultBranch
        });
        
        content = data.encoding === 'base64' 
          ? data.content 
          : Buffer.from(data.content, 'base64').toString('utf8');
        
        encoding = data.encoding;
      }
      
      const result = {
        path: filePath,
        content,
        encoding,
        size: Buffer.byteLength(content)
      };
      
      // Cache the result
      await this.cache.set(cacheKey, result, { ttl: 300000 }); // 5 minute TTL
      
      this.logger.log('info', `File read successfully: ${filePath}`, {
        size: result.size,
        encoding,
        duration: Date.now() - startTime,
        cached: false
      });
      
      return result;
    } catch (error) {
      this.logger.log('error', `Failed to read file: ${filePath}`, {
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async write_file(args) {
    const { path: filePath, content, encoding = 'utf8' } = args;
    const startTime = Date.now();
    
    this.logger.log('info', `Writing file: ${filePath}`, {
      size: Buffer.byteLength(content),
      encoding
    });
    
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      if (encoding === 'base64') {
        await fs.writeFile(filePath, content, 'base64');
      } else {
        await fs.writeFile(filePath, content, 'utf8');
      }
      
      // Invalidate cache
      const cacheKey = `file-${filePath}-${this.context.sha || 'latest'}`;
      await this.cache.delete(cacheKey);
      
      this.logger.log('info', `File written successfully: ${filePath}`, {
        size: Buffer.byteLength(content),
        duration: Date.now() - startTime
      });
      
      return {
        success: true,
        path: filePath,
        size: Buffer.byteLength(content)
      };
    } catch (error) {
      this.logger.log('error', `Failed to write file: ${filePath}`, {
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  // PR Operations with GitHub CLI

  async pr_add_labels(args) {
    const { labels } = args;
    const startTime = Date.now();
    
    this.logger.log('info', `Adding PR labels: ${labels.join(', ')}`);
    
    try {
      if (!this.useOctokitFallback) {
        // Use GitHub CLI
        await this.ghCli.addPRLabels(
          this.context.repository.fullName,
          this.context.pr.number,
          labels
        );
        this.metrics.ghCliCalls++;
      } else {
        // Fall back to Octokit
        await this.octokit.issues.addLabels({
          owner: this.context.repository.owner,
          repo: this.context.repository.name,
          issue_number: this.context.pr.number,
          labels
        });
        this.metrics.octokitCalls++;
      }
      
      this.logger.log('info', `PR labels added successfully`, {
        labels,
        duration: Date.now() - startTime,
        method: this.useOctokitFallback ? 'octokit' : 'gh-cli'
      });
      
      return { success: true, labels };
    } catch (error) {
      this.logger.log('error', 'Failed to add PR labels', {
        error: error.message,
        labels,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async pr_comment(args) {
    const { body } = args;
    const startTime = Date.now();
    
    this.logger.log('info', 'Adding PR comment', {
      bodyLength: body.length
    });
    
    try {
      let result;
      
      if (!this.useOctokitFallback) {
        // Use GitHub CLI
        await this.ghCli.addPRComment(
          this.context.repository.fullName,
          this.context.pr.number,
          body
        );
        this.metrics.ghCliCalls++;
        result = { success: true };
      } else {
        // Fall back to Octokit
        const { data } = await this.octokit.issues.createComment({
          owner: this.context.repository.owner,
          repo: this.context.repository.name,
          issue_number: this.context.pr.number,
          body
        });
        this.metrics.octokitCalls++;
        result = { success: true, id: data.id };
      }
      
      this.logger.log('info', 'PR comment added successfully', {
        duration: Date.now() - startTime,
        method: this.useOctokitFallback ? 'octokit' : 'gh-cli'
      });
      
      return result;
    } catch (error) {
      this.logger.log('error', 'Failed to add PR comment', {
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async pr_review(args) {
    const { body, event = 'COMMENT', comments = [] } = args;
    const startTime = Date.now();
    
    this.logger.log('info', `Creating PR review: ${event}`, {
      hasComments: comments.length > 0
    });
    
    try {
      let result;
      
      if (!this.useOctokitFallback && comments.length === 0) {
        // Use GitHub CLI for simple reviews
        await this.ghCli.createPRReview(
          this.context.repository.fullName,
          this.context.pr.number,
          body,
          event
        );
        this.metrics.ghCliCalls++;
        result = { success: true };
      } else {
        // Use Octokit for complex reviews with inline comments
        const { data } = await this.octokit.pulls.createReview({
          owner: this.context.repository.owner,
          repo: this.context.repository.name,
          pull_number: this.context.pr.number,
          body,
          event,
          comments: comments.map(c => ({
            path: c.path,
            line: c.line || c.position,
            body: c.body
          }))
        });
        this.metrics.octokitCalls++;
        result = { success: true, id: data.id };
      }
      
      this.logger.log('info', 'PR review created successfully', {
        event,
        commentsCount: comments.length,
        duration: Date.now() - startTime,
        method: this.useOctokitFallback || comments.length > 0 ? 'octokit' : 'gh-cli'
      });
      
      return result;
    } catch (error) {
      this.logger.log('error', 'Failed to create PR review', {
        error: error.message,
        event,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  // Git Operations with Error Recovery

  async git_command(args) {
    const { command, safe = true } = args;
    const startTime = Date.now();
    
    this.logger.log('info', `Executing git command: ${command}`, {
      safe
    });
    
    // Safety check
    if (safe) {
      const dangerousPatterns = [
        /force|--force|-f/i,
        /reset\s+--hard/i,
        /clean\s+-[fd]/i,
        /rm\s+-rf/i
      ];
      
      if (dangerousPatterns.some(pattern => pattern.test(command))) {
        const error = new Error(`Dangerous git command blocked: ${command}`);
        this.logger.log('error', 'Dangerous git command blocked', {
          command,
          duration: Date.now() - startTime
        });
        throw error;
      }
    }
    
    try {
      const { stdout, stderr } = await execAsync(`git ${command}`);
      
      if (stderr) {
        this.logger.log('warn', 'Git command produced stderr', {
          command,
          stderr,
          duration: Date.now() - startTime
        });
      }
      
      this.logger.log('info', 'Git command executed successfully', {
        command,
        outputLength: stdout.length,
        duration: Date.now() - startTime
      });
      
      return {
        success: true,
        stdout,
        stderr
      };
    } catch (error) {
      this.logger.log('error', 'Git command failed', {
        command,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        duration: Date.now() - startTime
      });
      
      // Try recovery for common git errors
      if (error.message.includes('index.lock')) {
        this.logger.log('info', 'Attempting to recover from git lock');
        await execAsync('rm -f .git/index.lock');
        
        // Retry the command
        const { stdout, stderr } = await execAsync(`git ${command}`);
        return { success: true, stdout, stderr, recovered: true };
      }
      
      throw error;
    }
  }

  // Performance Monitoring

  /**
   * Validate tool arguments
   */
  validateToolArguments(toolName, args) {
    // Add specific validation for each tool
    const validations = {
      'pr.update': () => {
        if (!args.pull_number || !args.owner || !args.repo) {
          throw new Error('Missing required arguments for pr.update');
        }
      },
      'pr.files.list': () => {
        if (!args.pull_number || !args.owner || !args.repo) {
          throw new Error('Missing required arguments for pr.files.list');
        }
      },
      // Add more validations as needed
    };
    
    if (validations[toolName]) {
      validations[toolName]();
    }
  }

  async getPerformanceReport() {
    const duration = Date.now() - this.metrics.startTime;
    const cacheStats = this.cache.getStats();
    
    const report = {
      duration,
      metrics: this.metrics,
      cache: cacheStats,
      performance: {
        avgToolExecutionTime: duration / Math.max(1, this.metrics.toolExecutions),
        cacheHitRate: cacheStats.hitRate,
        errorRate: `${(this.metrics.errors / Math.max(1, this.metrics.toolExecutions) * 100).toFixed(1)}%`,
        ghCliUsage: `${(this.metrics.ghCliCalls / Math.max(1, this.metrics.ghCliCalls + this.metrics.octokitCalls) * 100).toFixed(1)}%`
      }
    };
    
    this.logger.log('info', '📊 Performance Report', report);
    
    return report;
  }

  // Helper methods

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Additional tool implementations would go here...
  // For brevity, I'm including a few key ones:

  async search_repository(args) {
    const { pattern, path: searchPath = '.', fileType } = args;
    const startTime = Date.now();
    
    this.logger.log('info', `Searching repository for: ${pattern}`);
    
    try {
      // Check cache first
      const cacheKey = `search-${pattern}-${searchPath}-${fileType || 'all'}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        this.logger.log('debug', 'Search results from cache', {
          pattern,
          duration: Date.now() - startTime
        });
        this.metrics.cacheHits++;
        return { ...cached, _fromCache: true };
      }
      
      this.metrics.cacheMisses++;
      
      // Use ripgrep if available (much faster)
      let results;
      try {
        const fileTypeFlag = fileType ? `--type ${fileType}` : '';
        const { stdout } = await execAsync(
          `rg --json "${pattern}" ${searchPath} ${fileTypeFlag}`
        );
        
        results = stdout.split('\n')
          .filter(line => line)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(r => r && r.type === 'match');
        
        this.logger.log('info', `Found ${results.length} matches using ripgrep`, {
          pattern,
          duration: Date.now() - startTime
        });
      } catch (rgError) {
        // Fall back to grep
        this.logger.log('debug', 'Ripgrep not available, using grep');
        
        const { stdout } = await execAsync(
          `grep -r "${pattern}" ${searchPath} || true`
        );
        
        results = stdout.split('\n')
          .filter(line => line)
          .map(line => {
            const [file, ...content] = line.split(':');
            return {
              path: { text: file },
              lines: { text: content.join(':') }
            };
          });
      }
      
      // Cache results
      await this.cache.set(cacheKey, results, { ttl: 60000 }); // 1 minute TTL
      
      this.logger.log('info', 'Search completed', {
        pattern,
        matchCount: results.length,
        duration: Date.now() - startTime
      });
      
      return results;
    } catch (error) {
      this.logger.log('error', 'Search failed', {
        pattern,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async list_directory(args) {
    const { path: dirPath = '.', recursive = false } = args;
    const startTime = Date.now();
    
    this.logger.log('debug', `Listing directory: ${dirPath}`, { recursive });
    
    try {
      // Check cache
      const cacheKey = `dir-${dirPath}-${recursive}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        this.logger.log('debug', 'Directory listing from cache', {
          path: dirPath,
          duration: Date.now() - startTime
        });
        this.metrics.cacheHits++;
        return { ...cached, _fromCache: true };
      }
      
      this.metrics.cacheMisses++;
      
      const files = [];
      
      async function readDir(dir, baseDir = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(baseDir, entry.name);
          
          if (entry.isDirectory()) {
            files.push({
              path: relativePath,
              type: 'directory'
            });
            
            if (recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await readDir(fullPath, relativePath);
            }
          } else {
            const stats = await fs.stat(fullPath);
            files.push({
              path: relativePath,
              type: 'file',
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      }
      
      await readDir(dirPath);
      
      // Cache results
      await this.cache.set(cacheKey, files, { ttl: 60000 });
      
      this.logger.log('info', 'Directory listed successfully', {
        path: dirPath,
        fileCount: files.length,
        duration: Date.now() - startTime
      });
      
      return files;
    } catch (error) {
      this.logger.log('error', 'Failed to list directory', {
        path: dirPath,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
}

module.exports = ClaudeToolExecutorOptimized;