/**
 * Simple Error Handler with Logging
 * Clean error handling without overcomplication
 */

class ErrorHandler {
  constructor(context = {}) {
    this.context = context;
    this.errors = [];
  }

  log(level, message, data = {}) {
    // GitHub Actions format if in CI
    if (process.env.GITHUB_ACTIONS === 'true') {
      const prefix = level === 'error' ? '::error::' : 
                     level === 'warn' ? '::warning::' : '';
      console.log(`${prefix}${message}`);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }

    if (level === 'error') {
      this.errors.push({ message, data });
    }

    if (process.env.DEBUG && Object.keys(data).length > 0) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  async wrap(fn, errorMessage) {
    try {
      return await fn();
    } catch (error) {
      this.log('error', `${errorMessage}: ${error.message}`);
      throw error;
    }
  }

  async tryWithFallback(primary, fallback) {
    try {
      return await primary();
    } catch (error) {
      this.log('warn', `Primary failed: ${error.message}, using fallback`);
      return await fallback();
    }
  }

  exit(code = 0) {
    if (this.errors.length > 0) {
      console.error(`\n${this.errors.length} error(s) occurred`);
    }
    process.exit(code || (this.errors.length > 0 ? 1 : 0));
  }
}

module.exports = { ErrorHandler };