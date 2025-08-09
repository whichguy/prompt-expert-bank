/**
 * ABTest Tool with Comprehensive Size Management
 * Protects both GitHub runners and Claude's context window
 */

const { Octokit } = require('@octokit/rest');
const path = require('path');
const mime = require('mime-types');

class ABTestToolWithLimits {
  constructor(options) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    
    // Enhanced content cache
    this.contentCache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    // CRITICAL: Size limits for different environments
    this.limits = {
      // GitHub Actions runner limits
      runner: {
        maxMemoryMB: 7000,        // 7GB available on standard runners
        maxDiskMB: 14000,         // 14GB disk space
        maxFilesOpen: 1024,       // File descriptor limit
        maxAPICallsPerMinute: 60, // GitHub API rate limit
        warnMemoryMB: 5000,       // Warn at 5GB
        criticalMemoryMB: 6500    // Critical at 6.5GB
      },
      
      // Claude context window limits
      claude: {
        maxTokens: 200000,        // Claude 3's context window
        estimatedCharsPerToken: 4, // Rough estimate
        maxCharacters: 800000,    // ~200k tokens
        maxImagesCount: 20,       // Max images per request
        maxImageSizeMB: 5,        // Max size per image
        maxPDFSizeMB: 10,         // Max size per PDF
        warnTokens: 150000,       // Warn at 75% capacity
        criticalTokens: 180000    // Critical at 90% capacity
      },
      
      // Per-file type limits
      fileTypes: {
        text: { maxSizeMB: 1, warnSizeMB: 0.5 },
        code: { maxSizeMB: 1, warnSizeMB: 0.5 },
        image: { maxSizeMB: 5, warnSizeMB: 3 },
        pdf: { maxSizeMB: 10, warnSizeMB: 7 },
        config: { maxSizeMB: 0.5, warnSizeMB: 0.25 },
        default: { maxSizeMB: 0.5, warnSizeMB: 0.25 }
      },
      
      // Aggregate limits
      aggregate: {
        maxTotalSizeMB: 50,       // Total size across all files
        maxTotalFiles: 100,       // Max number of files
        maxFoldersDepth: 3,       // Max recursion depth
        maxFilesPerFolder: 20,    // Max files per folder
        warnTotalSizeMB: 30,      // Warn at 30MB
        criticalTotalSizeMB: 45   // Critical at 45MB
      }
    };
    
    // Real-time tracking
    this.tracking = {
      currentMemoryMB: 0,
      currentDiskMB: 0,
      currentTokenEstimate: 0,
      totalFilesLoaded: 0,
      totalFoldersProcessed: 0,
      apiCallsThisMinute: 0,
      apiCallResetTime: Date.now() + 60000,
      
      // Per-type tracking
      byType: {
        text: { count: 0, sizeMB: 0 },
        code: { count: 0, sizeMB: 0 },
        image: { count: 0, sizeMB: 0 },
        pdf: { count: 0, sizeMB: 0 },
        other: { count: 0, sizeMB: 0 }
      },
      
      // Warnings and errors
      warnings: [],
      errors: [],
      skipped: []
    };
    
