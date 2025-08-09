/**
 * Simplified ABTest Tool with Multimodal Support
 * Focus on core functionality without overengineering
 */

const { Octokit } = require('@octokit/rest');
const path = require('path');

class ABTestSimplified {
  constructor(options) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.repoOwner = options.repoOwner || 'whichguy';
    this.repoName = options.repoName || 'prompt-expert-bank';
    
    // Simple cache - just store for session
    this.cache = new Map();
    
    // Basic limits to prevent abuse
    this.limits = {
      maxFiles: 100,
      maxSizeMB: 50,
      maxTokens: 150000
    };
    
    // Track basics
    this.stats = {
      filesLoaded: 0,
      totalSizeMB: 0,
      estimatedTokens: 0
    };
  }

  /**
   * Main ABTest execution
   */
  async runTest(config) {
    const {
      expert,           // Path to expert definition
      promptA,          // Baseline prompt
      promptB,          // Variant prompt  
      context = [],     // Optional context paths
      maxFiles = 50     // Simple limit
    } = config;

    console.log('Starting A/B test...');
    
    try {
      // Load the basics
      const [expertDef, baselinePrompt, variantPrompt] = await Promise.all([
        this.loadFile(expert),
        this.loadFile(promptA),
        this.loadFile(promptB)
      ]);
      
      // Load context if provided
      const contextData = await this.loadContext(context, maxFiles);
      
      // Run the test
      const result = await this.evaluate({
        expert: expertDef,
        baseline: baselinePrompt,
        variant: variantPrompt,
        context: contextData
      });
      
      return {
        success: true,
        winner: result.winner,
        confidence: result.confidence,
        stats: this.stats
      };
      
    } catch (error) {
      console.error('Test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Simple path parsing - just handle the common cases
   */
  parsePath(input) {
    if (!input) throw new Error('Path is required');
    
    // Remove whitespace
    const clean = input.trim();
    
    // Split on @ for branch/tag
    const [pathPart, ref = 'main'] = clean.split('@');
    
    // Check for cross-repo format (owner/repo:path)
    if (pathPart.includes(':')) {
      const [repoPart, filePath] = pathPart.split(':');
      const [owner, repo] = repoPart.split('/');
      return { owner, repo, path: filePath, ref };
    }
    
    // Local repo path
    return {
      owner: this.repoOwner,
      repo: this.repoName,
      path: pathPart,
      ref
    };
  }

  /**
   * Load a file from GitHub
   */
  async loadFile(pathStr) {
    const parsed = this.parsePath(pathStr);
    
    // Check cache
    const cacheKey = `${parsed.owner}/${parsed.repo}/${parsed.path}@${parsed.ref}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: parsed.owner,
        repo: parsed.repo,
        path: parsed.path,
        ref: parsed.ref
      });
      
      // Handle file vs directory
      if (Array.isArray(data)) {
        return { type: 'directory', files: data.map(f => f.name) };
      }
      
      // Decode content based on type
      const ext = path.extname(data.name).toLowerCase();
      const content = this.decodeContent(data, ext);
      
      // Update stats
      this.stats.filesLoaded++;
      this.stats.totalSizeMB += data.size / (1024 * 1024);
      this.stats.estimatedTokens += Math.ceil((content?.length || 0) / 4);
      
      // Cache and return
      const result = {
        name: data.name,
        path: parsed.path,
        content,
        size: data.size,
        type: this.getFileType(ext)
      };
      
      this.cache.set(cacheKey, result);
      return result;
      
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`File not found: ${parsed.path}`);
      }
      throw error;
    }
  }

  /**
   * Load multiple context files
   */
  async loadContext(paths, maxFiles = 50) {
    if (!paths || paths.length === 0) return [];
    
    const context = [];
    const loadPaths = paths.slice(0, maxFiles);
    
    // Load in batches of 5
    for (let i = 0; i < loadPaths.length; i += 5) {
      const batch = loadPaths.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(p => this.loadFile(p))
      );
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          context.push(result.value);
        }
      }
      
      // Stop if we're getting too large
      if (this.stats.totalSizeMB > this.limits.maxSizeMB) {
        console.log('Size limit reached, stopping context loading');
        break;
      }
    }
    
    return context;
  }

  /**
   * Decode file content based on type
   */
  decodeContent(data, ext) {
    // Binary files - return base64
    if (['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip'].includes(ext)) {
      return data.content; // Keep base64
    }
    
    // Text files - decode
    try {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
      console.warn(`Could not decode ${data.name}, keeping base64`);
      return data.content;
    }
  }

  /**
   * Simple file type detection
   */
  getFileType(ext) {
    const types = {
      // Code
      '.js': 'javascript',
      '.ts': 'typescript', 
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rb': 'ruby',
      '.php': 'php',
      
      // Web
      '.html': 'html',
      '.css': 'css',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      
      // Data
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.csv': 'csv',
      
      // Docs
      '.md': 'markdown',
      '.txt': 'text',
      '.pdf': 'pdf',
      
      // Images
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.svg': 'svg'
    };
    
    return types[ext] || 'unknown';
  }

  /**
   * Run the actual evaluation
   */
  async evaluate({ expert, baseline, variant, context }) {
    // Build context string
    const contextStr = context.map(file => {
      if (file.type === 'directory') {
        return `Directory: ${file.path} (${file.files.length} files)`;
      }
      return `File: ${file.name} (${file.type}, ${file.size} bytes)`;
    }).join('\n');
    
    // Simple evaluation prompt
    const prompt = `
You are an expert evaluator defined by:
${expert.content}

Context files available:
${contextStr}

Compare these two prompts:

BASELINE:
${baseline.content}

VARIANT:
${variant.content}

Which is better and why? Respond with:
- Winner: baseline or variant
- Confidence: high, medium, or low
- Reason: brief explanation
`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });
    
    // Parse response
    const text = response.content[0].text.toLowerCase();
    
    return {
      winner: text.includes('variant') ? 'variant' : 'baseline',
      confidence: text.includes('high') ? 'high' : 
                  text.includes('low') ? 'low' : 'medium',
      response: response.content[0].text
    };
  }
}

module.exports = { ABTestSimplified };