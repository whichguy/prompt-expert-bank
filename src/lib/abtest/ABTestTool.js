/**
 * @fileoverview ABTest Tool for Comparative Prompt Analysis
 * @description Performs expert evaluation comparing two prompt versions with LLM-as-Judge methodology
 * @module ABTestTool
 * @requires @octokit/rest
 * @author Prompt Expert Team
 * @version 2.0.0
 */

const { Octokit } = require('@octokit/rest');
const path = require('path');
const fs = require('fs').promises;

/**
 * @class ABTestTool
 * @description Manages A/B testing of prompts using expert evaluation methodology
 * @property {Octokit} octokit - GitHub API client
 * @property {Anthropic} anthropic - Anthropic Claude API client
 * @property {string} repoOwner - Repository owner
 * @property {string} repoName - Repository name
 * @property {string} workspace - Local workspace path
 * @property {Map} contentCache - Content cache with TTL
 * @property {number} cacheTimeout - Cache timeout in milliseconds
 * @property {Object} metrics - Performance metrics tracking
 */
class ABTestTool {
  /**
   * @constructor
   * @param {Object} options - Configuration options
   * @param {Octokit} options.octokit - GitHub API client
   * @param {Anthropic} options.anthropic - Anthropic API client
   * @param {string} options.repoOwner - Repository owner
   * @param {string} options.repoName - Repository name
   * @param {string} options.workspace - Workspace directory
   */
  constructor(options) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    this.workspace = options.workspace;
    
    // Template paths
    this.templateDir = path.join(__dirname, 'templates');
    