    // Progressive loading configuration
    this.loadingStrategy = {
      mode: 'progressive',        // 'progressive' | 'strict' | 'lenient'
      stopOnWarning: false,       // Stop loading on first warning
      stopOnCritical: true,       // Stop loading on critical limit
      prioritizeByType: ['code', 'text', 'config', 'image', 'pdf'],
      skipLargeFiles: true,       // Skip files exceeding type limits
      sampleLargeFolders: true,   // Sample instead of full load for large folders
      compressionEnabled: true    // Compress/truncate content when needed
    };
  }

  /**
   * Enhanced ABTest with comprehensive size management
   */
  async executeABTest(config) {
    const {
      expertPath,
      promptA,
      promptB,
      contextPaths = [],
      contextOptions = {},
      sizeLimits = {}
    } = config;

    try {
      // Reset tracking for this test
      this.resetTracking();
      
      // Merge custom limits if provided
      this.applyCustomLimits(sizeLimits);
      
      console.log('🚀 Starting ABTest with Size Management');
      console.log(`📊 Limits: ${this.limits.aggregate.maxTotalSizeMB}MB total, ${this.limits.claude.maxTokens} tokens`);
      
      // Load expert definition (counts toward context)
      const expert = await this.loadWithTracking(expertPath, 'expert');
      
      // Load prompts (counts toward context)
      const [baselinePrompt, variantPrompt] = await Promise.all([
        this.loadWithTracking(promptA, 'prompt'),
        this.loadWithTracking(promptB, 'prompt')
      ]);
      
      // Check if we have room for context
      const remainingBudget = this.calculateRemainingBudget();
      if (remainingBudget.tokens < 10000) {
        this.tracking.warnings.push('Limited context budget remaining after loading prompts');
      }
      
      // Load multimodal context with progressive loading
      const context = await this.loadContextWithLimits(contextPaths, {
        ...contextOptions,
        remainingBudget
      });
      
      // Generate size report
      const sizeReport = this.generateSizeReport();
      console.log('📈 Size Report:', sizeReport.summary);
      
      // Check if we're within safe limits
      if (!this.validateLimits()) {
        return {
          success: false,
          error: 'Size limits exceeded',
          sizeReport,
          recommendations: this.generateRecommendations()
        };
      }
      
      // Run evaluations with context
      const evaluations = await this.runEvaluations({
        expert,
        baselinePrompt,
        variantPrompt,
        context
      });
      
      // Generate verdict
      const verdict = await this.generateVerdict(evaluations, context);
      
      return {
        success: true,
        verdict,
        evaluations,
        context: context.summary,
        sizeReport,
        metrics: this.calculateMetrics(evaluations)
      };
      
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Load context with progressive size management
   */
  async loadContextWithLimits(contextPaths, options = {}) {
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
        skipped: [],
        truncated: [],
        warnings: []
      }
    };

    // Sort paths by priority if specified
    const sortedPaths = this.prioritizePaths(contextPaths, options);
    
    for (const contextPath of sortedPaths) {
      // Check if we should continue loading
      if (!this.shouldContinueLoading()) {
        context.summary.warnings.push(`Stopped loading at ${contextPath} due to size limits`);
        break;
      }
      
      try {
        const pathInfo = this.parsePath(contextPath);
        
        // Estimate size before loading
        const sizeEstimate = await this.estimatePathSize(pathInfo);
        
        if (!this.canAccommodateSize(sizeEstimate)) {
          context.summary.skipped.push({
            path: contextPath,
            reason: 'Would exceed size limits',
            estimatedSize: sizeEstimate
          });
          continue;
        }
        
        // Check if it's a folder or file
        const isFolder = await this.isFolder(pathInfo);
        
        if (isFolder) {
          // Load folder with limits
          const folderContent = await this.loadFolderWithLimits(pathInfo, options);
          context.folders.push(folderContent);
          
          // Process files with compression if needed
          for (const file of folderContent.files) {
            await this.processFileWithLimits(file, context);
          }
        } else {
          // Load single file with limits
          const file = await this.loadFileWithLimits(pathInfo);
          await this.processFileWithLimits(file, context);
        }
        
      } catch (error) {
        context.summary.warnings.push({
          path: contextPath,
          error: error.message
        });
      }
      
      // Rate limit protection
      await this.enforceRateLimit();
    }
    
    // Final summary
    context.summary.totalFiles = context.files.length;
    context.summary.totalSize = this.tracking.currentMemoryMB;
    context.summary.tokenEstimate = this.tracking.currentTokenEstimate;
    
    return context;
  }

  /**
   * Load folder with size limits and sampling
   */
  async loadFolderWithLimits(pathInfo, options = {}) {
    const folder = {
      path: pathInfo.filePath,
      files: [],
      subfolders: [],
      metadata: {},
      truncated: false
    };

    try {
      // Get folder contents
      const { data } = await this.octokit.repos.getContent({
        owner: pathInfo.owner || this.repoOwner,
        repo: pathInfo.repo || this.repoName,
        path: pathInfo.filePath,
        ref: pathInfo.ref || 'main'
      });
      
      this.tracking.apiCallsThisMinute++;

      if (!Array.isArray(data)) {
        throw new Error('Path is not a folder');
      }

      // Check if we need to sample
      const shouldSample = data.length > this.limits.aggregate.maxFilesPerFolder && 
                          this.loadingStrategy.sampleLargeFolders;
      
      let filesToProcess = data;
      if (shouldSample) {
        // Intelligent sampling: prioritize by type and size
        filesToProcess = this.sampleFiles(data, this.limits.aggregate.maxFilesPerFolder);
        folder.truncated = true;
        folder.metadata.originalCount = data.length;
        folder.metadata.sampledCount = filesToProcess.length;
      }

      // Process files with limits
      for (const item of filesToProcess) {
        if (!this.shouldContinueLoading()) {
          folder.metadata.stoppedEarly = true;
          break;
        }

        if (item.type === 'file') {
          // Check file size before loading
          if (item.size && this.shouldSkipFile(item)) {
            this.tracking.skipped.push({
              path: item.path,
              size: item.size,
              reason: 'File too large'
            });
            continue;
          }

          const file = await this.loadFileWithLimits({
            ...pathInfo,
            filePath: item.path
          });
          
          if (file && !file.skipped) {
            folder.files.push(file);
          }
        }
      }

      folder.metadata.loadedFiles = folder.files.length;
      this.tracking.totalFoldersProcessed++;

    } catch (error) {
      console.error(`Error loading folder ${pathInfo.filePath}:`, error.message);
      folder.error = error.message;
    }

    return folder;
  }

  /**
   * Load file with size limits and compression
   */
  async loadFileWithLimits(pathInfo) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: pathInfo.owner || this.repoOwner,
        repo: pathInfo.repo || this.repoName,
        path: pathInfo.filePath,
        ref: pathInfo.ref || 'main'
      });
      
      this.tracking.apiCallsThisMinute++;

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

      // Check size limits for file type
      const typeLimit = this.getTypeLimitMB(file.type);
      const fileSizeMB = data.size / (1024 * 1024);
      
      if (fileSizeMB > typeLimit.max) {
        file.skipped = true;
        file.reason = `Exceeds ${file.type} limit of ${typeLimit.max}MB`;
        this.tracking.skipped.push(file);
        return file;
      }

      // Handle different file types
      if (this.isTextFile(file)) {
        let content = Buffer.from(data.content, 'base64').toString('utf-8');
        
        // Compress/truncate if needed
        if (this.loadingStrategy.compressionEnabled && fileSizeMB > typeLimit.warn) {
          content = this.compressContent(content, file.type);
          file.compressed = true;
        }
        
        file.content = content;
        file.encoding = 'utf-8';
        file.tokens = this.estimateTokens(content);
      } else if (this.isImageFile(file)) {
        if (this.tracking.byType.image.count >= this.limits.claude.maxImagesCount) {
          file.skipped = true;
          file.reason = 'Max image count reached';
          return file;
        }
        file.content = data.content;
        file.encoding = 'base64';
        file.mediaType = 'image';
      } else if (this.isPDFFile(file)) {
        file.content = data.content;
        file.encoding = 'base64';
        file.mediaType = 'document';
      } else {
        file.skipped = true;
        file.reason = 'Binary file type not supported';
        return file;
      }

      // Update tracking
      this.updateTracking(file);
      this.tracking.totalFilesLoaded++;

      return file;

    } catch (error) {
      throw new Error(`Failed to load file ${pathInfo.filePath}: ${error.message}`);
    }
  }

  /**
   * Process file with size tracking
   */
  async processFileWithLimits(file, context) {
    if (file.skipped) {
      context.summary.skipped.push({
        path: file.path,
        reason: file.reason
      });
      return;
    }

    if (file.compressed) {
      context.summary.truncated.push({
        path: file.path,
        originalSize: file.originalSize,
        compressedSize: file.size
      });
    }

    context.files.push(file);
    
    // Categorize by type
    if (this.isImageFile(file)) {
      context.multimodal.images.push(file);
    } else if (this.isPDFFile(file)) {
      context.multimodal.pdfs.push(file);
    } else if (this.isCodeFile(file)) {
      context.multimodal.code.push(file);
    } else {
      context.multimodal.documents.push(file);
    }
  }

  /**
   * Content compression strategies
   */
  compressContent(content, fileType) {
    const strategies = {
      code: () => this.compressCode(content),
      text: () => this.compressText(content),
      config: () => this.compressConfig(content),
      default: () => this.truncateContent(content)
    };
    
    const strategy = strategies[fileType] || strategies.default;
    const compressed = strategy();
    
    return compressed;
  }

  compressCode(content) {
    // Remove comments, empty lines, and truncate if needed
    let compressed = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*/g, '')           // Remove line comments
      .replace(/\n\s*\n/g, '\n')       // Remove empty lines
      .trim();
    
    // If still too large, take first and last portions
    if (compressed.length > 50000) {
      const head = compressed.substring(0, 25000);
      const tail = compressed.substring(compressed.length - 20000);
      compressed = `${head}\n\n/* ... truncated ${compressed.length - 45000} characters ... */\n\n${tail}`;
    }
    
    return compressed;
  }

  compressText(content) {
    // Keep first part and summary
    if (content.length > 50000) {
      const preview = content.substring(0, 40000);
      const lines = content.split('\n');
      const summary = `\n\n[Truncated: Showing first 40KB of ${content.length} total characters, ${lines.length} total lines]`;
      return preview + summary;
    }
    return content;
  }

  compressConfig(content) {
    // For config files, try to preserve structure
    try {
      if (content.includes('{') || content.includes('[')) {
        // Likely JSON, minimize
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed); // Removes whitespace
      }
    } catch (e) {
      // Not JSON, truncate
    }
    return this.truncateContent(content, 20000);
  }

  truncateContent(content, maxLength = 30000) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '\n\n[... truncated ...]';
  }

  /**
   * Size and limit management
   */
  shouldContinueLoading() {
    // Check critical limits
    if (this.tracking.currentMemoryMB >= this.limits.runner.criticalMemoryMB) {
      this.tracking.errors.push('Critical memory limit reached');
      return false;
    }
    
    if (this.tracking.currentTokenEstimate >= this.limits.claude.criticalTokens) {
      this.tracking.errors.push('Critical token limit reached');
      return false;
    }
    
    if (this.tracking.totalFilesLoaded >= this.limits.aggregate.maxTotalFiles) {
      this.tracking.warnings.push('Max file count reached');
      return this.loadingStrategy.mode === 'lenient';
    }
    
    // Check warnings
    if (this.loadingStrategy.stopOnWarning) {
      if (this.tracking.currentMemoryMB >= this.limits.runner.warnMemoryMB ||
          this.tracking.currentTokenEstimate >= this.limits.claude.warnTokens) {
        return false;
      }
    }
    
    // Check critical flag
    if (this.loadingStrategy.stopOnCritical && this.tracking.errors.length > 0) {
      return false;
    }
    
    return true;
  }

  canAccommodateSize(estimatedSize) {
    const projectedMemory = this.tracking.currentMemoryMB + estimatedSize.memoryMB;
    const projectedTokens = this.tracking.currentTokenEstimate + estimatedSize.tokens;
    
    return projectedMemory < this.limits.aggregate.maxTotalSizeMB &&
           projectedTokens < this.limits.claude.maxTokens;
  }

  async estimatePathSize(pathInfo) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: pathInfo.owner || this.repoOwner,
        repo: pathInfo.repo || this.repoName,
        path: pathInfo.filePath,
        ref: pathInfo.ref || 'main'
      });
      
      if (Array.isArray(data)) {
        // Folder - estimate based on file count
        const fileCount = Math.min(data.length, this.limits.aggregate.maxFilesPerFolder);
        return {
          memoryMB: fileCount * 0.5, // Assume 0.5MB average
          tokens: fileCount * 1000    // Assume 1000 tokens average
        };
      } else {
        // File
        const sizeMB = data.size / (1024 * 1024);
        return {
          memoryMB: sizeMB,
          tokens: this.estimateTokens(data.size)
        };
      }
    } catch (error) {
      // Conservative estimate on error
      return { memoryMB: 1, tokens: 2000 };
    }
  }

  shouldSkipFile(fileInfo) {
    const sizeMB = fileInfo.size / (1024 * 1024);
    const type = this.detectFileType(fileInfo.path);
    const limit = this.getTypeLimitMB(type);
    
    return sizeMB > limit.max;
  }

  getTypeLimitMB(type) {
    return {
      max: this.limits.fileTypes[type]?.maxSizeMB || this.limits.fileTypes.default.maxSizeMB,
      warn: this.limits.fileTypes[type]?.warnSizeMB || this.limits.fileTypes.default.warnSizeMB
    };
  }

  updateTracking(file) {
    const sizeMB = file.size / (1024 * 1024);
    this.tracking.currentMemoryMB += sizeMB;
    
    if (file.tokens) {
      this.tracking.currentTokenEstimate += file.tokens;
    }
    
    const type = file.type || 'other';
    if (!this.tracking.byType[type]) {
      this.tracking.byType[type] = { count: 0, sizeMB: 0 };
    }
    this.tracking.byType[type].count++;
    this.tracking.byType[type].sizeMB += sizeMB;
  }

  estimateTokens(input) {
    if (typeof input === 'string') {
      return Math.ceil(input.length / this.limits.claude.estimatedCharsPerToken);
    } else if (typeof input === 'number') {
      // Assume it's file size in bytes
      return Math.ceil(input / this.limits.claude.estimatedCharsPerToken);
    }
    return 0;
  }

  /**
   * Rate limiting
   */
  async enforceRateLimit() {
    // Reset counter if minute passed
    if (Date.now() > this.tracking.apiCallResetTime) {
      this.tracking.apiCallsThisMinute = 0;
      this.tracking.apiCallResetTime = Date.now() + 60000;
    }
    
    // If approaching limit, wait
    if (this.tracking.apiCallsThisMinute >= this.limits.runner.maxAPICallsPerMinute - 5) {
      const waitTime = this.tracking.apiCallResetTime - Date.now();
      if (waitTime > 0) {
        console.log(`⏸ Rate limit pause: ${Math.ceil(waitTime/1000)}s`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Path prioritization
   */
  prioritizePaths(paths, options) {
    if (!options.prioritize) return paths;
    
    return paths.sort((a, b) => {
      // Prioritize by file type
      const typeA = this.detectFileType(a);
      const typeB = this.detectFileType(b);
      const priorityA = this.loadingStrategy.prioritizeByType.indexOf(typeA);
      const priorityB = this.loadingStrategy.prioritizeByType.indexOf(typeB);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Then by estimated size (smaller first)
      return a.length - b.length;
    });
  }

  /**
   * Sample files intelligently
   */
  sampleFiles(files, maxCount) {
    // Group by type
    const byType = {};
    for (const file of files) {
      const type = this.detectFileType(file.path);
      if (!byType[type]) byType[type] = [];
      byType[type].push(file);
    }
    
    // Sample proportionally from each type
    const sampled = [];
    const typeCounts = {};
    
    for (const type of this.loadingStrategy.prioritizeByType) {
      if (byType[type]) {
        const count = Math.ceil((byType[type].length / files.length) * maxCount);
        typeCounts[type] = Math.min(count, byType[type].length);
        
        // Sort by size and take smallest
        byType[type].sort((a, b) => a.size - b.size);
        sampled.push(...byType[type].slice(0, typeCounts[type]));
      }
    }
    
    return sampled.slice(0, maxCount);
  }

  /**
   * Validation and reporting
   */
  validateLimits() {
    const errors = [];
    
    if (this.tracking.currentMemoryMB > this.limits.aggregate.maxTotalSizeMB) {
      errors.push(`Total size ${this.tracking.currentMemoryMB.toFixed(1)}MB exceeds limit ${this.limits.aggregate.maxTotalSizeMB}MB`);
    }
    
    if (this.tracking.currentTokenEstimate > this.limits.claude.maxTokens) {
      errors.push(`Token estimate ${this.tracking.currentTokenEstimate} exceeds limit ${this.limits.claude.maxTokens}`);
    }
    
    if (this.tracking.totalFilesLoaded > this.limits.aggregate.maxTotalFiles) {
      errors.push(`File count ${this.tracking.totalFilesLoaded} exceeds limit ${this.limits.aggregate.maxTotalFiles}`);
    }
    
    if (errors.length > 0) {
      this.tracking.errors.push(...errors);
      return false;
    }
    
    return true;
  }

  generateSizeReport() {
    const report = {
      summary: {
        totalMemoryMB: this.tracking.currentMemoryMB.toFixed(2),
        totalTokens: this.tracking.currentTokenEstimate,
        totalFiles: this.tracking.totalFilesLoaded,
        totalFolders: this.tracking.totalFoldersProcessed
      },
      byType: this.tracking.byType,
      limits: {
        memoryUsage: `${((this.tracking.currentMemoryMB / this.limits.aggregate.maxTotalSizeMB) * 100).toFixed(1)}%`,
        tokenUsage: `${((this.tracking.currentTokenEstimate / this.limits.claude.maxTokens) * 100).toFixed(1)}%`,
        fileUsage: `${((this.tracking.totalFilesLoaded / this.limits.aggregate.maxTotalFiles) * 100).toFixed(1)}%`
      },
      performance: {
        apiCalls: this.tracking.apiCallsThisMinute,
        cacheHits: this.contentCache.size,
        skippedFiles: this.tracking.skipped.length
      },
      warnings: this.tracking.warnings,
      errors: this.tracking.errors
    };
    
    // Add health status
    if (this.tracking.currentTokenEstimate > this.limits.claude.warnTokens) {
      report.health = 'warning';
      report.healthMessage = 'Approaching token limit';
    } else if (this.tracking.currentMemoryMB > this.limits.runner.warnMemoryMB) {
      report.health = 'warning';
      report.healthMessage = 'High memory usage';
    } else if (this.tracking.errors.length > 0) {
      report.health = 'error';
      report.healthMessage = 'Errors encountered during loading';
    } else {
      report.health = 'healthy';
      report.healthMessage = 'All systems within normal parameters';
    }
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.tracking.currentTokenEstimate > this.limits.claude.warnTokens) {
      recommendations.push('Reduce context paths or use more specific file patterns');
    }
    
    if (this.tracking.skipped.length > 10) {
      recommendations.push(`${this.tracking.skipped.length} files were skipped. Consider using file type filters.`);
    }
    
    if (this.tracking.currentMemoryMB > this.limits.runner.warnMemoryMB) {
      recommendations.push('High memory usage detected. Consider running with fewer context paths.');
    }
    
    if (this.tracking.byType.image.count > 10) {
      recommendations.push('Many images loaded. Consider selecting only essential images.');
    }
    
    // Suggest optimizations
    const largestType = Object.entries(this.tracking.byType)
      .sort((a, b) => b[1].sizeMB - a[1].sizeMB)[0];
    
    if (largestType && largestType[1].sizeMB > 10) {
      recommendations.push(`${largestType[0]} files use ${largestType[1].sizeMB.toFixed(1)}MB. Consider filtering.`);
    }
    
    return recommendations;
  }

  resetTracking() {
    this.tracking.currentMemoryMB = 0;
    this.tracking.currentTokenEstimate = 0;
    this.tracking.totalFilesLoaded = 0;
    this.tracking.totalFoldersProcessed = 0;
    this.tracking.apiCallsThisMinute = 0;
    this.tracking.warnings = [];
    this.tracking.errors = [];
    this.tracking.skipped = [];
    
    for (const type in this.tracking.byType) {
      this.tracking.byType[type] = { count: 0, sizeMB: 0 };
    }
  }

  applyCustomLimits(customLimits) {
    if (!customLimits) return;
    
    // Deep merge custom limits
    if (customLimits.maxTotalSizeMB) {
      this.limits.aggregate.maxTotalSizeMB = customLimits.maxTotalSizeMB;
    }
    if (customLimits.maxTokens) {
      this.limits.claude.maxTokens = customLimits.maxTokens;
    }
    if (customLimits.maxFiles) {
      this.limits.aggregate.maxTotalFiles = customLimits.maxFiles;
    }
    if (customLimits.strategy) {
      Object.assign(this.loadingStrategy, customLimits.strategy);
    }
  }

  calculateRemainingBudget() {
    return {
      memoryMB: this.limits.aggregate.maxTotalSizeMB - this.tracking.currentMemoryMB,
      tokens: this.limits.claude.maxTokens - this.tracking.currentTokenEstimate,
      files: this.limits.aggregate.maxTotalFiles - this.tracking.totalFilesLoaded
    };
  }

  // Helper methods (inherited from enhanced version)
  detectFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'code', '.ts': 'code', '.py': 'code', '.java': 'code',
      '.md': 'text', '.txt': 'text', '.rst': 'text',
      '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image',
      '.pdf': 'pdf',
      '.json': 'config', '.yaml': 'config', '.yml': 'config', '.toml': 'config'
    };
    return typeMap[ext] || 'other';
  }

  isTextFile(file) {
    return ['text', 'code', 'config'].includes(file.type);
  }

  isImageFile(file) {
    return file.type === 'image';
  }

  isPDFFile(file) {
    return file.type === 'pdf';
  }

  isCodeFile(file) {
    return file.type === 'code';
  }

  parsePath(path) {
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
      
      this.tracking.apiCallsThisMinute++;
      return Array.isArray(data);
    } catch (error) {
      return false;
    }
  }

  // Stub methods for evaluation (implement as needed)
  async loadWithTracking(path, type) {
    const pathInfo = this.parsePath(path);
    const file = await this.loadFileWithLimits(pathInfo);
    return { content: file.content, type };
  }

  async runEvaluations(params) {
    // Implementation would go here
    return { baseline: {}, variant: {}, comparison: {} };
  }

  async generateVerdict(evaluations, context) {
    // Implementation would go here
    return { winner: 'variant', confidence: 'medium' };
  }

  calculateMetrics(evaluations) {
    return {
      totalTokens: this.tracking.currentTokenEstimate,
      memoryUsed: this.tracking.currentMemoryMB,
      filesProcessed: this.tracking.totalFilesLoaded
    };
  }

  handleError(error) {
    return {
      success: false,
      error: error.message,
      sizeReport: this.generateSizeReport(),
      recommendations: this.generateRecommendations()
    };
  }
}

module.exports = { ABTestToolWithLimits };