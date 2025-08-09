/**
 * Secure GitHub CLI Adapter with Input Validation
 * Fixes command injection vulnerabilities
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const execAsync = promisify(exec);

class GitHubCLIAdapter {
  constructor(logger) {
    this.logger = logger || console;
    this.isAuthenticated = false;
  }

  /**
   * Escape shell arguments to prevent command injection
   */
  escapeShellArg(arg) {
    if (typeof arg !== 'string') {
      arg = String(arg);
    }
    // Remove any existing quotes and escape special characters
    return arg
      .replace(/[\\"'`$]/g, '\\$&')  // Escape quotes and shell special chars
      .replace(/\n/g, '\\n')          // Escape newlines
      .replace(/\r/g, '\\r')          // Escape carriage returns
      .replace(/\t/g, '\\t');         // Escape tabs
  }

  /**
   * Validate repository name format
   */
  validateRepo(repo) {
    const repoPattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    if (!repoPattern.test(repo)) {
      throw new Error(`Invalid repository format: ${repo}`);
    }
    return repo;
  }

  /**
   * Validate PR/Issue number
   */
  validateNumber(number) {
    const num = parseInt(number);
    if (isNaN(num) || num < 1 || num > 999999) {
      throw new Error(`Invalid number: ${number}`);
    }
    return num;
  }

  /**
   * Generate secure temp file name
   */
  generateTempFileName(prefix) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `/tmp/${prefix}-${timestamp}-${random}.txt`;
  }

  /**
   * Verify GitHub CLI is available and authenticated
   */
  async verify() {
    try {
      const { stdout } = await execAsync('gh auth status');
      this.isAuthenticated = stdout.includes('Logged in');
      
      if (!this.isAuthenticated) {
        throw new Error('GitHub CLI not authenticated. Set GH_TOKEN environment variable.');
      }
      
      const { stdout: version } = await execAsync('gh --version');
      this.logger.log('info', `GitHub CLI ready: ${version.split('\\n')[0]}`);
      
      return true;
    } catch (error) {
      this.logger.log('error', 'GitHub CLI verification failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute GitHub CLI command with error handling and validation
   */
  async execute(command, options = {}) {
    const { json = true, silent = false } = options;
    
    try {
      // Check if command supports --json flag
      const supportsJson = [
        'pr view', 'pr list', 'issue view', 'issue list',
        'repo view', 'run list', 'workflow list', 'release list'
      ].some(c => command.startsWith(c));
      
      const cmd = json && supportsJson ? `${command} --json` : command;
      
      if (!silent) {
        this.logger.log('debug', `Executing: gh ${cmd}`);
      }
      
      const { stdout, stderr } = await execAsync(`gh ${cmd}`);
      
      if (stderr && !silent) {
        this.logger.log('warn', 'GitHub CLI stderr', { stderr });
      }
      
      if (json && supportsJson && stdout) {
        try {
          return JSON.parse(stdout);
        } catch (e) {
          this.logger.log('warn', 'Failed to parse JSON output', { 
            error: e.message,
            output: stdout.substring(0, 200) 
          });
          return stdout;
        }
      }
      
      return stdout;
    } catch (error) {
      this.logger.log('error', `GitHub CLI command failed: ${command}`, {
        error: error.message,
        stdout: error?.stdout,
        stderr: error?.stderr
      });
      throw error;
    }
  }

  // Pull Request Operations (Secured)

  async getPR(repo, number) {
    const validRepo = this.validateRepo(repo);
    const validNumber = this.validateNumber(number);
    
    const fields = 'number,title,body,state,draft,author,headRefName,baseRefName,labels,assignees,url';
    return this.execute(`pr view ${validNumber} -R ${validRepo} --json ${fields}`);
  }

  async addPRLabels(repo, number, labels) {
    const validRepo = this.validateRepo(repo);
    const validNumber = this.validateNumber(number);
    
    // Validate and escape each label
    const escapedLabels = labels.map(label => this.escapeShellArg(label));
    const labelsStr = escapedLabels.join(',');
    
    return this.execute(`pr edit ${validNumber} -R ${validRepo} --add-label "${labelsStr}"`, { json: false });
  }

  async updatePRBody(repo, number, body) {
    const validRepo = this.validateRepo(repo);
    const validNumber = this.validateNumber(number);
    
    // Write body to secure temp file
    const fs = require('fs').promises;
    const tmpFile = this.generateTempFileName('pr-body');
    
    try {
      await fs.writeFile(tmpFile, body, { mode: 0o600 }); // Secure file permissions
      const result = await this.execute(`pr edit ${validNumber} -R ${validRepo} --body-file ${tmpFile}`, { json: false });
      
      // Clean up temp file
      await fs.unlink(tmpFile).catch(err => {
        this.logger.log('warn', 'Failed to delete temp file', { file: tmpFile, error: err.message });
      });
      
      return result;
    } catch (error) {
      // Ensure cleanup even on error
      await fs.unlink(tmpFile).catch(() => {});
      throw error;
    }
  }

  async addPRComment(repo, number, body) {
    const validRepo = this.validateRepo(repo);
    const validNumber = this.validateNumber(number);
    
    // Write comment to secure temp file
    const fs = require('fs').promises;
    const tmpFile = this.generateTempFileName('pr-comment');
    
    try {
      await fs.writeFile(tmpFile, body, { mode: 0o600 });
      const result = await this.execute(`pr comment ${validNumber} -R ${validRepo} --body-file ${tmpFile}`, { json: false });
      
      await fs.unlink(tmpFile).catch(err => {
        this.logger.log('warn', 'Failed to delete temp file', { file: tmpFile, error: err.message });
      });
      
      return result;
    } catch (error) {
      await fs.unlink(tmpFile).catch(() => {});
      throw error;
    }
  }

  // Issue Operations (Secured)

  async getIssue(repo, number) {
    const validRepo = this.validateRepo(repo);
    const validNumber = this.validateNumber(number);
    
    const fields = 'number,title,body,state,author,labels,assignees,url,createdAt,updatedAt';
    return this.execute(`issue view ${validNumber} -R ${validRepo} --json ${fields}`);
  }

  async addIssueLabels(repo, number, labels) {
    const validRepo = this.validateRepo(repo);
    const validNumber = this.validateNumber(number);
    
    // Validate and escape each label
    const escapedLabels = labels.map(label => this.escapeShellArg(label));
    const labelsStr = escapedLabels.join(',');
    
    return this.execute(`issue edit ${validNumber} -R ${validRepo} --add-label "${labelsStr}"`, { json: false });
  }

  async addIssueComment(repo, number, body) {
    const validRepo = this.validateRepo(repo);
    const validNumber = this.validateNumber(number);
    
    const fs = require('fs').promises;
    const tmpFile = this.generateTempFileName('issue-comment');
    
    try {
      await fs.writeFile(tmpFile, body, { mode: 0o600 });
      const result = await this.execute(`issue comment ${validNumber} -R ${validRepo} --body-file ${tmpFile}`, { json: false });
      
      await fs.unlink(tmpFile).catch(err => {
        this.logger.log('warn', 'Failed to delete temp file', { file: tmpFile, error: err.message });
      });
      
      return result;
    } catch (error) {
      await fs.unlink(tmpFile).catch(() => {});
      throw error;
    }
  }

  // Repository Operations (Secured)

  async getRepo(repo) {
    const validRepo = this.validateRepo(repo);
    const fields = 'name,owner,description,defaultBranchRef,isPrivate,url';
    return this.execute(`repo view ${validRepo} --json ${fields}`);
  }

  async triggerWorkflow(repo, workflow, ref = 'main', inputs = {}) {
    const validRepo = this.validateRepo(repo);
    
    // Validate workflow name
    if (!/^[a-zA-Z0-9_.-]+$/.test(workflow)) {
      throw new Error(`Invalid workflow name: ${workflow}`);
    }
    
    // Validate ref
    if (!/^[a-zA-Z0-9/_.-]+$/.test(ref)) {
      throw new Error(`Invalid ref: ${ref}`);
    }
    
    // Escape input values
    const inputFlags = Object.entries(inputs)
      .map(([key, value]) => {
        const escapedKey = this.escapeShellArg(key);
        const escapedValue = this.escapeShellArg(value);
        return `-f ${escapedKey}="${escapedValue}"`;
      })
      .join(' ');
    
    return this.execute(`workflow run ${workflow} -R ${validRepo} --ref ${ref} ${inputFlags}`, { json: false });
  }
}

module.exports = { GitHubCLIAdapter };