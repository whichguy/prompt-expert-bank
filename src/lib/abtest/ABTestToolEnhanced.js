/**
 * Enhanced ABTest Tool with Multimodal Context Priming
 * Supports GitHub repo paths, folders, and multimodal files (images, PDFs, code, etc.)
 */

const { Octokit } = require('@octokit/rest');
const path = require('path');
const mime = require('mime-types');

class ABTestToolEnhanced {
  constructor(options) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    
    // Enhanced content cache with multimodal support
    this.contentCache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    // File type configurations
    this.fileTypeConfig = {
      // Text-based files
      text: ['.txt', '.md', '.markdown', '.rst', '.log'],
      code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.swift', '.kt', '.rb', '.php', '.cs', '.sh', '.bash', '.yaml', '.yml', '.json', '.xml', '.html', '.css', '.scss', '.sql'],
      config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.properties'],
      
      // Binary/multimodal files
      image: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'],
      pdf: ['.pdf'],
      document: ['.doc', '.docx', '.odt', '.rtf'],
      spreadsheet: ['.xls', '.xlsx', '.csv', '.ods'],
      
      // Size limits per type (in bytes)
      limits: {
        text: 1024 * 1024,      // 1MB for text
        code: 1024 * 1024,      // 1MB for code
        image: 5 * 1024 * 1024, // 5MB for images
        pdf: 10 * 1024 * 1024,  // 10MB for PDFs
        default: 512 * 1024     // 512KB default
      }
    };
    
