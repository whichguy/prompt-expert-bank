#!/usr/bin/env node

/**
 * Expert Loader
 * Loads expert definitions from aliases, local paths, or remote repositories
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

class ExpertLoader {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.aliasFile = options.aliasFile || path.join(this.baseDir, 'expert-aliases.json');
    this.cacheDir = options.cacheDir || path.join(this.baseDir, '.expert-cache');
    this.maxCacheAge = options.maxCacheAge || 3600000; // 1 hour default
    this.aliases = null;
  }

  async initialize() {
    console.log('[EXPERT-LOADER] Initializing expert loader...');
    
    // Load alias configuration
    try {
      const aliasData = await fs.readFile(this.aliasFile, 'utf8');
      this.aliases = JSON.parse(aliasData);
      console.log(`[EXPERT-LOADER] Loaded ${Object.keys(this.aliases.aliases).length} expert aliases`);
    } catch (error) {
      console.log('[EXPERT-LOADER] No alias file found, using defaults');
      this.aliases = {
        aliases: {},
        customPaths: {
          allowRemoteRepos: true,
          allowLocalPaths: true,
          cacheDuration: 3600,
          maxFileSize: 100000
        }
      };
    }

    // Ensure cache directory exists
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Load expert definition from alias or path
   * @param {string} expertSpec - Alias name, local path, or repo:path format
   * @returns {object} Expert definition and metadata
   */
  async loadExpert(expertSpec) {
    console.log(`[EXPERT-LOADER] Loading expert: ${expertSpec}`);
    
    if (!this.aliases) {
      await this.initialize();
    }

    // Check if it's an alias
    if (this.aliases.aliases[expertSpec]) {
      console.log(`[EXPERT-LOADER] Found alias: ${expertSpec}`);
      return await this.loadFromAlias(expertSpec);
    }

    // Check if it's a repo:path format (e.g., "myorg/myrepo:prompts/expert.md")
    if (expertSpec.includes(':')) {
      const [repo, filePath] = expertSpec.split(':', 2);
      console.log(`[EXPERT-LOADER] Loading from repo: ${repo}, path: ${filePath}`);
      return await this.loadFromRepo(repo, filePath);
    }

    // Check if it's a local file path
    if (expertSpec.includes('/') || expertSpec.includes('\\')) {
      console.log(`[EXPERT-LOADER] Loading from local path: ${expertSpec}`);
      return await this.loadFromPath(expertSpec);
    }

    // Try as a default expert name (backward compatibility)
    const defaultPath = path.join(this.baseDir, 'expert-definitions', `${expertSpec}-expert.md`);
    if (await this.fileExists(defaultPath)) {
      console.log(`[EXPERT-LOADER] Loading default expert: ${expertSpec}`);
      return await this.loadFromPath(defaultPath);
    }

    throw new Error(`Expert not found: ${expertSpec}. Use an alias, local path, or repo:path format.`);
  }

  /**
   * Load expert from alias configuration
   */
  async loadFromAlias(aliasName) {
    const alias = this.aliases.aliases[aliasName];
    
    if (alias.repo) {
      // Remote repository
      console.log(`[EXPERT-LOADER] Alias points to repo: ${alias.repo}`);
      return await this.loadFromRepo(alias.repo, alias.path);
    } else if (alias.local) {
      // Local path relative to project
      const fullPath = path.resolve(this.baseDir, alias.path);
      console.log(`[EXPERT-LOADER] Alias points to local file: ${fullPath}`);
      return await this.loadFromPath(fullPath);
    } else {
      // Default location
      const fullPath = path.join(this.baseDir, alias.path);
      console.log(`[EXPERT-LOADER] Alias points to default location: ${fullPath}`);
      return await this.loadFromPath(fullPath);
    }
  }

  /**
   * Load expert from repository
   */
  async loadFromRepo(repo, filePath) {
    // Check cache first
    const cacheKey = `${repo.replace(/[^a-zA-Z0-9]/g, '_')}_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const cachePath = path.join(this.cacheDir, `${cacheKey}.md`);
    const cacheMetaPath = path.join(this.cacheDir, `${cacheKey}.meta.json`);

    // Check if cached version exists and is fresh
    try {
      const meta = JSON.parse(await fs.readFile(cacheMetaPath, 'utf8'));
      const age = Date.now() - new Date(meta.cached).getTime();
      
      if (age < this.maxCacheAge) {
        console.log(`[EXPERT-LOADER] Using cached expert (age: ${Math.round(age/1000)}s)`);
        const content = await fs.readFile(cachePath, 'utf8');
        return {
          content: content,
          source: 'cache',
          repo: repo,
          path: filePath,
          cached: meta.cached,
          metadata: meta
        };
      }
    } catch (error) {
      // Cache miss or expired
    }

    // Determine if it's a GitHub repo
    if (repo.includes('github.com') || repo.match(/^[\w-]+\/[\w-]+$/)) {
      return await this.loadFromGitHub(repo, filePath, cachePath, cacheMetaPath);
    }

    // Local repository path
    if (repo.startsWith('./') || repo.startsWith('../') || repo.startsWith('/')) {
      return await this.loadFromLocalRepo(repo, filePath, cachePath, cacheMetaPath);
    }

    throw new Error(`Unsupported repository format: ${repo}`);
  }

  /**
   * Load expert from GitHub repository
   */
  async loadFromGitHub(repo, filePath, cachePath, cacheMetaPath) {
    let owner, repoName, branch = 'main';
    
    // Parse GitHub URL or shorthand
    if (repo.includes('github.com')) {
      const match = repo.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        owner = match[1];
        repoName = match[2].replace('.git', '');
      }
    } else if (repo.match(/^[\w-]+\/[\w-]+$/)) {
      [owner, repoName] = repo.split('/');
    }

    if (!owner || !repoName) {
      throw new Error(`Invalid GitHub repository: ${repo}`);
    }

    // Try to fetch from GitHub raw content
    const urls = [
      `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${filePath}`,
      `https://raw.githubusercontent.com/${owner}/${repoName}/master/${filePath}` // fallback to master
    ];

    console.log(`[EXPERT-LOADER] Fetching from GitHub: ${owner}/${repoName}`);

    for (const url of urls) {
      try {
        const content = await this.fetchUrl(url);
        
        // Cache the content
        await fs.writeFile(cachePath, content, 'utf8');
        const metadata = {
          repo: `${owner}/${repoName}`,
          branch: url.includes('/master/') ? 'master' : branch,
          path: filePath,
          cached: new Date().toISOString(),
          url: url,
          size: content.length
        };
        await fs.writeFile(cacheMetaPath, JSON.stringify(metadata, null, 2), 'utf8');
        
        console.log(`[EXPERT-LOADER] Successfully loaded and cached expert from GitHub`);
        
        return {
          content: content,
          source: 'github',
          repo: `${owner}/${repoName}`,
          path: filePath,
          branch: metadata.branch,
          metadata: metadata
        };
      } catch (error) {
        console.log(`[EXPERT-LOADER] Failed to fetch from ${url}: ${error.message}`);
      }
    }

    throw new Error(`Could not fetch expert from GitHub: ${owner}/${repoName}/${filePath}`);
  }

  /**
   * Load expert from local repository
   */
  async loadFromLocalRepo(repoPath, filePath, cachePath, cacheMetaPath) {
    const fullRepoPath = path.resolve(this.baseDir, repoPath);
    const fullFilePath = path.join(fullRepoPath, filePath);
    
    console.log(`[EXPERT-LOADER] Loading from local repo: ${fullRepoPath}`);
    
    if (!await this.fileExists(fullFilePath)) {
      throw new Error(`Expert file not found: ${fullFilePath}`);
    }

    const content = await fs.readFile(fullFilePath, 'utf8');
    
    // Cache the content
    await fs.writeFile(cachePath, content, 'utf8');
    const metadata = {
      repo: repoPath,
      path: filePath,
      cached: new Date().toISOString(),
      local: true,
      fullPath: fullFilePath,
      size: content.length
    };
    await fs.writeFile(cacheMetaPath, JSON.stringify(metadata, null, 2), 'utf8');
    
    console.log(`[EXPERT-LOADER] Successfully loaded expert from local repo`);
    
    return {
      content: content,
      source: 'local-repo',
      repo: repoPath,
      path: filePath,
      metadata: metadata
    };
  }

  /**
   * Load expert from local file path
   */
  async loadFromPath(filePath) {
    const fullPath = path.resolve(this.baseDir, filePath);
    
    if (!await this.fileExists(fullPath)) {
      throw new Error(`Expert file not found: ${fullPath}`);
    }

    console.log(`[EXPERT-LOADER] Loading from path: ${fullPath}`);
    const content = await fs.readFile(fullPath, 'utf8');
    
    return {
      content: content,
      source: 'local',
      path: fullPath,
      metadata: {
        size: content.length,
        modified: (await fs.stat(fullPath)).mtime.toISOString()
      }
    };
  }

  /**
   * Fetch content from URL
   */
  async fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      client.get(url, (response) => {
        if (response.statusCode === 200) {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
        } else if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          this.fetchUrl(response.headers.location).then(resolve).catch(reject);
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      }).on('error', reject);
    });
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List available experts
   */
  async listExperts() {
    if (!this.aliases) {
      await this.initialize();
    }

    const experts = [];

    // Add aliases
    for (const [name, config] of Object.entries(this.aliases.aliases)) {
      experts.push({
        name: name,
        type: 'alias',
        description: config.description,
        source: config.repo || config.path
      });
    }

    // Add default experts
    try {
      const defaultDir = path.join(this.baseDir, 'expert-definitions');
      const files = await fs.readdir(defaultDir);
      
      for (const file of files) {
        if (file.endsWith('-expert.md')) {
          const name = file.replace('-expert.md', '');
          if (!this.aliases.aliases[name]) {
            experts.push({
              name: name,
              type: 'default',
              description: `Default ${name} expert`,
              source: path.join('expert-definitions', file)
            });
          }
        }
      }
    } catch (error) {
      // No default experts directory
    }

    return experts;
  }

  /**
   * Clear cache
   */
  async clearCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        await fs.unlink(path.join(this.cacheDir, file));
      }
      console.log(`[EXPERT-LOADER] Cleared ${files.length} cached experts`);
    } catch (error) {
      console.log('[EXPERT-LOADER] No cache to clear');
    }
  }
}

