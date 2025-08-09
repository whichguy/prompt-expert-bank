/**
 * Simple Error Handler with Logging
 * Provides clean error handling and logging without overcomplication
 */

class SimpleErrorHandler {
  constructor(context = {}) {
    this.context = context;
    this.errors = [];
  }

  /**
   * Simple log function - just what we need
   */
  log(level, message, data = {}) {
    const entry = {
      time: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data
    };

    // GitHub Actions format if in CI
    if (process.env.GITHUB_ACTIONS === 'true') {
      switch (level) {
        case 'error':
          console.error(`::error::${message}`);
          break;
        case 'warn':
          console.warn(`::warning::${message}`);
          break;
        case 'debug':
          if (process.env.DEBUG) console.log(`::debug::${message}`);
          break;
        default:
          console.log(message);
      }
    } else {
      // Simple local format
      console.log(`[${level.toUpperCase()}] ${message}`);
    }

    // Store errors for summary
    if (level === 'error') {
      this.errors.push({ message, data, time: entry.time });
    }

    // Debug mode shows full data
    if (process.env.DEBUG && Object.keys(data).length > 0) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  /**
   * Wrap async function with error handling
   */
  async wrap(fn, errorMessage = 'Operation failed') {
    try {
      return await fn();
    } catch (error) {
      this.log('error', `${errorMessage}: ${error.message}`, {
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * Try operation with fallback
   */
  async tryWithFallback(primary, fallback, context = '') {
    try {
      return await primary();
    } catch (error) {
      this.log('warn', `${context} failed, using fallback`, {
        error: error.message
      });
      return await fallback();
    }
  }

  /**
   * Safe file operations
   */
  async safeReadFile(path, defaultValue = null) {
    try {
      const fs = require('fs').promises;
      return await fs.readFile(path, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log('debug', `File not found: ${path}`);
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Safe JSON parse
   */
  safeJsonParse(text, defaultValue = null) {
    try {
      return JSON.parse(text);
    } catch (error) {
      this.log('warn', 'Invalid JSON', { error: error.message });
      return defaultValue;
    }
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    if (this.errors.length === 0) {
      return 'No errors occurred';
    }
    
    return `${this.errors.length} error(s) occurred:\n` +
      this.errors.map((e, i) => `${i + 1}. ${e.message}`).join('\n');
  }

  /**
   * Exit with proper code and summary
   */
  exit(code = 0) {
    if (this.errors.length > 0) {
      console.error('\n=== Error Summary ===');
      console.error(this.getErrorSummary());
    }
    process.exit(code || (this.errors.length > 0 ? 1 : 0));
  }
}

module.exports = { SimpleErrorHandler };