    // Context batching configuration
    this.batchConfig = {
      maxFilesPerBatch: 20,
      maxTotalSize: 20 * 1024 * 1024, // 20MB total
      maxDepth: 3 // Max folder depth for traversal
    };
  }

  /**
   * Enhanced ABTest with multimodal context priming
   * @param {object} config - Test configuration
   * @param {string} config.expertPath - Path to expert definition
   * @param {string} config.promptA - Baseline prompt path/content
   * @param {string} config.promptB - Variant prompt path/content
   * @param {array} config.contextPaths - GitHub paths to prime context with
   * @param {object} config.contextOptions - Options for context loading
   * @returns {object} Test results with multimodal context analysis
   */
  async executeABTest(config) {
    const {
      expertPath,
      promptA,
      promptB,
      contextPaths = [],
      contextOptions = {}
    } = config;

    try {
      console.log('🚀 Starting Enhanced ABTest with Multimodal Context');
      
      // Load expert definition
      const expert = await this.loadExpert(expertPath);
      
      // Load prompts
      const [baselinePrompt, variantPrompt] = await Promise.all([
        this.loadPrompt(promptA),
        this.loadPrompt(promptB)
      ]);
      
      // Load multimodal context
      const context = await this.loadMultimodalContext(contextPaths, contextOptions);
      
      // Prepare evaluation threads with context
      const evaluations = await this.runContextualEvaluations({
        expert,
        baselinePrompt,
        variantPrompt,
        context
      });
      
      // Generate comprehensive verdict
      const verdict = await this.generateVerdict(evaluations, context);
      
      return {
        success: true,
        verdict,
        evaluations,
        context: context.summary,
        metrics: this.calculateMetrics(evaluations)
      };
      
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Load multimodal context from GitHub paths
   * Supports folders, multiple file types, and intelligent batching
   */
  async loadMultimodalContext(contextPaths, options = {}) {
    const context = {
      files: [],
      folders: [],
      multimodal: {
        images: [],
        pdfs: [],
        code: [],
        documents: []
      },
      summary: {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: new Map(),
        errors: []
      }
    };

    for (const contextPath of contextPaths) {
      try {
        const pathInfo = this.parsePath(contextPath);
        
        // Check if it's a folder or file
        const isFolder = await this.isFolder(pathInfo);
        
        if (isFolder) {
          // Load folder contents recursively
          const folderContent = await this.loadFolderContent(pathInfo, options);
          context.folders.push(folderContent);
          
          // Process each file in folder
          for (const file of folderContent.files) {
            await this.processFile(file, context);
          }
        } else {
          // Load single file
          const file = await this.loadFile(pathInfo);
          await this.processFile(file, context);
        }
        
      } catch (error) {
        context.summary.errors.push({
          path: contextPath,
          error: error.message
        });
      }
    }
    
    // Generate context summary
    context.summary.totalFiles = context.files.length;
    context.summary.breakdown = {
      images: context.multimodal.images.length,
      pdfs: context.multimodal.pdfs.length,
      code: context.multimodal.code.length,
      documents: context.multimodal.documents.length
    };
    
    return context;
  }

  /**
   * Load folder content recursively with intelligent filtering
   */
  async loadFolderContent(pathInfo, options = {}) {
    const {
      maxDepth = this.batchConfig.maxDepth,
      includePatterns = [],
      excludePatterns = [/node_modules/, /\.git/, /dist/, /build/],
      maxFiles = this.batchConfig.maxFilesPerBatch
    } = options;

    const folder = {
      path: pathInfo.filePath,
      files: [],
      subfolders: [],
      metadata: {}
    };

    try {
      // Get folder contents from GitHub
      const { data } = await this.octokit.repos.getContent({
        owner: pathInfo.owner || this.repoOwner,
        repo: pathInfo.repo || this.repoName,
        path: pathInfo.filePath,
        ref: pathInfo.ref || 'main'
      });

      if (!Array.isArray(data)) {
        throw new Error('Path is not a folder');
      }

      // Filter and process files
      let fileCount = 0;
      for (const item of data) {
        // Check exclude patterns
        if (excludePatterns.some(pattern => pattern.test(item.path))) {
          continue;
        }

        // Check include patterns if specified
        if (includePatterns.length > 0 && !includePatterns.some(pattern => pattern.test(item.path))) {
          continue;
        }

        if (item.type === 'file' && fileCount < maxFiles) {
          const file = await this.loadFile({
            ...pathInfo,
            filePath: item.path
          });
          folder.files.push(file);
          fileCount++;
        } else if (item.type === 'dir' && maxDepth > 1) {
          // Recursively load subfolders
          const subfolder = await this.loadFolderContent(
            { ...pathInfo, filePath: item.path },
            { ...options, maxDepth: maxDepth - 1 }
          );
          folder.subfolders.push(subfolder);
        }
      }

      folder.metadata = {
        totalFiles: fileCount,
        totalSubfolders: folder.subfolders.length,
        depth: this.batchConfig.maxDepth - maxDepth + 1
      };

    } catch (error) {
      console.error(`Error loading folder ${pathInfo.filePath}:`, error.message);
      folder.error = error.message;
    }

    return folder;
  }

  /**
   * Load a single file with multimodal support
   */
  async loadFile(pathInfo) {
    const cacheKey = `${pathInfo.owner}/${pathInfo.repo}/${pathInfo.filePath}@${pathInfo.ref}`;
    
    // Check cache
    if (this.contentCache.has(cacheKey)) {
      const cached = this.contentCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: pathInfo.owner || this.repoOwner,
        repo: pathInfo.repo || this.repoName,
        path: pathInfo.filePath,
        ref: pathInfo.ref || 'main'
      });

      if (data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      const file = {
        path: pathInfo.filePath,
        name: path.basename(pathInfo.filePath),
        size: data.size,
        sha: data.sha,
        type: this.detectFileType(pathInfo.filePath),
        mimeType: mime.lookup(pathInfo.filePath) || 'application/octet-stream'
      };

      // Handle different file types
      if (this.isTextFile(file)) {
        // Decode text content
        file.content = Buffer.from(data.content, 'base64').toString('utf-8');
        file.encoding = 'utf-8';
      } else if (this.isImageFile(file)) {
        // Keep base64 for images
        file.content = data.content;
        file.encoding = 'base64';
        file.mediaType = 'image';
      } else if (this.isPDFFile(file)) {
        // Keep base64 for PDFs
        file.content = data.content;
        file.encoding = 'base64';
        file.mediaType = 'document';
      } else {
        // Binary files - store metadata only
        file.content = null;
        file.encoding = 'binary';
        file.skipped = true;
        file.reason = 'Binary file type not supported for context';
      }

      // Cache the result
      this.contentCache.set(cacheKey, {
        data: file,
        timestamp: Date.now()
      });

      return file;

    } catch (error) {
      throw new Error(`Failed to load file ${pathInfo.filePath}: ${error.message}`);
    }
  }

  /**
   * Process a file and categorize it for multimodal handling
   */
  async processFile(file, context) {
    if (file.skipped) {
      return;
    }

    context.files.push(file);
    context.summary.totalSize += file.size;

    // Track file types
    const ext = path.extname(file.name).toLowerCase();
    context.summary.fileTypes.set(ext, (context.summary.fileTypes.get(ext) || 0) + 1);

    // Categorize by type
    if (this.isImageFile(file)) {
      context.multimodal.images.push({
        path: file.path,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        content: file.content // base64
      });
    } else if (this.isPDFFile(file)) {
      context.multimodal.pdfs.push({
        path: file.path,
        name: file.name,
        size: file.size,
        content: file.content // base64
      });
    } else if (this.isCodeFile(file)) {
      context.multimodal.code.push({
        path: file.path,
        name: file.name,
        language: this.detectLanguage(file.name),
        content: file.content,
        size: file.size
      });
    } else if (this.isDocumentFile(file)) {
      context.multimodal.documents.push({
        path: file.path,
        name: file.name,
        type: ext,
        content: file.content,
        size: file.size
      });
    }
  }

  /**
   * Run contextual evaluations with multimodal context
   */
  async runContextualEvaluations({ expert, baselinePrompt, variantPrompt, context }) {
    // Prepare context prompt with multimodal content
    const contextPrompt = this.prepareContextPrompt(context);
    
    // Thread A: Baseline prompt with context
    const threadA = await this.evaluateWithContext(
      baselinePrompt,
      contextPrompt,
      'baseline'
    );
    
    // Thread B: Variant prompt with context
    const threadB = await this.evaluateWithContext(
      variantPrompt,
      contextPrompt,
      'variant'
    );
    
    // Thread C: Expert comparison with multimodal awareness
    const comparison = await this.expertComparison({
      expert,
      threadA,
      threadB,
      context,
      contextPrompt
    });
    
    return {
      baseline: threadA,
      variant: threadB,
      comparison
    };
  }

  /**
   * Prepare context prompt with multimodal content
   */
  prepareContextPrompt(context) {
    const sections = [];
    
    // Add summary
    sections.push(`## Context Overview
- Total Files: ${context.summary.totalFiles}
- Total Size: ${this.formatSize(context.summary.totalSize)}
- Images: ${context.multimodal.images.length}
- PDFs: ${context.multimodal.pdfs.length}
- Code Files: ${context.multimodal.code.length}
- Documents: ${context.multimodal.documents.length}`);

    // Add code context
    if (context.multimodal.code.length > 0) {
      sections.push('\n## Code Files');
      for (const codeFile of context.multimodal.code.slice(0, 5)) {
        sections.push(`\n### ${codeFile.name} (${codeFile.language})
\`\`\`${codeFile.language}
${codeFile.content.substring(0, 500)}${codeFile.content.length > 500 ? '...' : ''}
\`\`\``);
      }
    }

    // Add document summaries
    if (context.multimodal.documents.length > 0) {
      sections.push('\n## Documents');
      for (const doc of context.multimodal.documents) {
        sections.push(`- ${doc.name} (${this.formatSize(doc.size)})`);
      }
    }

    // Note about multimodal content
    if (context.multimodal.images.length > 0 || context.multimodal.pdfs.length > 0) {
      sections.push(`\n## Multimodal Content
- ${context.multimodal.images.length} images available for analysis
- ${context.multimodal.pdfs.length} PDF documents available for processing`);
    }

    return sections.join('\n');
  }

  /**
   * Evaluate prompt with multimodal context
   */
  async evaluateWithContext(prompt, contextPrompt, label) {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are evaluating a prompt with the following context materials:\n\n${contextPrompt}\n\n---\n\nNow, using the prompt below, demonstrate how you would handle the provided context:\n\n${prompt.content}`
          }
        ]
      }
    ];

    // Add multimodal content if available
    if (prompt.images && prompt.images.length > 0) {
      for (const image of prompt.images) {
        messages[0].content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mimeType,
            data: image.content
          }
        });
      }
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages
    });

    return {
      label,
      response: response.content[0].text,
      tokens: response.usage?.total_tokens || 0
    };
  }

  /**
   * Expert comparison with multimodal awareness
   */
  async expertComparison({ expert, threadA, threadB, context, contextPrompt }) {
    const comparisonPrompt = `## Expert Evaluation Framework

${expert.content}

## Context Materials Provided
${contextPrompt}

## Evaluation Task
Compare these two implementations based on how well they handle the multimodal context:

### Baseline Implementation Response:
${threadA.response}

### Variant Implementation Response:
${threadB.response}

## Evaluation Criteria
1. Context utilization - How well does each prompt leverage the provided materials?
2. Multimodal handling - Effectiveness with images, PDFs, and diverse file types
3. Code comprehension - Understanding and working with the code context
4. Overall effectiveness - Which prompt better achieves the intended purpose?

Provide your verdict with:
- Winner: [Baseline or Variant]
- Confidence: [high/medium/low]
- Key differentiators
- Recommendations for production use`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: comparisonPrompt }]
    });

    return this.parseExpertVerdict(response.content[0].text);
  }

  // Helper methods
  
  detectFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    for (const [type, extensions] of Object.entries(this.fileTypeConfig)) {
      if (Array.isArray(extensions) && extensions.includes(ext)) {
        return type;
      }
    }
    
    return 'unknown';
  }

  isTextFile(file) {
    return ['text', 'code', 'config'].includes(file.type);
  }

  isImageFile(file) {
    return file.type === 'image' || this.fileTypeConfig.image.includes(path.extname(file.name).toLowerCase());
  }

  isPDFFile(file) {
    return path.extname(file.name).toLowerCase() === '.pdf';
  }

  isCodeFile(file) {
    return file.type === 'code';
  }

  isDocumentFile(file) {
    return file.type === 'document' || ['text', 'config'].includes(file.type);
  }

  detectLanguage(filename) {
    const ext = path.extname(filename).toLowerCase();
    const langMap = {
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
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.cs': 'csharp',
      '.sh': 'bash',
      '.sql': 'sql',
      '.r': 'r'
    };
    return langMap[ext] || 'plaintext';
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  parsePath(path) {
    // Parse formats like:
    // - "path/to/file.md" (current repo)
    // - "owner/repo:path/to/file.md" (cross-repo)
    // - "path/to/file.md@branch" (specific branch)
    // - "owner/repo:path/to/file.md@tag" (cross-repo with ref)
    
    const parts = path.split('@');
    const pathPart = parts[0];
    const ref = parts[1] || 'main';
    
    if (pathPart.includes(':')) {
      const [repoPart, filePath] = pathPart.split(':');
      const [owner, repo] = repoPart.split('/');
      return { owner, repo, filePath, ref };
    }
    
    return {
      owner: this.repoOwner,
      repo: this.repoName,
      filePath: pathPart,
      ref
    };
  }

  async isFolder(pathInfo) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: pathInfo.owner || this.repoOwner,
        repo: pathInfo.repo || this.repoName,
        path: pathInfo.filePath,
        ref: pathInfo.ref || 'main'
      });
      
      return Array.isArray(data);
    } catch (error) {
      return false;
    }
  }

  parseExpertVerdict(text) {
    const verdict = {
      winner: null,
      confidence: null,
      score: null,
      differentiators: [],
      recommendations: []
    };

    // Parse winner
    const winnerMatch = text.match(/Winner:\s*(Baseline|Variant)/i);
    if (winnerMatch) {
      verdict.winner = winnerMatch[1].toLowerCase();
    }

    // Parse confidence
    const confidenceMatch = text.match(/Confidence:\s*(high|medium|low)/i);
    if (confidenceMatch) {
      verdict.confidence = confidenceMatch[1].toLowerCase();
    }

    // Parse score if present
    const scoreMatch = text.match(/Score:\s*(\d+(?:\.\d+)?)/);
    if (scoreMatch) {
      verdict.score = parseFloat(scoreMatch[1]);
    }

    return verdict;
  }

  handleError(error) {
    console.error('ABTest Error:', error);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
  }

  // Backwards compatibility
  async loadExpert(path) {
    const pathInfo = this.parsePath(path);
    const file = await this.loadFile(pathInfo);
    return { content: file.content };
  }

  async loadPrompt(path) {
    const pathInfo = this.parsePath(path);
    const file = await this.loadFile(pathInfo);
    return { content: file.content };
  }

  generateVerdict(evaluations, context) {
    return {
      winner: evaluations.comparison.winner,
      confidence: evaluations.comparison.confidence,
      contextUtilization: this.assessContextUtilization(evaluations, context),
      recommendation: this.generateRecommendation(evaluations.comparison)
    };
  }

  assessContextUtilization(evaluations, context) {
    // Analyze how well each version used the context
    return {
      baseline: this.scoreContextUsage(evaluations.baseline.response, context),
      variant: this.scoreContextUsage(evaluations.variant.response, context)
    };
  }

  scoreContextUsage(response, context) {
    let score = 0;
    
    // Check for code file references
    for (const codeFile of context.multimodal.code) {
      if (response.includes(codeFile.name) || response.includes(path.basename(codeFile.path, path.extname(codeFile.path)))) {
        score += 10;
      }
    }
    
    // Check for awareness of multimodal content
    if (context.multimodal.images.length > 0 && response.toLowerCase().includes('image')) {
      score += 5;
    }
    
    if (context.multimodal.pdfs.length > 0 && response.toLowerCase().includes('pdf')) {
      score += 5;
    }
    
    return score;
  }

  generateRecommendation(comparison) {
    if (comparison.winner === 'variant' && comparison.confidence === 'high') {
      return 'DEPLOY - Variant shows clear superiority with high confidence';
    } else if (comparison.winner === 'variant' && comparison.confidence === 'medium') {
      return 'REVIEW - Variant is better but requires additional validation';
    } else if (comparison.winner === 'baseline') {
      return 'REJECT - Baseline performs better, variant needs improvement';
    } else {
      return 'ITERATE - Results inconclusive, further testing needed';
    }
  }

  calculateMetrics(evaluations) {
    return {
      baselineTokens: evaluations.baseline.tokens,
      variantTokens: evaluations.variant.tokens,
      totalTokens: evaluations.baseline.tokens + evaluations.variant.tokens,
      evaluationTime: Date.now() - this.startTime
    };
  }
}

module.exports = { ABTestToolEnhanced };