// Export for use in workflows
module.exports = ExpertLoader;

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node expert-loader.js <command> [args]');
    console.log('Commands:');
    console.log('  load <expert>     - Load an expert by alias, path, or repo:path');
    console.log('  list              - List available experts');
    console.log('  clear-cache       - Clear cached experts');
    console.log('Examples:');
    console.log('  node expert-loader.js load security');
    console.log('  node expert-loader.js load ./custom/my-expert.md');
    console.log('  node expert-loader.js load myorg/myrepo:prompts/expert.md');
    process.exit(1);
  }
  
  const command = args[0];
  const loader = new ExpertLoader();
  
  (async () => {
    await loader.initialize();
    
    switch (command) {
      case 'load':
        if (args.length < 2) {
          console.error('Please specify an expert to load');
          process.exit(1);
        }
        try {
          const expert = await loader.loadExpert(args[1]);
          console.log('\nExpert loaded successfully:');
          console.log(`Source: ${expert.source}`);
          console.log(`Size: ${expert.content.length} characters`);
          if (expert.repo) console.log(`Repository: ${expert.repo}`);
          if (expert.path) console.log(`Path: ${expert.path}`);
          console.log('\nContent preview:');
          console.log(expert.content.substring(0, 500) + '...');
        } catch (error) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
        break;
        
      case 'list':
        const experts = await loader.listExperts();
        console.log('\nAvailable experts:');
        for (const expert of experts) {
          console.log(`  ${expert.name} (${expert.type}): ${expert.description}`);
          console.log(`    Source: ${expert.source}`);
        }
        break;
        
      case 'clear-cache':
        await loader.clearCache();
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  })().catch(console.error);
}