    // Cache for fetched content (24 hour TTL)
    this.contentCache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    // Performance tracking
    this.startTime = null;
    this.metrics = {
      fetchTime: 0,
      evaluationTime: 0,
      totalTime: 0
    };
  }

  /**
   * @method executeABTest
   * @async
   * @description Main ABTest execution - compares two prompts using expert evaluation
   * @param {string} pathToExpertPromptDefinition - GitHub path to expert definition file
   *   Format: "path/in/repo/file.md" (fetched from current repo context)
   *   OR: "owner/repo:path/to/file.md" (fetched from specified repo)
   *   Default experts available at: whichguy/prompt-expert-bank/experts/
   *   Example: "experts/programming-expert.md" fetches from current repo
   *   Example: "whichguy/prompt-expert-bank:experts/programming-expert.md" explicit repo
   * @param {string} pathToPromptA - GitHub path to baseline prompt (fetched via API)
   *   Format: "path/to/file.md@ref" where ref = branch/tag/commit
   *   Example: "prompts/code-reviewer.md@main" fetches from main branch
   * @param {string} pathToPromptB - GitHub path to variant prompt (fetched via API)
   *   Format: "path/to/file.md@ref" or "path/to/file.md" (defaults to HEAD)
   *   Example: "prompts/code-reviewer.md" fetches current PR version
   * @param {Array<string>} [testContextPaths=[]] - Optional array of paths to reference materials for testing
   * @param {number} [iterationCount=0] - Number of previous improvement iterations (for leniency adjustment)
   * @returns {Promise<Object>} Comparative analysis results with expert verdict
   * @throws {Error} If path verification fails or content cannot be fetched
   */
  async executeABTest(pathToExpertPromptDefinition, pathToPromptA, pathToPromptB, testContextPaths = [], iterationCount = 0) {
    try {
      // Start performance tracking
      this.startTime = Date.now();
      
      // Input validation
      this.validateInputs(pathToExpertPromptDefinition, pathToPromptA, pathToPromptB, testContextPaths);
      
      // Check if comparing identical versions
      if (pathToPromptA === pathToPromptB) {
        return {
          success: false,
          error: 'Identical versions provided',
          details: 'PromptA and PromptB are the same. Please provide different versions to compare.',
          suggestion: 'Use version specifiers like @main, @v1.0, or @commit-sha'
        };
      }
      
      console.log('Starting A/B test...');
      
      // Parse paths to extract file path and version info
      const expertInfo = this.parsePath(pathToExpertPromptDefinition);
      const promptAInfo = this.parsePath(pathToPromptA);
      const promptBInfo = this.parsePath(pathToPromptB);

      // VERIFICATION PHASE: Check all paths exist before processing
      console.log('Verifying all paths exist...');
      const verificationResults = await this.verifyPathsExist({
        expert: expertInfo,
        promptA: promptAInfo,
        promptB: promptBInfo,
        testContextPaths: testContextPaths
      });
      
      if (!verificationResults.success) {
        return {
          success: false,
          error: 'Path verification failed',
          details: verificationResults.errors.join('\n'),
          missingPaths: verificationResults.missingPaths,
          suggestion: 'Please verify all file paths exist and are accessible. Use "experts/" for expert definitions, not "expert-definitions/".'
        };
      }
      
      console.log('All paths verified successfully.');

      // Fetch phase
      const fetchStart = Date.now();
      console.log('Fetching content...');
      
      // Fetch expert definition
      const expertPrompt = await this.fetchContent(expertInfo);
      
      // Fetch both prompt versions
      const promptA = await this.fetchContent(promptAInfo);
      const promptB = await this.fetchContent(promptBInfo);

      // Fetch test context materials if provided
      const testContext = await this.fetchTestContext(testContextPaths);
      
      this.metrics.fetchTime = Date.now() - fetchStart;
      console.log(`Content fetched in ${(this.metrics.fetchTime/1000).toFixed(1)}s`);

      // Evaluation phase
      const evalStart = Date.now();
      console.log('Running evaluations...');
      
      // Add iteration context if provided
      if (iterationCount > 0) {
        console.log(`Iteration #${iterationCount + 1} - Adjusting evaluation for improvement cycles`);
      }
      
      // Run 3-thread evaluation for each prompt with test context
      const evaluationA = await this.runThreeThreadEvaluation(expertPrompt, promptA, promptAInfo, testContext, iterationCount);
      const evaluationB = await this.runThreeThreadEvaluation(expertPrompt, promptB, promptBInfo, testContext, iterationCount);
      
      this.metrics.evaluationTime = Date.now() - evalStart;
      console.log(`Evaluations completed in ${(this.metrics.evaluationTime/1000).toFixed(1)}s`);

      // Perform comparative analysis
      const comparison = await this.compareEvaluations(
        expertPrompt,
        evaluationA,
        evaluationB,
        promptAInfo,
        promptBInfo
      );

      // Generate expert verdict
      const verdict = await this.generateExpertVerdict(
        expertPrompt,
        comparison,
        promptAInfo,
        promptBInfo
      );

      return {
        success: true,
        testConfiguration: {
          expert: expertInfo,
          promptA: promptAInfo,
          promptB: promptBInfo,
          testContext: testContextPaths
        },
        evaluations: {
          promptA: evaluationA,
          promptB: evaluationB
        },
        comparison: comparison,
        verdict: verdict,
        summary: this.generateSummary(verdict)
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * @method validateInputs
   * @description Validates input paths and parameters
   * @param {string} expertPath - Expert definition path
   * @param {string} promptA - First prompt path
   * @param {string} promptB - Second prompt path
   * @param {Array} testPaths - Test context paths
   * @throws {Error} If any validation fails
   * @private
   */
  validateInputs(expertPath, promptA, promptB, testPaths) {
    if (!expertPath) {
      throw new Error('Expert definition path is required');
    }
    if (!promptA) {
      throw new Error('PromptA path is required');
    }
    if (!promptB) {
      throw new Error('PromptB path is required');
    }
    
    // Validate path formats
    const pathRegex = /^([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+:)?[a-zA-Z0-9_\-\/\.]+(@[a-zA-Z0-9_\-\.]+)?$/;
    
    if (!pathRegex.test(expertPath)) {
      throw new Error(`Invalid expert path format: ${expertPath}`);
    }
    if (!pathRegex.test(promptA)) {
      throw new Error(`Invalid promptA path format: ${promptA}`);
    }
    if (!pathRegex.test(promptB)) {
      throw new Error(`Invalid promptB path format: ${promptB}`);
    }
    
    // Validate test paths if provided
    if (testPaths && !Array.isArray(testPaths)) {
      throw new Error('Test context paths must be an array');
    }
    
    if (testPaths && testPaths.length > 20) {
      throw new Error('Too many test context paths (max 20)');
    }
  }
  
  /**
   * @method handleError
   * @description Handles errors with contextual information and suggestions
   * @param {Error} error - Error object
   * @returns {Object} Formatted error response
   * @private
   */
  handleError(error) {
    const errorResponse = {
      success: false,
      error: error.message || 'Unknown error',
      details: error.stack || 'No stack trace available'
    };
    
    // Add helpful context based on error type
    if (error.message.includes('Not Found')) {
      errorResponse.suggestion = 'Verify the file path and repository permissions';
      errorResponse.checklist = [
        'Ensure file exists in the repository',
        'Check branch/tag/commit reference is valid',
        'Verify repository name if using cross-repo format',
        'Confirm GitHub token has repository access'
      ];
    } else if (error.message.includes('rate limit')) {
      errorResponse.suggestion = 'GitHub API rate limit exceeded';
      errorResponse.retry = 'Wait 60 seconds and try again';
    } else if (error.message.includes('timeout')) {
      errorResponse.suggestion = 'Request timed out - try with smaller test context';
    } else if (error.message.includes('Network')) {
      errorResponse.suggestion = 'Network error - check connection and try again';
    }
    
    return errorResponse;
  }
  
  /**
   * Fetch test context materials
   * Supports files, directories, and cross-repository references
   */
  async fetchTestContext(contextPaths) {
    const context = {
      files: [],
      directories: [],
      totalSize: 0,
      maxSize: 102400, // 100KB limit
      summary: []
    };

    for (const path of contextPaths) {
      try {
        const pathInfo = this.parsePath(path);
        
        // Check if it's a directory by trying to list contents
        try {
          const { data } = await this.octokit.repos.getContent({
            owner: pathInfo.owner,
            repo: pathInfo.repo,
            path: pathInfo.filePath,
            ref: pathInfo.version
          });

          if (Array.isArray(data)) {
            // It's a directory
            context.directories.push({
              path: pathInfo.filePath,
              fileCount: data.length,
              files: data.map(f => f.name)
            });
            
            // Fetch first few files as samples
            const samples = data.slice(0, 3);
            for (const file of samples) {
              if (file.type === 'file') {
                const content = await this.fetchContent({
                  ...pathInfo,
                  filePath: file.path
                });
                // Check size limit
                if (context.totalSize + content.size > context.maxSize) {
                  context.summary.push(`⚠ Skipped ${file.path} - would exceed size limit`);
                  continue;
                }
                
                context.files.push({
                  path: file.path,
                  name: file.name,
                  content: content.content.substring(0, 1000) + '...',
                  size: content.size
                });
                context.totalSize += content.size;
              }
            }
          } else {
            // It's a file
            const content = await this.fetchContent(pathInfo);
            context.files.push({
              path: pathInfo.filePath,
              name: pathInfo.filePath.split('/').pop(),
              content: content.content,
              size: content.size
            });
            context.totalSize += content.size;
          }
        } catch (error) {
          // Try as single file
          const content = await this.fetchContent(pathInfo);
          context.files.push({
            path: pathInfo.filePath,
            name: pathInfo.filePath.split('/').pop(),
            content: content.content,
            size: content.size
          });
          context.totalSize += content.size;
        }

        context.summary.push(`✓ Loaded: ${pathInfo.filePath}`);
      } catch (error) {
        context.summary.push(`✗ Failed: ${path} - ${error.message}`);
      }
    }

    return context;
  }

  /**
   * Parse path to extract file path and version information
   * Supports formats:
   * - "path/to/file.md" (latest version)
   * - "path/to/file.md@v1" (tag)
   * - "path/to/file.md@branch-name" (branch)
   * - "path/to/file.md@3a5f8e2" (commit SHA)
   * - "owner/repo:path/to/file.md@version" (cross-repo)
   */
  /**
   * @method parsePath
   * @description Parses GitHub path string into components
   * @param {string} pathString - Path string to parse
   * @returns {Object} Parsed path information
   * @returns {string} returns.owner - Repository owner
   * @returns {string} returns.repo - Repository name
   * @returns {string} returns.filePath - File path
   * @returns {string} returns.version - Version reference
   * @returns {string} returns.fullPath - Original full path
   * @private
   */
  parsePath(pathString) {
    let owner = this.repoOwner;
    let repo = this.repoName;
    let filePath = pathString;
    let version = 'HEAD';

    // Check for cross-repo format
    if (pathString.includes(':')) {
      const [repopart, filepart] = pathString.split(':');
      if (repopart.includes('/')) {
        [owner, repo] = repopart.split('/');
        filePath = filepart;
      }
    }

    // Check for version specification
    if (filePath.includes('@')) {
      const parts = filePath.split('@');
      filePath = parts[0];
      version = parts[1];
    }

    return {
      owner,
      repo,
      filePath,
      version,
      fullPath: pathString
    };
  }

  /**
   * @method verifyPathsExist
   * @async
   * @description Verifies that all paths exist before processing to fail fast
   * @param {Object} paths - Object containing all paths to verify
   * @param {Object} paths.expert - Expert definition path info
   * @param {Object} paths.promptA - PromptA path info
   * @param {Object} paths.promptB - PromptB path info
   * @param {Array<string>} [paths.testContextPaths] - Test context paths
   * @returns {Promise<Object>} Verification results
   * @returns {boolean} returns.success - Whether all paths exist
   * @returns {Array<string>} returns.errors - Error messages
   * @returns {Array<Object>} returns.missingPaths - Details of missing paths
   * @private
   */
  async verifyPathsExist(paths) {
    const errors = [];
    const missingPaths = [];
    
    // Helper function to check if a path exists with retry logic
    const checkPath = async (pathInfo, label) => {
      const maxRetries = 3;
      const baseDelay = 1000;
      let lastError = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // If this is a retry, wait with exponential backoff
          if (attempt > 0) {
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
            console.log(`  Retrying path verification (${attempt}/${maxRetries}) after ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const response = await this.octokit.repos.getContent({
            owner: pathInfo.owner,
            repo: pathInfo.repo,
            path: pathInfo.filePath,
            ref: pathInfo.version === 'HEAD' ? undefined : pathInfo.version
          });
          
          // Check if we got an HTML error page instead of JSON
          if (typeof response === 'string' && response.includes('<!DOCTYPE html>')) {
            throw new Error('Received HTML error page instead of JSON response - GitHub API server error');
          }
          
          return true; // Path exists
        } catch (error) {
          lastError = error;
          
          // Check if this is a 404 - file genuinely doesn't exist
          if (error.status === 404) {
            const fullPath = `${pathInfo.owner}/${pathInfo.repo}:${pathInfo.filePath}${pathInfo.version !== 'HEAD' ? '@' + pathInfo.version : ''}`;
            errors.push(`${label} not found: ${fullPath}`);
            missingPaths.push({
              label,
              path: fullPath,
              error: 'File not found (404)',
              httpStatus: 404
            });
            
            // Add helpful hint for common mistakes
            if (pathInfo.filePath.includes('expert-definitions/')) {
              errors.push(`  Hint: Expert files are in "experts/" folder, not "expert-definitions/"`);
              errors.push(`  Try: ${pathInfo.filePath.replace('expert-definitions/', 'experts/')}`);
            }
            return false; // Don't retry 404s
          }
          
          // Check if this is a retryable error
          const isRetryable = this.isRetryableError(error);
          
          if (!isRetryable || attempt === maxRetries) {
            // Not retryable or final attempt
            const fullPath = `${pathInfo.owner}/${pathInfo.repo}:${pathInfo.filePath}${pathInfo.version !== 'HEAD' ? '@' + pathInfo.version : ''}`;
            const errorMsg = error.message || error.toString();
            
            // Check if it's an HTML error page
            if (errorMsg.includes('HTML error page')) {
              errors.push(`${label} verification failed: GitHub API returned HTML error page (likely 5xx server error)`);
              errors.push(`  Path: ${fullPath}`);
              errors.push(`  This is usually a temporary GitHub server issue. Please try again in a few moments.`);
            } else {
              errors.push(`${label} verification failed: ${errorMsg}`);
              errors.push(`  Path: ${fullPath}`);
            }
            
            missingPaths.push({
              label,
              path: fullPath,
              error: errorMsg,
              httpStatus: error.status || 'unknown',
              attempts: attempt + 1
            });
            
            return false;
          }
          
          // Log retry information
          console.log(`  Verification failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`);
        }
      }
      
      return false; // Should not reach here
    };
    
    // Verify expert definition
    console.log(`Verifying expert: ${paths.expert.filePath}`);
    await checkPath(paths.expert, 'Expert definition');
    
    // Verify promptA
    console.log(`Verifying promptA: ${paths.promptA.filePath}`);
    await checkPath(paths.promptA, 'PromptA');
    
    // Verify promptB
    console.log(`Verifying promptB: ${paths.promptB.filePath}`);
    await checkPath(paths.promptB, 'PromptB');
    
    // Verify test context paths if provided
    if (paths.testContextPaths && paths.testContextPaths.length > 0) {
      for (const testPath of paths.testContextPaths) {
        const testPathInfo = this.parsePath(testPath);
        console.log(`Verifying test context: ${testPathInfo.filePath}`);
        await checkPath(testPathInfo, `Test context: ${testPath}`);
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
      missingPaths
    };
  }

  /**
   * @method fetchContent
   * @async
   * @description Fetches content from GitHub with version support, caching, and retry logic
   * @param {Object} pathInfo - Parsed path information
   * @param {string} pathInfo.owner - Repository owner
   * @param {string} pathInfo.repo - Repository name
   * @param {string} pathInfo.filePath - File path in repository
   * @param {string} pathInfo.version - Version reference (branch/tag/commit)
   * @returns {Promise<string>} File content
   * @throws {Error} If content cannot be fetched after retries
   * @private
   */
  async fetchContent(pathInfo) {
    // Check cache first
    const cacheKey = `${pathInfo.owner}/${pathInfo.repo}/${pathInfo.filePath}@${pathInfo.version}`;
    const cached = this.contentCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
      console.log(`Cache hit: ${cacheKey}`);
      return cached.data;
    }
    
    // Implement retry with exponential backoff
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // If this is a retry, wait with exponential backoff
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Add jitter
          console.log(`Retry attempt ${attempt}/${maxRetries} after ${Math.round(delay)}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Make the API request
        const { data } = await this.octokit.repos.getContent({
          owner: pathInfo.owner,
          repo: pathInfo.repo,
          path: pathInfo.filePath,
          ref: pathInfo.version === 'HEAD' ? undefined : pathInfo.version
        });

        // Validate response is not HTML error page
        if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
          throw new Error('Received HTML error page instead of JSON response - GitHub API server error');
        }

        // Decode base64 content
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        
        // Validate content is not empty
        if (!content || content.trim().length === 0) {
          throw new Error(`File ${pathInfo.filePath} is empty`);
        }
        
        // Warn if file is very large
        if (data.size > 50000) {
          console.warn(`Warning: ${pathInfo.filePath} is large (${(data.size/1024).toFixed(1)}KB)`);
        }
        
        const result = {
          content,
          sha: data.sha,
          size: data.size,
          path: pathInfo.filePath,
          version: pathInfo.version,
          url: data.html_url
        };
        
        // Cache the result
        this.contentCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === maxRetries) {
          // Not retryable or final attempt - throw the error
          const errorMsg = `Failed to fetch ${pathInfo.fullPath} after ${attempt + 1} attempts:\n` +
                          `  Repository: ${pathInfo.owner}/${pathInfo.repo}\n` +
                          `  File: ${pathInfo.filePath}\n` +
                          `  Version: ${pathInfo.version}\n` +
                          `  Error: ${error.message || error.toString()}\n` +
                          `  HTTP Status: ${error.status || 'unknown'}`;
          throw new Error(errorMsg);
        }
        
        // Log retry information
        console.log(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`);
        if (error.status) {
          console.log(`HTTP Status: ${error.status}`);
        }
      }
    }
    
    // Should never reach here, but just in case
    throw lastError || new Error('Failed to fetch content after all retries');
  }
  
  /**
   * @method isRetryableError
   * @description Determines if an error is retryable based on HTTP status codes
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is retryable
   * @private
   */
  isRetryableError(error) {
    // Check if error has a status code
    if (!error.status) {
      // Network errors, timeouts, etc. are retryable
      const message = error.message || error.toString();
      if (message.includes('ECONNRESET') || 
          message.includes('ETIMEDOUT') || 
          message.includes('ENOTFOUND') ||
          message.includes('Network') ||
          message.includes('HTML error page')) {
        return true;
      }
      return false;
    }
    
    // HTTP status codes that are retryable
    const retryableStatuses = [
      408, // Request Timeout
      429, // Too Many Requests (rate limit)
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
      520, // Cloudflare: Unknown Error
      521, // Cloudflare: Web Server Is Down
      522, // Cloudflare: Connection Timed Out
      523, // Cloudflare: Origin Is Unreachable
      524, // Cloudflare: A Timeout Occurred
    ];
    
    return retryableStatuses.includes(error.status);
  }

  /**
   * Run 3-thread evaluation for a prompt
   */
  async runThreeThreadEvaluation(expertPrompt, promptContent, promptInfo, testContext = null, iterationCount = 0) {
    // Adjust evaluation based on iteration count
    const leniencyFactor = iterationCount >= 3 ? 0.5 : iterationCount >= 2 ? 0.3 : 0;
    
    // Simulate evaluation with three different approaches
    const threads = [];

    // Thread 1: Structural analysis
    threads.push(await this.evaluateStructure(expertPrompt, promptContent, testContext, iterationCount));

    // Thread 2: Domain expertise analysis
    threads.push(await this.evaluateDomainExpertise(expertPrompt, promptContent, testContext, iterationCount));

    // Thread 3: Effectiveness analysis with test context
    threads.push(await this.evaluateEffectiveness(expertPrompt, promptContent, testContext, iterationCount));

    // Aggregate scores with leniency adjustment
    let aggregateScore = threads.reduce((sum, t) => sum + t.score, 0) / threads.length;
    
    // Apply leniency for multiple iterations
    if (leniencyFactor > 0) {
      aggregateScore = Math.min(10, aggregateScore + leniencyFactor);
      console.log(`Applied iteration leniency: +${leniencyFactor} (iteration ${iterationCount + 1})`);
    }

    return {
      promptInfo,
      threads,
      aggregateScore,
      strengths: this.extractStrengths(threads),
      weaknesses: this.extractWeaknesses(threads),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * @method callClaudeWithRetry
   * @async
   * @description Calls Claude API with retry logic and exponential backoff
   * @param {Object} payload - API request payload
   * @returns {Promise<Object>} Claude API response
   * @throws {Error} If all retry attempts fail
   * @private
   */
  async callClaudeWithRetry(payload) {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay for Claude API
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // If this is a retry, wait with exponential backoff
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Add jitter
          console.log(`Retrying Claude API call (attempt ${attempt}/${maxRetries}) after ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Make the API call
        const response = await this.anthropic.messages.create(payload);
        
        // Success - return the response
        if (attempt > 0) {
          console.log(`Claude API call succeeded after ${attempt} retries`);
        }
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isClaudeErrorRetryable(error);
        
        if (!isRetryable || attempt === maxRetries) {
          // Not retryable or final attempt - throw the error
          console.error(`Claude API call failed after ${attempt + 1} attempts:`, error.message);
          throw error;
        }
        
        // Log retry information
        console.log(`Claude API call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`);
        if (error.status) {
          console.log(`HTTP Status: ${error.status}`);
        }
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
   * Evaluate structural aspects of the prompt
   */
  async evaluateStructure(expertPrompt, promptContent, testContext, iterationCount = 0) {
    // Prepare template replacements
    const replacements = {
      EVALUATION_TYPE: 'Structural',
      EVALUATION_TYPE_DESCRIPTION: 'Evaluating the organization, clarity, and logical structure of the prompt',
      EXPERT_DEFINITION: expertPrompt.content.substring(0, 500) + '...',
      ITERATION_CONTEXT: iterationCount > 0 
        ? `This is iteration ${iterationCount + 1} of improvements. Be ${iterationCount >= 3 ? 'more lenient' : 'reasonably lenient'} in evaluation.`
        : 'This is the first evaluation.',
      TEST_CONTEXT: testContext 
        ? `Test context available: ${testContext.files.length} files, ${testContext.directories.length} directories`
        : 'No test context provided.',
      EVALUATION_CRITERIA: `1. Clarity and organization
2. Completeness of instructions
3. Logical flow
4. Appropriate level of detail
5. Alignment with provided test context`,
      EVALUATION_FOCUS: 'structural quality and organization',
      DOMAIN: 'structural analysis',
      SPECIAL_INSTRUCTIONS: 'Pay attention to how well the prompt guides the user',
      LENIENCY_NOTE: iterationCount >= 3 
        ? 'Note: After 3+ iterations, focus on whether the prompt is reasonably good rather than perfect.'
        : '',
      PROMPT_CONTENT: promptContent.content,
      TEST_SCENARIO: '',
      TEST_MATERIALS: testContext ? testContext.summary.join('\n') : ''
    };
    
    const systemMessage = await this.loadTemplate('abtest-evaluation', replacements);

    const userContent = testContext 
      ? `Evaluate this prompt's structure with the following test context:\n\n${promptContent.content}\n\nTest Context Summary:\n${testContext.summary.join('\n')}`
      : `Evaluate this prompt's structure:\n\n${promptContent.content}`;

    const response = await this.callClaudeWithRetry({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: userContent
      }],
      system: systemMessage
    });

    const evaluation = response.content[0].text;
    const score = this.extractScore(evaluation);

    return {
      type: 'structural',
      evaluation,
      score,
      aspects: {
        clarity: score >= 7,
        organization: score >= 7,
        completeness: score >= 8
      }
    };
  }

  /**
   * Evaluate domain expertise aspects
   */
  async evaluateDomainExpertise(expertPrompt, promptContent, testContext, iterationCount = 0) {
    const contextInfo = testContext ? `\n\nTest materials provided for evaluation context` : '';
    
    const systemMessage = `You are a domain expert evaluator.
Expert perspective: ${expertPrompt.content.substring(0, 500)}...
${contextInfo}

Evaluate the prompt for:
1. Domain accuracy
2. Technical depth
3. Best practices adherence
4. Industry standards alignment
5. Practical applicability to test scenarios`;

    let userContent = `Evaluate this prompt's domain expertise:\n\n${promptContent.content}`;
    
    if (testContext && testContext.files.length > 0) {
      // Include sample test file for context
      const sampleFile = testContext.files[0];
      userContent += `\n\nSample test context (${sampleFile.name}):\n${sampleFile.content.substring(0, 500)}...`;
    }

    const response = await this.callClaudeWithRetry({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: userContent
      }],
      system: systemMessage
    });

    const evaluation = response.content[0].text;
    const score = this.extractScore(evaluation);

    return {
      type: 'domain',
      evaluation,
      score,
      aspects: {
        accuracy: score >= 8,
        depth: score >= 7,
        bestPractices: score >= 8
      }
    };
  }

  /**
   * Evaluate effectiveness of the prompt
   */
  async evaluateEffectiveness(expertPrompt, promptContent, testContext, iterationCount = 0) {
    const contextInfo = testContext ? `\n\nTest scenarios available for practical evaluation` : '';
    
    const systemMessage = `You are evaluating prompt effectiveness.
Expert perspective: ${expertPrompt.content.substring(0, 500)}...
${contextInfo}

Evaluate the prompt for:
1. Likely output quality
2. Task completion capability
3. Edge case handling
4. Practical usability
5. Performance on test scenarios`;

    let userContent = `Evaluate this prompt's effectiveness:\n\n${promptContent.content}`;
    
    if (testContext) {
      userContent += `\n\nTest Context Overview:\n- Files: ${testContext.files.length}\n- Directories: ${testContext.directories.length}\n- Total size: ${(testContext.totalSize / 1024).toFixed(2)} KB`;
      
      if (testContext.directories.length > 0) {
        const dir = testContext.directories[0];
        userContent += `\n- Sample directory: ${dir.path} (${dir.fileCount} files)`;
      }
    }

    const response = await this.callClaudeWithRetry({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: userContent
      }],
      system: systemMessage
    });

    const evaluation = response.content[0].text;
    const score = this.extractScore(evaluation);

    return {
      type: 'effectiveness',
      evaluation,
      score,
      aspects: {
        outputQuality: score >= 7,
        taskCompletion: score >= 8,
        edgeCases: score >= 6
      }
    };
  }

  /**
   * Compare two evaluations
   */
  async compareEvaluations(expertPrompt, evalA, evalB, infoA, infoB) {
    const comparison = {
      scoreDifference: evalB.aggregateScore - evalA.aggregateScore,
      improvements: [],
      regressions: [],
      unchanged: []
    };

    // Compare thread scores
    for (let i = 0; i < evalA.threads.length; i++) {
      const threadA = evalA.threads[i];
      const threadB = evalB.threads[i];
      const diff = threadB.score - threadA.score;

      if (diff > 0.5) {
        comparison.improvements.push({
          aspect: threadA.type,
          improvement: diff,
          fromScore: threadA.score,
          toScore: threadB.score
        });
      } else if (diff < -0.5) {
        comparison.regressions.push({
          aspect: threadA.type,
          regression: Math.abs(diff),
          fromScore: threadA.score,
          toScore: threadB.score
        });
      } else {
        comparison.unchanged.push(threadA.type);
      }
    }

    // Detailed comparison using expert perspective
    const detailedComparison = await this.getDetailedComparison(
      expertPrompt,
      evalA,
      evalB,
      infoA,
      infoB
    );

    comparison.detailed = detailedComparison;

    return comparison;
  }

  /**
   * Get detailed comparison from expert perspective
   */
  async getDetailedComparison(expertPrompt, evalA, evalB, infoA, infoB) {
    const systemMessage = `You are the expert defined by this prompt:
${expertPrompt.content}

Provide a detailed comparison of two prompt evaluations.`;

    const response = await this.callClaudeWithRetry({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Compare these two prompt evaluations:

PROMPT A (${infoA.version}):
Score: ${evalA.aggregateScore}
Strengths: ${evalA.strengths.join(', ')}
Weaknesses: ${evalA.weaknesses.join(', ')}

PROMPT B (${infoB.version}):
Score: ${evalB.aggregateScore}
Strengths: ${evalB.strengths.join(', ')}
Weaknesses: ${evalB.weaknesses.join(', ')}

Provide detailed comparison focusing on:
1. Key differences
2. Trade-offs
3. Use case suitability
4. Overall improvement or regression`
      }],
      system: systemMessage
    });

    return response.content[0].text;
  }

  /**
   * Generate expert verdict
   */
  async generateExpertVerdict(expertPrompt, comparison, infoA, infoB) {
    const systemMessage = `You are the expert defined by this prompt:
${expertPrompt.content}

You must provide a clear verdict on which prompt version is better.`;

    const response = await this.callClaudeWithRetry({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Based on this comparison, provide your expert verdict:

${comparison.detailed}

Score difference: ${comparison.scoreDifference}
Improvements: ${comparison.improvements.length}
Regressions: ${comparison.regressions.length}

PROVIDE CLEAR VERDICT:
1. Which version is better: A (${infoA.version}) or B (${infoB.version})?
2. Why is it better?
3. Confidence level (high/medium/low)
4. Recommendation for production use`
      }],
      system: systemMessage
    });

    const verdictText = response.content[0].text;
    
    // Parse verdict
    const winner = verdictText.toLowerCase().includes('version b') || 
                   verdictText.toLowerCase().includes('prompt b') ? 'B' : 'A';
    
    const confidence = verdictText.toLowerCase().includes('high') ? 'high' :
                      verdictText.toLowerCase().includes('low') ? 'low' : 'medium';

    return {
      winner,
      winnerVersion: winner === 'A' ? infoA.version : infoB.version,
      confidence,
      reasoning: verdictText,
      scoreDifference: comparison.scoreDifference,
      recommendProduction: verdictText.toLowerCase().includes('recommend') && 
                          verdictText.toLowerCase().includes('production')
    };
  }

  /**
   * Load and fill template with placeholders
   */
  async loadTemplate(templateName, replacements) {
    try {
      // First try to fetch from GitHub
      let template = await this.fetchTemplateFromGitHub(templateName);
      
      if (!template) {
        // Try local filesystem as fallback
        try {
          const templatePath = path.join(this.templateDir, `${templateName}.md`);
          template = await fs.readFile(templatePath, 'utf8');
        } catch (localError) {
          // Use inline fallback
          console.log(`Using inline template for ${templateName}`);
          return this.getFallbackTemplate(templateName, replacements);
        }
      }
      
      // Replace all placeholders
      for (const [key, value] of Object.entries(replacements)) {
        const placeholder = `{{${key}}}`;
        // Handle conditional sections
        const conditionalRegex = new RegExp(`{{#if ${key}}}([\\s\\S]*?){{/if}}`, 'g');
        if (value) {
          template = template.replace(conditionalRegex, '$1');
        } else {
          template = template.replace(conditionalRegex, '');
        }
        // Replace simple placeholders
        template = template.replace(new RegExp(placeholder, 'g'), value || '');
      }
      
      // Clean up any remaining conditional blocks
      template = template.replace(/{{#if \w+}}[\s\S]*?{{\/if}}/g, '');
      
      return template;
    } catch (error) {
      console.warn(`Failed to load template ${templateName}, using fallback: ${error.message}`);
      return this.getFallbackTemplate(templateName, replacements);
    }
  }

  /**
   * Fetch template from GitHub
   */
  async fetchTemplateFromGitHub(templateName) {
    try {
      const templatePath = `src/lib/templates/${templateName}.md`;
      
      // Check cache first
      const cacheKey = `template:${templateName}`;
      const cached = this.contentCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
        return cached.data;
      }
      
      // Fetch from GitHub
      const { data } = await this.octokit.repos.getContent({
        owner: this.repoOwner,
        repo: this.repoName,
        path: templatePath,
        ref: 'main' // Always fetch templates from main branch
      });
      
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      // Cache the template
      this.contentCache.set(cacheKey, {
        data: content,
        timestamp: Date.now()
      });
      
      return content;
    } catch (error) {
      // Template not found on GitHub, will use fallback
      return null;
    }
  }

  /**
   * Get fallback template if file not found
   */
  getFallbackTemplate(templateName, replacements) {
    // Return the original inline template as fallback
    if (templateName === 'abtest-evaluation') {
      return this.buildEvaluationPrompt(replacements);
    }
    if (templateName === 'abtest-comparison') {
      return this.buildComparisonPrompt(replacements);
    }
    if (templateName === 'abtest-verdict') {
      return this.buildVerdictPrompt(replacements);
    }
    return '';
  }

  /**
   * Build evaluation prompt (fallback)
   */
  buildEvaluationPrompt(params) {
    return `You are an expert evaluator analyzing prompt ${params.EVALUATION_TYPE}.
Expert perspective: ${params.EXPERT_DEFINITION}
${params.TEST_CONTEXT}
${params.ITERATION_CONTEXT}

Evaluate the prompt for:
${params.EVALUATION_CRITERIA}

${params.PROMPT_CONTENT}`;
  }

  /**
   * Build comparison prompt (fallback)
   */
  buildComparisonPrompt(params) {
    return `You are the expert defined by this prompt:
${params.EXPERT_DEFINITION}

Compare these two prompt evaluations:

PROMPT A (${params.VERSION_A_IDENTIFIER}):
Score: ${params.SCORE_A}
Strengths: ${params.STRENGTHS_A}
Weaknesses: ${params.WEAKNESSES_A}

PROMPT B (${params.VERSION_B_IDENTIFIER}):
Score: ${params.SCORE_B}
Strengths: ${params.STRENGTHS_B}
Weaknesses: ${params.WEAKNESSES_B}

Provide detailed comparison and verdict.`;
  }

  /**
   * Build verdict prompt (fallback)
   */
  buildVerdictPrompt(params) {
    return `Based on this comparison, provide your expert verdict:

${params.DETAILED_COMPARISON}

Score difference: ${params.SCORE_DIFFERENCE}
Improvements: ${params.IMPROVEMENTS_COUNT}
Regressions: ${params.REGRESSIONS_COUNT}

PROVIDE CLEAR VERDICT:
1. Which version is better: A or B?
2. Why is it better?
3. Confidence level (high/medium/low)
4. Recommendation for production use`;
  }

  /**
   * Extract score from evaluation text
   */
  extractScore(evaluation) {
    // Look for score patterns like "8/10", "Score: 8", "8 out of 10"
    const patterns = [
      /(\d+(?:\.\d+)?)\s*\/\s*10/i,
      /score[:\s]+(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*out\s*of\s*10/i
    ];

    for (const pattern of patterns) {
      const match = evaluation.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    // Default score based on sentiment
    if (evaluation.toLowerCase().includes('excellent')) return 9;
    if (evaluation.toLowerCase().includes('good')) return 7;
    if (evaluation.toLowerCase().includes('adequate')) return 5;
    if (evaluation.toLowerCase().includes('poor')) return 3;
    
    return 5; // Default middle score
  }

  /**
   * Extract strengths from threads
   */
  extractStrengths(threads) {
    const strengths = [];
    threads.forEach(thread => {
      if (thread.score >= 7) {
        Object.entries(thread.aspects).forEach(([aspect, isStrong]) => {
          if (isStrong) {
            strengths.push(`${thread.type}: ${aspect}`);
          }
        });
      }
    });
    return strengths;
  }

  /**
   * Extract weaknesses from threads
   */
  extractWeaknesses(threads) {
    const weaknesses = [];
    threads.forEach(thread => {
      if (thread.score < 7) {
        Object.entries(thread.aspects).forEach(([aspect, isStrong]) => {
          if (!isStrong) {
            weaknesses.push(`${thread.type}: ${aspect}`);
          }
        });
      }
    });
    return weaknesses;
  }

  /**
   * Generate summary of the AB test
   */
  generateSummary(verdict) {
    return `AB Test Complete: Version ${verdict.winnerVersion} is ${verdict.winner === 'B' ? 'BETTER' : 'WORSE'} than the baseline.
Confidence: ${verdict.confidence}
Score Difference: ${verdict.scoreDifference > 0 ? '+' : ''}${verdict.scoreDifference.toFixed(1)}
Production Ready: ${verdict.recommendProduction ? 'YES' : 'NO'}`;
  }

  /**
   * Helper method to interpret results for Claude
   * Returns actionable recommendation based on verdict
   */
  static interpretResults(abTestResult) {
    if (!abTestResult.success) {
      return {
        action: 'ERROR',
        message: abTestResult.error,
        details: abTestResult.details
      };
    }

    const { verdict, evaluations, comparison } = abTestResult;
    
    // High confidence winner
    if (verdict.confidence === 'high' && verdict.recommendProduction) {
      return {
        action: 'DEPLOY',
        message: `Deploy Version ${verdict.winnerVersion} - clearly superior with ${verdict.confidence} confidence`,
        improvements: comparison.improvements,
        score: verdict.scoreDifference
      };
    }
    
    // Medium confidence - needs improvements
    if (verdict.confidence === 'medium' || (verdict.winner === 'B' && verdict.scoreDifference > 0 && verdict.scoreDifference < 1)) {
      const weaknesses = verdict.winner === 'B' 
        ? evaluations.promptB.weaknesses 
        : evaluations.promptA.weaknesses;
      
      return {
        action: 'IMPROVE',
        message: `Version ${verdict.winnerVersion} shows promise but needs refinement`,
        improvements: weaknesses,
        suggestions: comparison.improvements,
        score: verdict.scoreDifference
      };
    }
    
    // Low confidence or regression
    if (verdict.winner === 'A' || verdict.confidence === 'low' || verdict.scoreDifference < 0) {
      return {
        action: 'REJECT',
        message: `Keep current version - Version B has regressions or critical issues`,
        regressions: comparison.regressions,
        score: verdict.scoreDifference
      };
    }
    
    // Default case
    return {
      action: 'REVIEW',
      message: 'Manual review recommended - unclear verdict',
      verdict: verdict,
      comparison: comparison
    };
  }

  /**
   * Get tool definition for Claude
   */
  /**
   * @static
   * @method getToolDefinition
   * @description Returns the tool definition for Claude integration
   * @returns {Object} Tool definition object for Claude
   */
  static getToolDefinition() {
    return {
      name: 'ab_test',
      description: `Run comprehensive A/B test comparing two prompt versions using expert evaluation.

PURPOSE:
Compare two versions of a prompt to determine which performs better according to expert-defined criteria. Essential for validating changes before deployment.

IMPORTANT: All paths are GitHub repository paths fetched via GitHub API, not local filesystem paths.

EXPERT DEFINITIONS:
Default experts repository: whichguy/prompt-expert-bank/experts/
Browse available: https://github.com/whichguy/prompt-expert-bank/tree/main/experts

To use an expert from current repo: "experts/[filename].md"
To use from specific repo: "whichguy/prompt-expert-bank:experts/[filename].md"
Files are fetched using GitHub API (same as 'gh api repos/{owner}/{repo}/contents/{path}')

KEY FEATURES:
• 3-thread evaluation (structure, domain expertise, effectiveness)
• Expert-based scoring with domain-specific criteria  
• Test context integration for real-world scenarios
• Clear verdict with confidence level
• Support for version control (commits, tags, branches)
• Cross-repository comparison capability

WHEN TO USE THIS TOOL:
1. Before deploying prompt changes to production
2. Comparing different implementation approaches
3. Tracking down when a regression was introduced
4. Validating prompt improvements after updates
5. Cross-team prompt comparison and standardization

INPUT VALIDATION:
• All paths must exist and be accessible
• Cannot compare identical versions
• Test context limited to 100KB total
• Maximum 20 test context files

VERSION FORMATS:
• "prompts/file.md" → Latest version (HEAD)
• "prompts/file.md@v1.0" → Specific tag
• "prompts/file.md@main" → Specific branch  
• "prompts/file.md@3a5f8e2" → Specific commit
• "owner/repo:prompts/file.md" → Cross-repository
• "prompts/file.md@3commits-ago" → Relative reference

HOW TO SPECIFY EXPERTS:
AVAILABLE EXPERTS:
• Browse at: https://github.com/whichguy/prompt-expert-bank/tree/main/experts
• Path format: "experts/[filename].md"
• Custom experts: "path/to/custom-expert.md" or "owner/repo:path/to/expert.md"

REAL EXAMPLES WITH CORRECT PATHS:

Example 1 - Code Review PR Testing:
{
  pathToExpertPromptDefinition: "experts/programming-expert.md",
  pathToPromptA: "prompts/code-reviewer.md@main",
  pathToPromptB: "prompts/code-reviewer.md",
  testContextPaths: ["test-scenarios/"]
}
Expected: Compare main branch with PR changes

Example 2 - Security Prompt Enhancement:
{
  pathToExpertPromptDefinition: "experts/security-expert.md",
  pathToPromptA: "prompts/security-scanner.md@v1.0",
  pathToPromptB: "prompts/security-scanner.md@v2.0",  
  testContextPaths: ["test-scenarios/security/"]
}
Expected: Validate security improvements between versions

Example 3 - Different Approaches:
{
  pathToExpertPromptDefinition: "experts/data-analysis-expert.md",
  pathToPromptA: "prompts/analyzer-statistical.md",
  pathToPromptB: "prompts/analyzer-ml-based.md",
  testContextPaths: ["datasets/training/", "datasets/validation/"]
}
Expected: Determine which approach is more effective

Example 4 - Version History:
{
  pathToExpertPromptDefinition: "experts/general-expert.md",
  pathToPromptA: "prompts/assistant.md@v2.0",
  pathToPromptB: "prompts/assistant.md@v2.1",
  testContextPaths: ["test-scenarios/regressions/"]
}
Expected: Identify if v2.1 introduced issues

OUTPUT STRUCTURE:
{
  success: true/false,
  verdict: {
    winner: "A" or "B",
    confidence: "high"/"medium"/"low",
    scoreDifference: numeric,
    reasoning: "detailed explanation",
    recommendProduction: true/false
  },
  summary: "concise result statement"
}

ERROR HANDLING:
• File not found → Check path and permissions
• Invalid version → Verify git reference exists
• Large context → Reduce test file count/size
• Network issues → Automatic retry (3 attempts)
• Rate limits → Wait 60 seconds and retry

PERFORMANCE NOTES:
• Typical execution: 15-30 seconds
• Large test context: 30-60 seconds
• Results cached for 24 hours
• Use specific commits for reproducibility

BEST PRACTICES:
✓ Compare one change at a time
✓ Include diverse test scenarios
✓ Use specific version references
✓ Document comparison purpose
✓ Save results for tracking
✗ Don't compare unrelated prompts
✗ Don't use test context > 100KB
✗ Don't ignore low confidence
✗ Don't deploy without testing`,
      input_schema: {
        type: 'object',
        properties: {
          pathToExpertPromptDefinition: {
            type: 'string',
            description: 'GitHub repository path to expert definition MD file (fetched via API). Format: "path/to/file.md" for current repo or "owner/repo:path/to/file.md" for cross-repo. Default experts at whichguy/prompt-expert-bank/experts/. Example: "experts/programming-expert.md" or "whichguy/prompt-expert-bank:experts/programming-expert.md"'
          },
          pathToPromptA: {
            type: 'string',
            description: 'GitHub repository path to baseline prompt (fetched via API). Format: "path/to/file.md@ref" where ref = branch/tag/commit SHA. Example: "prompts/code-reviewer.md@main" fetches from main branch via GitHub API'
          },
          pathToPromptB: {
            type: 'string',
            description: 'GitHub repository path to variant prompt (fetched via API). Format: "path/to/file.md@ref" or "path/to/file.md" (defaults to HEAD). Example: "prompts/code-reviewer.md" fetches current PR/HEAD version'
          },
          testContextPaths: {
            type: 'array',
            description: 'Optional array of paths to test files or directories for evaluation context. Each path can be a file, directory, or use version specifiers like prompts. Example: ["test-scenarios/", "examples/test.js@v1.0"]. Limit total size to 100KB.',
            items: {
              type: 'string'
            }
          },
          iterationCount: {
            type: 'number',
            description: 'Optional: Number of previous improvement iterations. Used to apply leniency after multiple attempts. Defaults to 0.'
          }
        },
        required: ['pathToExpertPromptDefinition', 'pathToPromptA', 'pathToPromptB']
      }
    };
  }
}

module.exports = { ABTestTool };