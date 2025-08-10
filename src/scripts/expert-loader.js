/**
 * Expert Loader - Loads expert definitions from local and GitHub sources
 */

const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');

class ExpertLoader {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.octokit = options.octokit || new Octokit({ auth: process.env.GITHUB_TOKEN });
    this.expertAliases = {
      'programming': 'programming-expert',
      'security': 'security-expert',
      'data-analysis': 'data-analysis-expert',
      'financial': 'financial-expert',
      'general': 'general-expert'
    };
  }

  async initialize() {
    // Load expert index if available
    try {
      const indexPath = path.join(this.baseDir, 'experts', 'index.json');
      const indexContent = await fs.readFile(indexPath, 'utf8');
      this.expertIndex = JSON.parse(indexContent);
    } catch (error) {
      // No index file, that's ok
      this.expertIndex = {};
    }
  }

  async loadExpert(expertSpec) {
    // Check if it's an alias
    if (this.expertAliases[expertSpec]) {
      expertSpec = this.expertAliases[expertSpec];
    }

    // Try loading from local experts folder first
    try {
      const localPath = path.join(this.baseDir, 'experts', `${expertSpec}.md`);
      const content = await fs.readFile(localPath, 'utf8');
      return {
        content,
        source: 'local',
        path: localPath,
        name: expertSpec
      };
    } catch (error) {
      // Not found locally
    }

    // Try loading from GitHub if format is owner/repo:path
    if (expertSpec.includes(':')) {
      const [repo, filePath] = expertSpec.split(':');
      const [owner, repoName] = repo.split('/');
      
      try {
        const { data } = await this.octokit.repos.getContent({
          owner,
          repo: repoName,
          path: filePath
        });
        
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return {
          content,
          source: 'github',
          repo: `${owner}/${repoName}`,
          path: filePath,
          name: expertSpec
        };
      } catch (error) {
        throw new Error(`Failed to load expert from GitHub: ${error.message}`);
      }
    }

    // Try loading from whichguy/prompt-expert-bank as default
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: 'whichguy',
        repo: 'prompt-expert-bank',
        path: `experts/${expertSpec}.md`
      });
      
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      return {
        content,
        source: 'github',
        repo: 'whichguy/prompt-expert-bank',
        path: `experts/${expertSpec}.md`,
        name: expertSpec
      };
    } catch (error) {
      throw new Error(`Expert not found: ${expertSpec}`);
    }
  }
}

module.exports = ExpertLoader;