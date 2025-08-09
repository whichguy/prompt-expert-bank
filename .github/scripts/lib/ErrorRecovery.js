/**
 * Error Recovery Utilities
 * Handles automatic recovery from common error scenarios
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ErrorRecovery {
  /**
   * Main recovery method that delegates to specific recovery strategies
   */
  static async recover(error, context) {
    // Log the error for debugging
    if (context.logger) {
      context.logger.log('debug', 'Attempting error recovery', {
        error: error.message,
        code: error.code,
        status: error.status
      });
    }

    // Try Git-related recovery
    if (this.isGitError(error)) {
      return await this.recoverFromGitError(error, context);
    }

    // Try API-related recovery
    if (this.isAPIError(error)) {
      return await this.recoverFromAPIError(error, context);
    }

    // Try file operation recovery
    if (this.isFileError(error)) {
      return await this.recoverFromFileError(error, context);
    }

    // No recovery available
    return { retry: false };
  }

  /**
   * Check if error is Git-related
   */
  static isGitError(error) {
    const gitIndicators = [
      'index.lock',
      'detached HEAD',
      'merge conflict',
      'not a git repository',
      'fatal:',
      'Your branch is behind',
      'non-fast-forward'
    ];
    
    return gitIndicators.some(indicator => 
      error.message?.includes(indicator) || 
      error.stderr?.includes(indicator)
    );
  }

  /**
   * Check if error is API-related
   */
  static isAPIError(error) {
    return error.status !== undefined || 
           error.message?.includes('rate limit') ||
           error.message?.includes('API') ||
           error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT';
  }

  /**
   * Check if error is file operation related
   */
  static isFileError(error) {
    return error.code === 'ENOENT' ||
           error.code === 'EACCES' ||
           error.code === 'EISDIR' ||
           error.message?.includes('sha') ||
           error.message?.includes('already exists');
  }

  /**
   * Recover from Git errors
   */
  static async recoverFromGitError(error, context) {
    const message = error.message || '';
    
    // Handle index.lock
    if (message.includes('index.lock')) {
      try {
        await execAsync('rm -f .git/index.lock');
        if (context.logger) {
          context.logger.log('info', 'Removed git index lock file');
        }
        return { retry: true };
      } catch (e) {
        return { retry: false, error: 'Failed to remove index.lock' };
      }
    }
    
    // Handle detached HEAD
    if (message.includes('detached HEAD')) {
      try {
        const tempBranch = `temp-claude-${Date.now()}`;
        await execAsync(`git checkout -b ${tempBranch}`);
        
        if (context.logger) {
          context.logger.log('info', `Created temporary branch: ${tempBranch}`);
        }
        
        return { 
          retry: true, 
          cleanup: async () => {
            try {
              await execAsync(`git branch -d ${tempBranch}`);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        };
      } catch (e) {
        return { retry: false, error: 'Failed to create temporary branch' };
      }
    }
    
    // Handle merge conflicts
    if (message.includes('merge conflict')) {
      try {
        const { stdout } = await execAsync('git diff --name-only --diff-filter=U');
        const conflictFiles = stdout.trim().split('\n').filter(f => f);
        
        return { 
          retry: false, 
          error: 'Merge conflicts detected',
          conflictFiles: conflictFiles,
          suggestion: 'Manual intervention required to resolve conflicts'
        };
      } catch (e) {
        return { retry: false, error: 'Merge conflict detected' };
      }
    }
    
    // Handle non-fast-forward
    if (message.includes('non-fast-forward')) {
      try {
        // Try to pull and merge
        await execAsync('git pull --no-rebase origin $(git branch --show-current)');
        
        if (context.logger) {
          context.logger.log('info', 'Pulled latest changes from origin');
        }
        
        return { retry: true };
      } catch (e) {
        return { 
          retry: false, 
          error: 'Cannot fast-forward',
          suggestion: 'Pull latest changes manually'
        };
      }
    }
    
    // Handle branch behind
    if (message.includes('Your branch is behind')) {
      try {
        await execAsync('git pull --ff-only');
        
        if (context.logger) {
          context.logger.log('info', 'Fast-forwarded to latest');
        }
        
        return { retry: true };
      } catch (e) {
        return { retry: false, error: 'Failed to fast-forward' };
      }
    }
    
    return { retry: false };
  }

  /**
   * Recover from API errors
   */
  static async recoverFromAPIError(error, context) {
    // Handle rate limiting
    if (error.status === 403 && error.message?.includes('rate limit')) {
      const resetTime = error.headers?.['x-ratelimit-reset'];
      const remaining = error.headers?.['x-ratelimit-remaining'];
      
      if (resetTime) {
        const waitTime = (resetTime * 1000) - Date.now();
        
        // Only wait if it's reasonable (max 5 minutes)
        if (waitTime > 0 && waitTime < 300000) {
          if (context.logger) {
            context.logger.log('info', `Rate limited. Waiting ${Math.ceil(waitTime / 1000)}s`);
          }
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return { retry: true };
        }
      }
      
      return { 
        retry: false, 
        error: 'Rate limit exceeded',
        resetTime: resetTime,
        suggestion: 'Wait for rate limit reset or use different token'
      };
    }
    
    // Handle 429 Too Many Requests
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
      
      if (waitTime < 300000) { // Max 5 minutes
        if (context.logger) {
          context.logger.log('info', `Too many requests. Waiting ${waitTime / 1000}s`);
        }
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return { retry: true };
      }
      
      return { retry: false, error: 'Too many requests' };
    }
    
    // Handle 422 Unprocessable Entity (often SHA mismatch)
    if (error.status === 422 && error.message?.includes('sha')) {
      if (context.octokit && error.path) {
        try {
          // Fetch latest SHA
          const { data } = await context.octokit.repos.getContent({
            owner: context.repository?.owner,
            repo: context.repository?.name,
            path: error.path,
            ref: context.pr?.branch?.head || 'HEAD'
          });
          
          if (context.logger) {
            context.logger.log('info', 'Fetched updated SHA for file', { 
              path: error.path,
              newSha: data.sha 
            });
          }
          
          return { 
            retry: true, 
            newSha: data.sha,
            suggestion: 'Use updated SHA for file operation'
          };
        } catch (e) {
          return { retry: false, error: 'Failed to fetch updated SHA' };
        }
      }
    }
    
    // Handle network timeouts
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      if (context.logger) {
        context.logger.log('info', 'Network error, retrying after delay');
      }
      
      // Wait 5 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      return { retry: true };
    }
    
    // Handle 5xx server errors
    if (error.status >= 500 && error.status < 600) {
      if (context.logger) {
        context.logger.log('info', `Server error ${error.status}, retrying after delay`);
      }
      
      // Wait 10 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 10000));
      return { retry: true };
    }
    
    return { retry: false };
  }

  /**
   * Recover from file operation errors
   */
  static async recoverFromFileError(error, context) {
    // Handle file not found
    if (error.code === 'ENOENT') {
      const path = error.path || error.message.match(/['"]([^'"]+)['"]/)?.[1];
      
      if (path) {
        // Check if parent directory exists
        const parentDir = path.substring(0, path.lastIndexOf('/'));
        
        if (parentDir) {
          try {
            await execAsync(`mkdir -p "${parentDir}"`);
            
            if (context.logger) {
              context.logger.log('info', `Created parent directory: ${parentDir}`);
            }
            
            return { retry: true };
          } catch (e) {
            // Ignore mkdir errors
          }
        }
      }
      
      return { 
        retry: false, 
        error: 'File or directory not found',
        path: path
      };
    }
    
    // Handle permission denied
    if (error.code === 'EACCES') {
      return { 
        retry: false, 
        error: 'Permission denied',
        suggestion: 'Check file permissions and ownership'
      };
    }
    
    // Handle is a directory error
    if (error.code === 'EISDIR') {
      return { 
        retry: false, 
        error: 'Target is a directory, not a file',
        suggestion: 'Use directory operations instead'
      };
    }
    
    // Handle file already exists
    if (error.message?.includes('already exists')) {
      return { 
        retry: false, 
        error: 'File already exists',
        suggestion: 'Use update mode or delete existing file first'
      };
    }
    
    return { retry: false };
  }

  /**
   * Create a recovery report for logging
   */
  static createRecoveryReport(error, recovery) {
    return {
      originalError: error.message,
      errorCode: error.code,
      errorStatus: error.status,
      recovered: recovery.retry === true,
      recoveryAction: recovery.suggestion || 'None',
      additionalInfo: {
        conflictFiles: recovery.conflictFiles,
        newSha: recovery.newSha,
        resetTime: recovery.resetTime
      }
    };
  }
}

module.exports = { ErrorRecovery };