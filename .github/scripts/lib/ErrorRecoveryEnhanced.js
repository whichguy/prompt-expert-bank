/**
 * Enhanced Error Recovery System for Claude Code Integration
 * Comprehensive error handling, recovery strategies, and logging
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

class ErrorRecoveryEnhanced {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    
    // Recovery statistics
    this.stats = {
      totalErrors: 0,
      recoveredErrors: 0,
      unrecoverableErrors: 0,
      recoveryStrategies: {}
    };
    
    // Error patterns and recovery strategies
    this.recoveryStrategies = this.initializeRecoveryStrategies();
    
    this.logger.log('info', '🛡️ Enhanced Error Recovery System initialized', {
      maxRetries: this.maxRetries,
      strategies: Object.keys(this.recoveryStrategies).length
    });
  }

  /**
   * Initialize recovery strategies for different error types
   */
  initializeRecoveryStrategies() {
    return {
      // Git-related errors
      gitLock: {
        pattern: /index\.lock|\.lock exists/i,
        priority: 1,
        handler: this.recoverFromGitLock.bind(this)
      },
      
      gitDetachedHead: {
        pattern: /detached HEAD|not on any branch/i,
        priority: 2,
        handler: this.recoverFromDetachedHead.bind(this)
      },
      
      gitMergeConflict: {
        pattern: /CONFLICT|merge conflict|fix conflicts/i,
        priority: 3,
        handler: this.recoverFromMergeConflict.bind(this)
      },
      
      gitDirtyWorkspace: {
        pattern: /uncommitted changes|changes not staged/i,
        priority: 4,
        handler: this.recoverFromDirtyWorkspace.bind(this)
      },
      
      // API-related errors
      rateLimit: {
        pattern: /rate limit|too many requests|429/i,
        priority: 1,
        handler: this.recoverFromRateLimit.bind(this)
      },
      
      authenticationError: {
        pattern: /401|unauthorized|bad credentials|authentication failed/i,
        priority: 2,
        handler: this.recoverFromAuthError.bind(this)
      },
      
      permissionDenied: {
        pattern: /403|forbidden|permission denied|insufficient scope/i,
        priority: 3,
        handler: this.recoverFromPermissionError.bind(this)
      },
      
      notFound: {
        pattern: /404|not found|does not exist/i,
        priority: 4,
        handler: this.recoverFromNotFound.bind(this)
      },
      
      // Network errors
      networkTimeout: {
        pattern: /timeout|timed out|ETIMEDOUT|socket hang up/i,
        priority: 1,
        handler: this.recoverFromNetworkTimeout.bind(this)
      },
      
      connectionRefused: {
        pattern: /ECONNREFUSED|connection refused|ECONNRESET/i,
        priority: 2,
        handler: this.recoverFromConnectionRefused.bind(this)
      },
      
      dnsError: {
        pattern: /ENOTFOUND|ENOENT|getaddrinfo|dns/i,
        priority: 3,
        handler: this.recoverFromDNSError.bind(this)
      },
      
      // File system errors
      fileNotFound: {
        pattern: /ENOENT.*no such file|file not found/i,
        priority: 1,
        handler: this.recoverFromFileNotFound.bind(this)
      },
      
      permissionDeniedFS: {
        pattern: /EACCES|EPERM|permission denied.*file/i,
        priority: 2,
        handler: this.recoverFromFSPermission.bind(this)
      },
      
      diskSpace: {
        pattern: /ENOSPC|no space left|disk full/i,
        priority: 3,
        handler: this.recoverFromDiskSpace.bind(this)
      },
      
      // Process errors
      outOfMemory: {
        pattern: /heap out of memory|JavaScript heap|ENOMEM/i,
        priority: 1,
        handler: this.recoverFromOutOfMemory.bind(this)
      },
      
      processKilled: {
        pattern: /killed|SIGKILL|SIGTERM/i,
        priority: 2,
        handler: this.recoverFromProcessKilled.bind(this)
      },
      
      // Claude API specific
      claudeOverloaded: {
        pattern: /overloaded|529|service unavailable/i,
        priority: 1,
        handler: this.recoverFromClaudeOverload.bind(this)
      },
      
      claudeContextLength: {
        pattern: /context length|token limit|too many tokens/i,
        priority: 2,
        handler: this.recoverFromContextLength.bind(this)
      }
    };
  }

  /**
   * Main recovery entry point
   */
  async attemptRecovery(error, context = {}) {
    this.stats.totalErrors++;
    
    const errorInfo = {
      message: error.message || String(error),
      type: error.constructor.name,
      code: error.code,
      context,
      timestamp: Date.now()
    };
    
    this.logger.log('info', '🔧 Attempting error recovery', errorInfo);
    
    // Find matching recovery strategy
    const strategy = this.findRecoveryStrategy(error);
    
    if (!strategy) {
      this.logger.log('warn', '❌ No recovery strategy found for error', {
        error: errorInfo.message
      });
      this.stats.unrecoverableErrors++;
      return { success: false, error: 'No recovery strategy available' };
    }
    
    // Track strategy usage
    this.stats.recoveryStrategies[strategy.name] = 
      (this.stats.recoveryStrategies[strategy.name] || 0) + 1;
    
    try {
      this.logger.log('info', `🎯 Applying recovery strategy: ${strategy.name}`, {
        priority: strategy.priority
      });
      
      // FIX: Pass updated context with recursion depth
      const result = await strategy.handler(error, errorInfo.context);
      
      if (result.success) {
        this.stats.recoveredErrors++;
        this.logger.log('info', `✅ Recovery successful: ${strategy.name}`, {
          action: result.action
        });
      } else {
        this.stats.unrecoverableErrors++;
        this.logger.log('warn', `⚠️ Recovery failed: ${strategy.name}`, {
          reason: result.reason
        });
      }
      
      return result;
    } catch (recoveryError) {
      this.logger.log('error', `💥 Recovery strategy failed: ${strategy.name}`, {
        error: recoveryError.message
      });
      this.stats.unrecoverableErrors++;
      return { success: false, error: recoveryError.message };
    }
  }

  /**
   * Find matching recovery strategy
   */
  findRecoveryStrategy(error) {
    const errorString = `${error.message} ${error.code || ''} ${error.stderr || ''}`.toLowerCase();
    
    // Sort strategies by priority
    const sortedStrategies = Object.entries(this.recoveryStrategies)
      .sort((a, b) => a[1].priority - b[1].priority);
    
    for (const [name, strategy] of sortedStrategies) {
      if (strategy.pattern.test(errorString)) {
        return { name, ...strategy };
      }
    }
    
    return null;
  }

  // Git Recovery Strategies

  async recoverFromGitLock(error, context) {
    this.logger.log('info', '🔓 Removing git lock files');
    
    try {
      // Find all lock files
      const { stdout } = await execAsync('find .git -name "*.lock" 2>/dev/null || true');
      const lockFiles = stdout.split('\n').filter(f => f);
      
      if (lockFiles.length === 0) {
        return { success: false, reason: 'No lock files found' };
      }
      
      // Remove lock files
      for (const lockFile of lockFiles) {
        await fs.unlink(lockFile).catch(() => {});
        this.logger.log('debug', `Removed lock file: ${lockFile}`);
      }
      
      return {
        success: true,
        action: `Removed ${lockFiles.length} lock file(s)`,
        retry: true
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async recoverFromDetachedHead(error, context) {
    this.logger.log('info', '🔀 Recovering from detached HEAD state');
    
    try {
      // Get current commit
      const { stdout: currentCommit } = await execAsync('git rev-parse HEAD');
      const sha = currentCommit.trim().substring(0, 7);
      
      // Create temporary branch
      const tempBranch = `temp-recovery-${sha}`;
      await execAsync(`git checkout -b ${tempBranch}`);
      
      this.logger.log('info', `Created temporary branch: ${tempBranch}`);
      
      return {
        success: true,
        action: `Created temporary branch ${tempBranch}`,
        branch: tempBranch,
        retry: true
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async recoverFromMergeConflict(error, context) {
    this.logger.log('info', '⚔️ Handling merge conflict');
    
    try {
      // Check conflict status
      const { stdout } = await execAsync('git status --porcelain');
      const conflicts = stdout.split('\n')
        .filter(line => line.startsWith('UU') || line.startsWith('AA'));
      
      if (conflicts.length === 0) {
        return { success: false, reason: 'No conflicts detected' };
      }
      
      // For automated recovery, we'll abort the merge
      // In production, you might want to attempt automatic resolution
      // FIX: Run commands sequentially to avoid conflicts
      try {
        await execAsync('git merge --abort');
      } catch {
        // If merge abort fails, try rebase abort
        await execAsync('git rebase --abort').catch(() => {});
      }
      
      return {
        success: true,
        action: 'Aborted merge/rebase operation',
        conflicts: conflicts.length,
        requiresManualIntervention: true
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async recoverFromDirtyWorkspace(error, context) {
    this.logger.log('info', '🧹 Handling uncommitted changes');
    
    const { preserveChanges = true } = context;
    
    try {
      if (preserveChanges) {
        // Stash changes
        const stashName = `auto-stash-${Date.now()}`;
        await execAsync(`git stash push -m "${stashName}"`);
        
        this.logger.log('info', `Stashed changes as: ${stashName}`);
        
        return {
          success: true,
          action: `Stashed uncommitted changes`,
          stashName,
          retry: true
        };
      } else {
        // Reset changes (dangerous!)
        await execAsync('git reset --hard HEAD');
        
        this.logger.log('warn', '⚠️ Reset workspace to HEAD (changes lost)');
        
        return {
          success: true,
          action: 'Reset workspace to HEAD',
          warning: 'Uncommitted changes were lost',
          retry: true
        };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // API Recovery Strategies

  async recoverFromRateLimit(error, context) {
    this.logger.log('info', '⏱️ Handling rate limit');
    
    // Extract reset time
    const resetTime = this.extractRateLimitReset(error);
    
    if (!resetTime) {
      // Default wait time
      const waitTime = 60000; // 1 minute
      
      this.logger.log('info', `Waiting ${waitTime}ms for rate limit reset`);
      await this.sleep(waitTime);
      
      return {
        success: true,
        action: `Waited ${waitTime}ms for rate limit`,
        retry: true
      };
    }
    
    const waitTime = Math.max(0, resetTime - Date.now());
    
    if (waitTime > 300000) { // More than 5 minutes
      return {
        success: false,
        reason: `Rate limit reset too far in future: ${new Date(resetTime).toISOString()}`
      };
    }
    
    this.logger.log('info', `Waiting ${waitTime}ms until rate limit reset`);
    await this.sleep(waitTime);
    
    return {
      success: true,
      action: `Waited for rate limit reset`,
      resetTime: new Date(resetTime).toISOString(),
      retry: true
    };
  }

  async recoverFromAuthError(error, context) {
    this.logger.log('error', '🔐 Authentication error detected');
    
    // Check for token in environment
    const hasGitHubToken = !!process.env.GITHUB_TOKEN;
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    
    const missing = [];
    if (!hasGitHubToken) missing.push('GITHUB_TOKEN');
    if (!hasAnthropicKey) missing.push('ANTHROPIC_API_KEY');
    
    if (missing.length > 0) {
      return {
        success: false,
        reason: `Missing environment variables: ${missing.join(', ')}`,
        requiresManualIntervention: true
      };
    }
    
    // Try to refresh GitHub CLI auth
    try {
      await execAsync('gh auth refresh');
      
      return {
        success: true,
        action: 'Refreshed GitHub CLI authentication',
        retry: true
      };
    } catch (err) {
      return {
        success: false,
        reason: 'Failed to refresh authentication',
        requiresManualIntervention: true
      };
    }
  }

  async recoverFromPermissionError(error, context) {
    this.logger.log('warn', '🚫 Permission denied error');
    
    // Check if we're on a fork
    if (context.pr?.head?.repo?.fork) {
      return {
        success: false,
        reason: 'Cannot write to fork repository',
        suggestion: 'Use a Personal Access Token with appropriate permissions',
        requiresManualIntervention: true
      };
    }
    
    return {
      success: false,
      reason: 'Insufficient permissions for operation',
      requiresManualIntervention: true
    };
  }

  async recoverFromNotFound(error, context) {
    this.logger.log('info', '🔍 Resource not found');
    
    // If it's a file, try to create it
    if (context.operation === 'read_file' && context.path) {
      const dir = path.dirname(context.path);
      
      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(context.path, '', 'utf8');
        
        return {
          success: true,
          action: `Created missing file: ${context.path}`,
          retry: true
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    
    return {
      success: false,
      reason: 'Resource does not exist',
      suggestion: 'Verify the resource path or ID'
    };
  }

  // Network Recovery Strategies

  async recoverFromNetworkTimeout(error, context) {
    this.logger.log('info', '⏱️ Network timeout detected');
    
    const delay = this.calculateBackoffDelay(context.attempt || 1);
    
    this.logger.log('info', `Waiting ${delay}ms before retry`);
    await this.sleep(delay);
    
    return {
      success: true,
      action: `Waited ${delay}ms with exponential backoff`,
      retry: true,
      nextDelay: this.calculateBackoffDelay((context.attempt || 1) + 1)
    };
  }

  async recoverFromConnectionRefused(error, context) {
    this.logger.log('warn', '🔌 Connection refused');
    
    // Check if service is running
    if (context.service === 'github') {
      try {
        const { stdout } = await execAsync('gh api /rate_limit');
        
        return {
          success: true,
          action: 'GitHub API is accessible',
          retry: true
        };
      } catch (err) {
        return {
          success: false,
          reason: 'GitHub API is not accessible',
          suggestion: 'Check network connectivity'
        };
      }
    }
    
    // Generic wait and retry
    await this.sleep(5000);
    
    return {
      success: true,
      action: 'Waited 5 seconds for service recovery',
      retry: true
    };
  }

  async recoverFromDNSError(error, context) {
    this.logger.log('error', '🌐 DNS resolution error');
    
    // Try to flush DNS cache (platform-specific)
    try {
      if (process.platform === 'darwin') {
        await execAsync('sudo dscacheutil -flushcache 2>/dev/null || true');
      } else if (process.platform === 'linux') {
        await execAsync('sudo systemctl restart systemd-resolved 2>/dev/null || true');
      }
      
      // Wait for DNS to propagate
      await this.sleep(2000);
      
      return {
        success: true,
        action: 'Flushed DNS cache',
        retry: true
      };
    } catch (err) {
      return {
        success: false,
        reason: 'DNS resolution failed',
        suggestion: 'Check network connectivity and DNS settings'
      };
    }
  }

  // File System Recovery Strategies

  async recoverFromFileNotFound(error, context) {
    this.logger.log('info', '📁 File not found');
    
    if (context.path) {
      const dir = path.dirname(context.path);
      
      try {
        // Create directory structure
        await fs.mkdir(dir, { recursive: true });
        
        // Create empty file
        await fs.writeFile(context.path, '', 'utf8');
        
        this.logger.log('info', `Created missing file: ${context.path}`);
        
        return {
          success: true,
          action: `Created ${context.path}`,
          retry: true
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    
    return { success: false, reason: 'Cannot create file without path' };
  }

  async recoverFromFSPermission(error, context) {
    this.logger.log('warn', '🔒 File system permission error');
    
    if (context.path) {
      try {
        // Try to fix permissions
        await execAsync(`chmod 644 "${context.path}" 2>/dev/null || true`);
        
        return {
          success: true,
          action: `Fixed permissions for ${context.path}`,
          retry: true
        };
      } catch (err) {
        return {
          success: false,
          reason: 'Cannot modify file permissions',
          requiresManualIntervention: true
        };
      }
    }
    
    return { success: false, reason: 'Permission denied' };
  }

  async recoverFromDiskSpace(error, context) {
    this.logger.log('error', '💾 Disk space error');
    
    try {
      // Clean up temp files
      await execAsync('rm -rf /tmp/claude-cache/* 2>/dev/null || true');
      await execAsync('rm -rf /tmp/pr-* /tmp/issue-* 2>/dev/null || true');
      
      // Clean npm cache
      await execAsync('npm cache clean --force 2>/dev/null || true');
      
      // Check available space
      const { stdout } = await execAsync('df -h . | tail -1');
      const available = stdout.split(/\s+/)[3];
      
      this.logger.log('info', `Cleaned temp files. Available space: ${available}`);
      
      return {
        success: true,
        action: 'Cleaned temporary files',
        availableSpace: available,
        retry: true
      };
    } catch (err) {
      return {
        success: false,
        reason: 'Insufficient disk space',
        requiresManualIntervention: true
      };
    }
  }

  // Process Recovery Strategies

  async recoverFromOutOfMemory(error, context) {
    this.logger.log('error', '💥 Out of memory error');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.logger.log('info', 'Forced garbage collection');
    }
    
    // Clear caches
    if (context.cache) {
      await context.cache.clear();
      this.logger.log('info', 'Cleared all caches');
    }
    
    return {
      success: true,
      action: 'Cleared memory and caches',
      suggestion: 'Consider breaking operation into smaller chunks',
      retry: true
    };
  }

  async recoverFromProcessKilled(error, context) {
    this.logger.log('error', '☠️ Process was killed');
    
    return {
      success: false,
      reason: 'Process terminated externally',
      suggestion: 'Check system resources and timeout settings',
      requiresManualIntervention: true
    };
  }

  // Claude API Recovery Strategies

  async recoverFromClaudeOverload(error, context) {
    this.logger.log('warn', '🔥 Claude API overloaded');
    
    const delay = 30000; // 30 seconds
    
    this.logger.log('info', `Waiting ${delay}ms for Claude API recovery`);
    await this.sleep(delay);
    
    return {
      success: true,
      action: `Waited ${delay}ms for API recovery`,
      retry: true
    };
  }

  async recoverFromContextLength(error, context) {
    this.logger.log('error', '📏 Context length exceeded');
    
    return {
      success: false,
      reason: 'Message exceeds token limit',
      suggestion: 'Reduce context size or split into multiple requests',
      requiresManualIntervention: true
    };
  }

  // Helper Methods

  extractRateLimitReset(error) {
    const patterns = [
      /reset[s]?\s+(?:at|in)\s+(\d+)/i,
      /x-ratelimit-reset:\s*(\d+)/i,
      /retry-after:\s*(\d+)/i
    ];
    
    const errorString = `${error.message} ${error.headers || ''}`;
    
    for (const pattern of patterns) {
      const match = errorString.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        // Check if it's a timestamp or duration
        if (value > 1000000000) {
          return value * 1000; // Convert seconds to milliseconds
        } else {
          return Date.now() + (value * 1000);
        }
      }
    }
    
    return null;
  }

  calculateBackoffDelay(attempt) {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt - 1),
      this.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.floor(delay + jitter);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics
   */
  getStats() {
    const recoveryRate = this.stats.totalErrors > 0
      ? (this.stats.recoveredErrors / this.stats.totalErrors * 100).toFixed(1)
      : 0;
    
    return {
      ...this.stats,
      recoveryRate: `${recoveryRate}%`,
      topStrategies: Object.entries(this.stats.recoveryStrategies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    };
  }
}

module.exports = { ErrorRecoveryEnhanced };