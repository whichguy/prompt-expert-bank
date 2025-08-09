/**
 * Simple GitHub CLI Adapter
 * Secure wrapper for GitHub CLI commands
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SimpleGitHubAdapter {
  constructor(options = {}) {
    this.repo = options.repo || process.env.GITHUB_REPOSITORY;
    this.token = options.token || process.env.GITHUB_TOKEN;
    
    if (!this.repo) {
      throw new Error('GitHub repository not specified');
    }
    
    const [owner, name] = this.repo.split('/');
    this.owner = owner;
    this.repoName = name;
  }

  /**
   * Execute GitHub CLI command safely
   */
  async execute(command, args = []) {
    // Validate command is allowed
    const allowedCommands = [
      'api', 'pr', 'issue', 'repo', 'auth', 'workflow', 'release'
    ];
    
    if (!allowedCommands.includes(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }
    
    // Build safe command
    const safeArgs = args.map(arg => this.escapeShellArg(String(arg)));
    const fullCommand = `gh ${command} ${safeArgs.join(' ')}`;
    
    try {
      const { stdout } = await execAsync(fullCommand, {
        env: { ...process.env, GITHUB_TOKEN: this.token },
        timeout: 30000
      });
      
      // Try to parse JSON response
      try {
        return JSON.parse(stdout);
      } catch {
        return stdout.trim();
      }
    } catch (error) {
      throw new Error(`GitHub CLI error: ${error.message}`);
    }
  }

  /**
   * Escape shell arguments to prevent injection
   */
  escapeShellArg(arg) {
    // Use single quotes and escape any single quotes in the string
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Common GitHub operations
   */
  
  async getPullRequest(number) {
    return this.execute('pr', ['view', number, '--json', 'title,body,state,author,files']);
  }

  async createComment(number, body, type = 'issue') {
    return this.execute(type, ['comment', number, '--body', body]);
  }

  async listFiles(ref = 'HEAD') {
    return this.execute('api', [
      `/repos/${this.repo}/git/trees/${ref}`,
      '--jq', '.tree[].path'
    ]);
  }

  async getFileContent(path, ref = 'main') {
    return this.execute('api', [
      `/repos/${this.repo}/contents/${path}?ref=${ref}`,
      '-H', 'Accept: application/vnd.github.v3.raw'
    ]);
  }

  async getRateLimit() {
    return this.execute('api', ['/rate_limit']);
  }

  async getUser() {
    return this.execute('api', ['/user']);
  }
}

module.exports = { SimpleGitHubAdapter };