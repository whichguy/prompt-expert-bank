/**
 * Simple Health Check System
 * Reduced to essential checks only
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SimpleHealthCheck {
  constructor() {
    this.results = {
      healthy: true,
      checks: [],
      errors: []
    };
  }

  /**
   * Run essential health checks
   */
  async run() {
    console.log('Running health checks...');
    
    // Check environment variables
    this.checkEnvironment();
    
    // Check Node.js version
    this.checkNodeVersion();
    
    // Check API connectivity
    await this.checkAPIs();
    
    // Check Git status
    await this.checkGit();
    
    // Determine overall health
    this.results.healthy = this.results.errors.length === 0;
    
    return this.results;
  }

  /**
   * Check required environment variables
   */
  checkEnvironment() {
    const required = [
      'GITHUB_TOKEN',
      'ANTHROPIC_API_KEY',
      'GITHUB_REPOSITORY'
    ];
    
    for (const key of required) {
      if (process.env[key]) {
        this.results.checks.push({
          name: key,
          status: 'pass',
          value: key.includes('KEY') || key.includes('TOKEN') ? '***' : process.env[key]
        });
      } else {
        this.results.checks.push({
          name: key,
          status: 'fail',
          error: 'Not set'
        });
        this.results.errors.push(`Missing ${key}`);
      }
    }
  }

  /**
   * Check Node.js version
   */
  checkNodeVersion() {
    const version = process.version;
    const major = parseInt(version.split('.')[0].substring(1));
    
    if (major >= 18) {
      this.results.checks.push({
        name: 'Node.js',
        status: 'pass',
        value: version
      });
    } else {
      this.results.checks.push({
        name: 'Node.js',
        status: 'warn',
        value: version,
        warning: `Version ${version} is older than recommended v18+`
      });
    }
  }

  /**
   * Check API connectivity
   */
  async checkAPIs() {
    // Check GitHub token validity
    if (process.env.GITHUB_TOKEN) {
      try {
        await execAsync('gh auth status 2>&1');
        this.results.checks.push({
          name: 'GitHub API',
          status: 'pass',
          value: 'Connected'
        });
      } catch (error) {
        this.results.checks.push({
          name: 'GitHub API',
          status: 'fail',
          error: 'Not authenticated'
        });
        this.results.errors.push('GitHub authentication failed');
      }
    }
    
    // Anthropic API key is checked by presence only
    if (process.env.ANTHROPIC_API_KEY) {
      this.results.checks.push({
        name: 'Anthropic API',
        status: 'pass',
        value: 'Key present'
      });
    }
  }

  /**
   * Check Git repository status
   */
  async checkGit() {
    try {
      const { stdout: branch } = await execAsync('git branch --show-current || echo "none"');
      
      this.results.checks.push({
        name: 'Git',
        status: 'pass',
        value: `Branch: ${branch.trim()}`
      });
      
      // Check for uncommitted changes
      const { stdout: status } = await execAsync('git status --porcelain || echo ""');
      if (status.trim()) {
        const changes = status.trim().split('\n').length;
        this.results.checks.push({
          name: 'Working Directory',
          status: 'warn',
          value: `${changes} uncommitted changes`
        });
      }
    } catch (error) {
      this.results.checks.push({
        name: 'Git',
        status: 'warn',
        value: 'Not in git repository'
      });
    }
  }

  /**
   * Format results as simple text
   */
  formatResults() {
    const status = this.results.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY';
    
    let output = `Health Check: ${status}\n\n`;
    
    for (const check of this.results.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      output += `${icon} ${check.name}: ${check.value || check.error || check.warning}\n`;
    }
    
    if (this.results.errors.length > 0) {
      output += `\nErrors:\n`;
      this.results.errors.forEach(err => {
        output += `- ${err}\n`;
      });
    }
    
    return output;
  }
}

module.exports = { SimpleHealthCheck };