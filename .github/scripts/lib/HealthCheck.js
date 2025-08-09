/**
 * Health Check System for Claude Code Integration
 * Production readiness verification and monitoring
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const execAsync = promisify(exec);

class HealthCheck {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.timeout = options.timeout || 5000;
    
    this.checks = {
      environment: [],
      dependencies: [],
      apis: [],
      filesystem: [],
      git: [],
      performance: []
    };
    
    this.results = {
      timestamp: Date.now(),
      healthy: true,
      checks: {},
      warnings: [],
      errors: [],
      recommendations: []
    };
  }

  /**
   * Run all health checks
   */
  async runAll() {
    this.logger.log('info', '🏥 Starting health checks...');
    const startTime = Date.now();
    
    try {
      // Run checks in parallel where possible
      const [
        envResults,
        depResults,
        apiResults,
        fsResults,
        gitResults,
        perfResults
      ] = await Promise.all([
        this.checkEnvironment(),
        this.checkDependencies(),
        this.checkAPIs(),
        this.checkFilesystem(),
        this.checkGit(),
        this.checkPerformance()
      ]);
      
      // Compile results
      this.results.checks = {
        environment: envResults,
        dependencies: depResults,
        apis: apiResults,
        filesystem: fsResults,
        git: gitResults,
        performance: perfResults
      };
      
      // Determine overall health
      this.results.healthy = this.results.errors.length === 0;
      
      // Generate recommendations
      this.generateRecommendations();
      
      const duration = Date.now() - startTime;
      this.logger.log('info', `Health checks completed in ${duration}ms`, {
        healthy: this.results.healthy,
        warnings: this.results.warnings.length,
        errors: this.results.errors.length
      });
      
      return this.results;
      
    } catch (error) {
      this.logger.log('error', 'Health check failed', {
        error: error.message
      });
      
      this.results.healthy = false;
      this.results.errors.push({
        check: 'system',
        message: error.message
      });
      
      return this.results;
    }
  }

  /**
   * Check environment variables and configuration
   */
  async checkEnvironment() {
    const results = {
      passed: [],
      failed: [],
      warnings: []
    };
    
    // Required environment variables
    const required = [
      'GITHUB_TOKEN',
      'ANTHROPIC_API_KEY',
      'GITHUB_REPOSITORY'
    ];
    
    for (const key of required) {
      if (process.env[key]) {
        results.passed.push({
          name: key,
          value: key.includes('KEY') || key.includes('TOKEN') 
            ? '***' 
            : process.env[key]
        });
      } else {
        results.failed.push({
          name: key,
          error: 'Not set'
        });
        
        this.results.errors.push({
          check: 'environment',
          variable: key,
          message: `Required environment variable ${key} is not set`
        });
      }
    }
    
    // Optional but recommended variables
    const recommended = [
      'GITHUB_ACTIONS',
      'GITHUB_WORKSPACE',
      'GITHUB_RUN_ID',
      'RUNNER_DEBUG',
      'CACHE_DIR',
      'MAX_RETRIES'
    ];
    
    for (const key of recommended) {
      if (!process.env[key]) {
        results.warnings.push({
          name: key,
          message: 'Recommended but not set'
        });
        
        this.results.warnings.push({
          check: 'environment',
          variable: key,
          message: `Recommended environment variable ${key} is not set`
        });
      }
    }
    
    // Check GitHub Actions environment
    if (process.env.GITHUB_ACTIONS === 'true') {
      results.passed.push({
        name: 'GitHub Actions',
        value: 'Detected'
      });
      
      // Check for workflow permissions
      if (process.env.GITHUB_TOKEN) {
        try {
          const { stdout } = await execAsync('gh auth status 2>&1');
          if (stdout.includes('Logged in')) {
            results.passed.push({
              name: 'GitHub CLI Auth',
              value: 'Authenticated'
            });
          }
        } catch (error) {
          results.warnings.push({
            name: 'GitHub CLI Auth',
            message: 'Not authenticated'
          });
        }
      }
    }
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (majorVersion >= 18) {
      results.passed.push({
        name: 'Node.js Version',
        value: nodeVersion
      });
    } else {
      results.warnings.push({
        name: 'Node.js Version',
        value: nodeVersion,
        message: `Node.js ${nodeVersion} is older than recommended v18+`
      });
      
      this.results.warnings.push({
        check: 'environment',
        message: `Node.js ${nodeVersion} may cause compatibility issues`
      });
    }
    
    return results;
  }

  /**
   * Check required dependencies
   */
  async checkDependencies() {
    const results = {
      passed: [],
      failed: [],
      warnings: []
    };
    
    // Check npm packages
    const requiredPackages = [
      '@anthropic-ai/sdk',
      '@octokit/rest',
      '@octokit/core'
    ];
    
    for (const pkg of requiredPackages) {
      try {
        const modulePath = require.resolve(pkg);
        const packageJson = require(`${pkg}/package.json`);
        
        results.passed.push({
          name: pkg,
          version: packageJson.version
        });
      } catch (error) {
        results.failed.push({
          name: pkg,
          error: 'Not installed'
        });
        
        this.results.errors.push({
          check: 'dependencies',
          package: pkg,
          message: `Required package ${pkg} is not installed`
        });
      }
    }
    
    // Check CLI tools
    const cliTools = [
      { name: 'git', command: 'git --version', required: true },
      { name: 'gh', command: 'gh --version', required: false },
      { name: 'rg', command: 'rg --version', required: false },
      { name: 'jq', command: 'jq --version', required: false }
    ];
    
    for (const tool of cliTools) {
      try {
        const { stdout } = await execAsync(tool.command);
        results.passed.push({
          name: tool.name,
          version: stdout.trim().split('\n')[0]
        });
      } catch (error) {
        if (tool.required) {
          results.failed.push({
            name: tool.name,
            error: 'Not found'
          });
          
          this.results.errors.push({
            check: 'dependencies',
            tool: tool.name,
            message: `Required CLI tool ${tool.name} is not available`
          });
        } else {
          results.warnings.push({
            name: tool.name,
            message: 'Optional tool not found'
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Check API connectivity
   */
  async checkAPIs() {
    const results = {
      passed: [],
      failed: [],
      warnings: []
    };
    
    // Check GitHub API
    if (process.env.GITHUB_TOKEN) {
      try {
        // FIX: Add timeout handling
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('API timeout')), 5000)
        );
        
        const requestPromise = this.httpRequest({
          hostname: 'api.github.com',
          path: '/rate_limit',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
            'User-Agent': 'Claude-Code-Health-Check'
          }
        });
        
        const response = await Promise.race([requestPromise, timeoutPromise]);
        
        const data = JSON.parse(response);
        const remaining = data.rate.remaining;
        const limit = data.rate.limit;
        const resetTime = new Date(data.rate.reset * 1000);
        
        results.passed.push({
          name: 'GitHub API',
          status: 'Connected',
          rateLimit: `${remaining}/${limit}`,
          resetTime: resetTime.toISOString()
        });
        
        if (remaining < 100) {
          results.warnings.push({
            name: 'GitHub API Rate Limit',
            message: `Low rate limit: ${remaining} requests remaining`
          });
          
          this.results.warnings.push({
            check: 'apis',
            api: 'github',
            message: `GitHub API rate limit is low: ${remaining}/${limit}`
          });
        }
      } catch (error) {
        results.failed.push({
          name: 'GitHub API',
          error: error.message
        });
        
        this.results.errors.push({
          check: 'apis',
          api: 'github',
          message: `Cannot connect to GitHub API: ${error.message}`
        });
      }
    }
    
    // Check Anthropic API
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        // Anthropic doesn't have a simple health endpoint, so we'll check with a minimal request
        const response = await this.httpRequest({
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1
          })
        });
        
        results.passed.push({
          name: 'Anthropic API',
          status: 'Connected'
        });
      } catch (error) {
        // Check if it's an auth error or network error
        // FIX: Handle error object more safely
        const errorStr = error.message || error.toString() || '';
        if (errorStr.includes('401') || error.statusCode === 401 || error.status === 401) {
          results.failed.push({
            name: 'Anthropic API',
            error: 'Invalid API key'
          });
          
          this.results.errors.push({
            check: 'apis',
            api: 'anthropic',
            message: 'Invalid Anthropic API key'
          });
        } else {
          results.warnings.push({
            name: 'Anthropic API',
            message: 'Could not verify connectivity'
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Check filesystem permissions and space
   */
  async checkFilesystem() {
    const results = {
      passed: [],
      failed: [],
      warnings: []
    };
    
    // Check workspace directory
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    
    try {
      // Check read/write permissions
      // FIX: Use unique filename with PID to prevent collisions
      const testFile = path.join(workspace, `.health-check-${process.pid}-${Date.now()}.tmp`);
      await fs.writeFile(testFile, 'test', 'utf8');
      await fs.readFile(testFile, 'utf8');
      await fs.unlink(testFile);
      
      results.passed.push({
        name: 'Workspace Permissions',
        value: 'Read/Write OK'
      });
    } catch (error) {
      results.failed.push({
        name: 'Workspace Permissions',
        error: error.message
      });
      
      this.results.errors.push({
        check: 'filesystem',
        message: `Cannot read/write to workspace: ${error.message}`
      });
    }
    
    // Check disk space
    try {
      const { stdout } = await execAsync('df -h . | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const available = parts[3];
      const usePercent = parseInt(parts[4].replace('%', ''));
      
      results.passed.push({
        name: 'Disk Space',
        available,
        usePercent: `${usePercent}%`
      });
      
      if (usePercent > 90) {
        results.warnings.push({
          name: 'Disk Space',
          message: `High disk usage: ${usePercent}%`
        });
        
        this.results.warnings.push({
          check: 'filesystem',
          message: `Disk space is critically low: ${usePercent}% used`
        });
      }
    } catch (error) {
      results.warnings.push({
        name: 'Disk Space',
        message: 'Could not check disk space'
      });
    }
    
    // Check cache directory
    const cacheDir = process.env.CACHE_DIR || '/tmp/claude-cache';
    
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      const stats = await fs.stat(cacheDir);
      
      if (stats.isDirectory()) {
        results.passed.push({
          name: 'Cache Directory',
          value: cacheDir
        });
      }
    } catch (error) {
      results.warnings.push({
        name: 'Cache Directory',
        message: `Cannot create cache directory: ${error.message}`
      });
    }
    
    return results;
  }

  /**
   * Check Git repository status
   */
  async checkGit() {
    const results = {
      passed: [],
      failed: [],
      warnings: []
    };
    
    try {
      // Check if in git repository
      const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel');
      
      results.passed.push({
        name: 'Git Repository',
        value: gitRoot.trim()
      });
      
      // Check for uncommitted changes
      const { stdout: status } = await execAsync('git status --porcelain');
      
      if (status.trim().length === 0) {
        results.passed.push({
          name: 'Working Directory',
          value: 'Clean'
        });
      } else {
        const changes = status.trim().split('\n').length;
        results.warnings.push({
          name: 'Working Directory',
          message: `${changes} uncommitted changes`
        });
        
        this.results.warnings.push({
          check: 'git',
          message: `Working directory has ${changes} uncommitted changes`
        });
      }
      
      // Check current branch
      const { stdout: branch } = await execAsync('git branch --show-current');
      
      results.passed.push({
        name: 'Current Branch',
        value: branch.trim() || 'detached HEAD'
      });
      
      // Check for git locks
      try {
        const { stdout: locks } = await execAsync('find .git -name "*.lock" 2>/dev/null || true');
        
        if (locks.trim()) {
          const lockFiles = locks.trim().split('\n');
          results.warnings.push({
            name: 'Git Locks',
            message: `${lockFiles.length} lock files found`
          });
          
          this.results.warnings.push({
            check: 'git',
            message: `Git lock files detected: ${lockFiles.join(', ')}`
          });
        } else {
          results.passed.push({
            name: 'Git Locks',
            value: 'None'
          });
        }
      } catch (error) {
        // Ignore errors in finding lock files
      }
      
      // Check remote connectivity
      try {
        await execAsync('git ls-remote --heads origin', { timeout: 5000 });
        results.passed.push({
          name: 'Remote Connectivity',
          value: 'Connected'
        });
      } catch (error) {
        results.warnings.push({
          name: 'Remote Connectivity',
          message: 'Cannot connect to remote'
        });
      }
      
    } catch (error) {
      results.failed.push({
        name: 'Git Repository',
        error: 'Not in a git repository'
      });
      
      this.results.warnings.push({
        check: 'git',
        message: 'Not in a git repository'
      });
    }
    
    return results;
  }

  /**
   * Check system performance
   */
  async checkPerformance() {
    const results = {
      passed: [],
      failed: [],
      warnings: []
    };
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
    const heapPercent = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1);
    
    results.passed.push({
      name: 'Memory Usage',
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      usage: `${heapPercent}%`
    });
    
    if (parseFloat(heapPercent) > 80) {
      results.warnings.push({
        name: 'Memory Usage',
        message: `High heap usage: ${heapPercent}%`
      });
      
      this.results.warnings.push({
        check: 'performance',
        message: `High memory usage: ${heapPercent}% of heap`
      });
    }
    
    // Check CPU usage
    const cpuUsage = process.cpuUsage();
    const cpuUser = (cpuUsage.user / 1000000).toFixed(2);
    const cpuSystem = (cpuUsage.system / 1000000).toFixed(2);
    
    results.passed.push({
      name: 'CPU Time',
      user: `${cpuUser}s`,
      system: `${cpuSystem}s`
    });
    
    // Test response time
    const testStart = Date.now();
    await this.sleep(10); // Small async operation
    const responseTime = Date.now() - testStart;
    
    results.passed.push({
      name: 'Event Loop',
      responseTime: `${responseTime}ms`
    });
    
    if (responseTime > 50) {
      results.warnings.push({
        name: 'Event Loop',
        message: `Slow event loop: ${responseTime}ms`
      });
      
      this.results.warnings.push({
        check: 'performance',
        message: `Event loop is slow: ${responseTime}ms response time`
      });
    }
    
    return results;
  }

  /**
   * Generate recommendations based on check results
   */
  generateRecommendations() {
    // Environment recommendations
    if (!process.env.RUNNER_DEBUG) {
      this.results.recommendations.push({
        category: 'debugging',
        message: 'Enable RUNNER_DEBUG=1 for detailed GitHub Actions logs'
      });
    }
    
    if (!process.env.CACHE_DIR) {
      this.results.recommendations.push({
        category: 'performance',
        message: 'Set CACHE_DIR environment variable for better cache management'
      });
    }
    
    // Dependency recommendations
    const hasGitHubCLI = this.results.checks.dependencies?.passed?.some(
      d => d.name === 'gh'
    );
    
    if (!hasGitHubCLI) {
      this.results.recommendations.push({
        category: 'performance',
        message: 'Install GitHub CLI (gh) for faster GitHub operations'
      });
    }
    
    const hasRipgrep = this.results.checks.dependencies?.passed?.some(
      d => d.name === 'rg'
    );
    
    if (!hasRipgrep) {
      this.results.recommendations.push({
        category: 'performance',
        message: 'Install ripgrep (rg) for faster code searching'
      });
    }
    
    // API recommendations
    const githubRateLimit = this.results.checks.apis?.passed?.find(
      a => a.name === 'GitHub API'
    );
    
    if (githubRateLimit && githubRateLimit.rateLimit) {
      const [remaining, limit] = githubRateLimit.rateLimit.split('/').map(Number);
      const percent = (remaining / limit) * 100;
      
      if (percent < 20) {
        this.results.recommendations.push({
          category: 'api',
          message: 'Consider using a Personal Access Token with higher rate limits'
        });
      }
    }
    
    // Performance recommendations
    const memoryUsage = this.results.checks.performance?.passed?.find(
      p => p.name === 'Memory Usage'
    );
    
    if (memoryUsage && parseFloat(memoryUsage.usage) > 70) {
      this.results.recommendations.push({
        category: 'performance',
        message: 'Consider increasing Node.js heap size with --max-old-space-size'
      });
    }
  }

  /**
   * Format health check results as markdown
   */
  formatAsMarkdown() {
    const emoji = this.results.healthy ? '✅' : '❌';
    const status = this.results.healthy ? 'HEALTHY' : 'UNHEALTHY';
    
    let markdown = `
# ${emoji} System Health Check: ${status}

**Timestamp**: ${new Date(this.results.timestamp).toISOString()}

## Check Results

`;

    // Format each category
    for (const [category, checks] of Object.entries(this.results.checks)) {
      const passed = checks.passed?.length || 0;
      const failed = checks.failed?.length || 0;
      const warnings = checks.warnings?.length || 0;
      
      const categoryEmoji = failed > 0 ? '❌' : warnings > 0 ? '⚠️' : '✅';
      
      markdown += `### ${categoryEmoji} ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
      
      if (checks.passed?.length > 0) {
        markdown += '**Passed:**\n';
        checks.passed.forEach(check => {
          markdown += `- ✅ ${check.name}: ${JSON.stringify(check.value || check)}\n`;
        });
        markdown += '\n';
      }
      
      if (checks.warnings?.length > 0) {
        markdown += '**Warnings:**\n';
        checks.warnings.forEach(check => {
          markdown += `- ⚠️ ${check.name}: ${check.message}\n`;
        });
        markdown += '\n';
      }
      
      if (checks.failed?.length > 0) {
        markdown += '**Failed:**\n';
        checks.failed.forEach(check => {
          markdown += `- ❌ ${check.name}: ${check.error}\n`;
        });
        markdown += '\n';
      }
    }
    
    // Add recommendations
    if (this.results.recommendations.length > 0) {
      markdown += `## 💡 Recommendations\n\n`;
      
      this.results.recommendations.forEach(rec => {
        markdown += `- **${rec.category}**: ${rec.message}\n`;
      });
    }
    
    // Add summary
    markdown += `
## Summary

- **Total Errors**: ${this.results.errors.length}
- **Total Warnings**: ${this.results.warnings.length}
- **Recommendations**: ${this.results.recommendations.length}
`;

    return markdown;
  }

  /**
   * HTTP request helper
   */
  httpRequest(options) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { HealthCheck };