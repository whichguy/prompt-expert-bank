/**
 * Simple Error Recovery System
 * Reduced to essential recovery strategies only
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SimpleErrorRecovery {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
  }

  /**
   * Attempt recovery with exponential backoff
   */
  async attemptRecovery(error, context = {}) {
    
    // Check recursion depth
    const depth = context._recoveryDepth || 0;
    if (depth > 3) {
      console.error('Max recovery depth reached');
      return { success: false, reason: 'Max recursion depth' };
    }
    
    // Update context with depth for next iteration
    context._recoveryDepth = depth + 1;
    
    const errorMessage = error.message || String(error);
    
    // Try essential recovery strategies
    let result = { success: false };
    
    // 1. Git lock files
    if (errorMessage.match(/index\.lock|\.lock exists/i)) {
      result = await this.recoverFromGitLock();
    }
    // 2. Rate limiting
    else if (errorMessage.match(/rate limit|429/i)) {
      result = await this.recoverFromRateLimit(error);
    }
    // 3. Network timeout/retry
    else if (errorMessage.match(/timeout|ETIMEDOUT|ECONNREFUSED/i)) {
      result = await this.recoverFromNetworkError(context);
    }
    // 4. Authentication
    else if (errorMessage.match(/401|unauthorized/i)) {
      result = await this.recoverFromAuthError();
    }
    
    return result;
  }

  /**
   * Remove git lock files
   */
  async recoverFromGitLock() {
    try {
      await execAsync('rm -f .git/index.lock .git/HEAD.lock 2>/dev/null || true');
      return {
        success: true,
        action: 'Removed git lock files',
        retry: true
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle rate limiting with simple backoff
   */
  async recoverFromRateLimit(error) {
    // Simple rate limit wait - default 60 seconds
    const match = (error.message || '').match(/(\d+)\s*seconds?/i);
    const waitTime = match ? Math.min(parseInt(match[1]) * 1000, 300000) : 60000;
    
    // Don't wait more than 5 minutes
    if (waitTime > 300000) {
      return { success: false, reason: 'Rate limit wait too long' };
    }
    
    console.log(`Waiting ${waitTime}ms for rate limit`);
    await this.sleep(waitTime);
    
    return {
      success: true,
      action: 'Waited for rate limit',
      retry: true
    };
  }

  /**
   * Handle network errors with exponential backoff
   */
  async recoverFromNetworkError(context) {
    const attempt = context.attempt || 1;
    
    if (attempt > this.maxRetries) {
      return { success: false, reason: 'Max retries exceeded' };
    }
    
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt - 1),
      30000 // Max 30 seconds
    );
    
    console.log(`Network retry ${attempt}/${this.maxRetries}, waiting ${delay}ms`);
    await this.sleep(delay);
    
    return {
      success: true,
      action: `Network retry with ${delay}ms backoff`,
      retry: true,
      context: { ...context, attempt: attempt + 1 }
    };
  }

  /**
   * Check authentication
   */
  async recoverFromAuthError() {
    const hasGitHubToken = !!process.env.GITHUB_TOKEN;
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    
    if (!hasGitHubToken || !hasAnthropicKey) {
      return {
        success: false,
        reason: 'Missing API credentials',
        requiresManualIntervention: true
      };
    }
    
    // Try to refresh GitHub CLI auth if available
    try {
      await execAsync('gh auth status 2>&1');
      return {
        success: true,
        action: 'Authentication verified',
        retry: true
      };
    } catch {
      return {
        success: false,
        reason: 'Authentication failed',
        requiresManualIntervention: true
      };
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}

module.exports = { SimpleErrorRecovery };