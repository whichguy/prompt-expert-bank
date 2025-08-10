/**
 * Robust ABTest Tool with Enhanced Error Handling and Logging
 * Addresses corner cases and edge scenarios in multimodal and GitHub path handling
 */

const { Octokit } = require('@octokit/rest');
const path = require('path');
const mime = require('mime-types');

// Enhanced logger with levels and context
class StructuredLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.prefix = options.prefix || '[ABTest]';
    this.context = options.context || {};
    this.logs = [];
    
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: { ...this.context, ...data }
    };
    
    this.logs.push(logEntry);
    
    if (this.levels[level] >= this.levels[this.level]) {
      const formattedMessage = `${timestamp} ${this.prefix} [${level.toUpperCase()}] ${message}`;
      console.log(formattedMessage, data);
    }
    
    return logEntry;
  }

  debug(message, data) { return this.log('debug', message, data); }
  info(message, data) { return this.log('info', message, data); }
  warn(message, data) { return this.log('warn', message, data); }
  error(message, data) { return this.log('error', message, data); }
  
  getLogs() { return this.logs; }
  clearLogs() { this.logs = []; }
}

class ABTestToolRobust {
  constructor(options) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    
    // Initialize logger
    this.logger = new StructuredLogger({
      level: options.logLevel || 'info',
      prefix: '[ABTest]',
      context: {
        owner: this.repoOwner,
        repo: this.repoName
      }
    });
    
    // Enhanced cache with validation
    this.contentCache = new Map();
    this.cacheTimeout = options.cacheTimeout || 24 * 60 * 60 * 1000;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      errors: 0
    };
    
    // Retry configuration
    this.retryConfig = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      exponentialBackoff: options.exponentialBackoff !== false
    };
    
    // Validation patterns
    this.validation = {
      // GitHub owner/repo patterns
      ownerPattern: /^[a-zA-Z0-9]([a-zA-Z0-9-]){0,38}$/,
      repoPattern: /^[a-zA-Z0-9._-]{1,100}$/,
      // Branch/tag/SHA patterns
      refPattern: /^[a-zA-Z0-9._\-\/]+$/,
      shaPattern: /^[a-f0-9]{40}$/,
      // File path patterns
      pathPattern: /^[^<>:"|?*]+$/,
      // Security patterns
      dangerousPatterns: [
        /\.\.\//,  // Path traversal
        /^\/etc/,  // System files
        /\.env$/,  // Environment files (unless explicitly allowed)
        /private_key|secret|password|token/i  // Sensitive content
      ]
    };
    
    // File type detection with extended MIME types
    this.fileTypeMap = {
      // Source code
      '.js': { type: 'code', mime: 'application/javascript', language: 'javascript' },
      '.ts': { type: 'code', mime: 'application/typescript', language: 'typescript' },
      '.jsx': { type: 'code', mime: 'text/jsx', language: 'javascript' },
      '.tsx': { type: 'code', mime: 'text/tsx', language: 'typescript' },
      '.py': { type: 'code', mime: 'text/x-python', language: 'python' },
      '.java': { type: 'code', mime: 'text/x-java', language: 'java' },
      '.cpp': { type: 'code', mime: 'text/x-c++', language: 'cpp' },
      '.c': { type: 'code', mime: 'text/x-c', language: 'c' },
      '.go': { type: 'code', mime: 'text/x-go', language: 'go' },
      '.rs': { type: 'code', mime: 'text/x-rust', language: 'rust' },
      '.rb': { type: 'code', mime: 'text/x-ruby', language: 'ruby' },
      '.php': { type: 'code', mime: 'text/x-php', language: 'php' },
      '.swift': { type: 'code', mime: 'text/x-swift', language: 'swift' },
      '.kt': { type: 'code', mime: 'text/x-kotlin', language: 'kotlin' },
      '.scala': { type: 'code', mime: 'text/x-scala', language: 'scala' },
      '.r': { type: 'code', mime: 'text/x-r', language: 'r' },
      '.m': { type: 'code', mime: 'text/x-objc', language: 'objc' },
      '.sh': { type: 'code', mime: 'text/x-sh', language: 'bash' },
      '.bash': { type: 'code', mime: 'text/x-sh', language: 'bash' },
      '.zsh': { type: 'code', mime: 'text/x-sh', language: 'zsh' },
      '.fish': { type: 'code', mime: 'text/x-sh', language: 'fish' },
      '.ps1': { type: 'code', mime: 'text/x-powershell', language: 'powershell' },
      '.lua': { type: 'code', mime: 'text/x-lua', language: 'lua' },
      '.dart': { type: 'code', mime: 'text/x-dart', language: 'dart' },
      '.elm': { type: 'code', mime: 'text/x-elm', language: 'elm' },
      '.clj': { type: 'code', mime: 'text/x-clojure', language: 'clojure' },
      '.ex': { type: 'code', mime: 'text/x-elixir', language: 'elixir' },
      '.erl': { type: 'code', mime: 'text/x-erlang', language: 'erlang' },
      '.hs': { type: 'code', mime: 'text/x-haskell', language: 'haskell' },
      '.ml': { type: 'code', mime: 'text/x-ocaml', language: 'ocaml' },
      '.fs': { type: 'code', mime: 'text/x-fsharp', language: 'fsharp' },
      '.nim': { type: 'code', mime: 'text/x-nim', language: 'nim' },
      '.zig': { type: 'code', mime: 'text/x-zig', language: 'zig' },
      '.v': { type: 'code', mime: 'text/x-v', language: 'v' },
      '.sol': { type: 'code', mime: 'text/x-solidity', language: 'solidity' },
      
      // Markup/Data
      '.html': { type: 'markup', mime: 'text/html', language: 'html' },
      '.xml': { type: 'markup', mime: 'text/xml', language: 'xml' },
      '.svg': { type: 'image', mime: 'image/svg+xml', language: 'svg' },
      '.md': { type: 'text', mime: 'text/markdown', language: 'markdown' },
      '.markdown': { type: 'text', mime: 'text/markdown', language: 'markdown' },
      '.rst': { type: 'text', mime: 'text/x-rst', language: 'restructuredtext' },
      '.txt': { type: 'text', mime: 'text/plain', language: 'plaintext' },
      '.log': { type: 'text', mime: 'text/plain', language: 'log' },
      
      // Config
      '.json': { type: 'config', mime: 'application/json', language: 'json' },
      '.yaml': { type: 'config', mime: 'text/yaml', language: 'yaml' },
      '.yml': { type: 'config', mime: 'text/yaml', language: 'yaml' },
      '.toml': { type: 'config', mime: 'text/toml', language: 'toml' },
      '.ini': { type: 'config', mime: 'text/ini', language: 'ini' },
      '.env': { type: 'config', mime: 'text/plain', language: 'dotenv', sensitive: true },
      '.properties': { type: 'config', mime: 'text/plain', language: 'properties' },
      
      // Images
      '.png': { type: 'image', mime: 'image/png', binary: true },
      '.jpg': { type: 'image', mime: 'image/jpeg', binary: true },
      '.jpeg': { type: 'image', mime: 'image/jpeg', binary: true },
      '.gif': { type: 'image', mime: 'image/gif', binary: true },
      '.bmp': { type: 'image', mime: 'image/bmp', binary: true },
      '.webp': { type: 'image', mime: 'image/webp', binary: true },
      '.ico': { type: 'image', mime: 'image/x-icon', binary: true },
      '.tiff': { type: 'image', mime: 'image/tiff', binary: true },
      '.tif': { type: 'image', mime: 'image/tiff', binary: true },
      
      // Documents
      '.pdf': { type: 'document', mime: 'application/pdf', binary: true },
      '.doc': { type: 'document', mime: 'application/msword', binary: true },
      '.docx': { type: 'document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', binary: true },
      '.xls': { type: 'spreadsheet', mime: 'application/vnd.ms-excel', binary: true },
      '.xlsx': { type: 'spreadsheet', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', binary: true },
      '.ppt': { type: 'document', mime: 'application/vnd.ms-powerpoint', binary: true },
      '.pptx': { type: 'document', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', binary: true },
      '.odt': { type: 'document', mime: 'application/vnd.oasis.opendocument.text', binary: true },
      '.ods': { type: 'spreadsheet', mime: 'application/vnd.oasis.opendocument.spreadsheet', binary: true },
      '.csv': { type: 'data', mime: 'text/csv', language: 'csv' },
      
      // Archives (usually skipped)
      '.zip': { type: 'archive', mime: 'application/zip', binary: true, skip: true },
      '.tar': { type: 'archive', mime: 'application/x-tar', binary: true, skip: true },
      '.gz': { type: 'archive', mime: 'application/gzip', binary: true, skip: true },
      '.rar': { type: 'archive', mime: 'application/x-rar', binary: true, skip: true },
      '.7z': { type: 'archive', mime: 'application/x-7z-compressed', binary: true, skip: true },
      
      // Special files
      '.ipynb': { type: 'notebook', mime: 'application/x-ipynb+json', language: 'jupyter' },
      '.sql': { type: 'code', mime: 'text/x-sql', language: 'sql' },
      '.graphql': { type: 'code', mime: 'text/graphql', language: 'graphql' },
      '.proto': { type: 'code', mime: 'text/x-protobuf', language: 'protobuf' },
      '.wasm': { type: 'binary', mime: 'application/wasm', binary: true, skip: true }
    };
    
    // Statistics tracking
    this.stats = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retries: 0,
      errors: 0,
      warnings: 0,
      filesLoaded: 0,
      filesSkipped: 0,
      bytesLoaded: 0
    };
  }

  /**
   * Enhanced path parsing with comprehensive validation and edge case handling
   */
  parsePath(inputPath) {
    this.logger.debug('Parsing path', { inputPath });
    
    if (!inputPath || typeof inputPath !== 'string') {
      const error = new Error('Invalid path: must be a non-empty string');
      this.logger.error('Path parsing failed', { inputPath, error: error.message });
      throw error;
    }
    
    // Trim whitespace and normalize slashes
    let normalizedPath = inputPath.trim().replace(/\\/g, '/');
    
    // Remove leading/trailing slashes
    normalizedPath = normalizedPath.replace(/^\/+|\/+$/g, '');
    
    // Check for dangerous patterns
    for (const pattern of this.validation.dangerousPatterns) {
      if (pattern.test(normalizedPath) && !normalizedPath.endsWith('.env')) {
        this.logger.warn('Potentially dangerous path pattern detected', { 
          path: normalizedPath, 
          pattern: pattern.toString() 
        });
      }
    }
    
    // Parse the path components
    const result = {
      owner: null,
      repo: null,
      filePath: null,
      ref: 'main',
      original: inputPath
    };
    
    try {
      // Split on @ to separate ref (branch/tag/commit)
      const atParts = normalizedPath.split('@');
      if (atParts.length > 2) {
        // Multiple @ symbols - likely invalid
        this.logger.warn('Multiple @ symbols in path', { path: normalizedPath });
      }
      
      const pathPart = atParts[0];
      const refPart = atParts[1];
      
      // Validate and set ref
      if (refPart) {
        // Clean the ref
        const cleanRef = refPart.trim();
        
        // Check if it's a valid SHA
        if (this.validation.shaPattern.test(cleanRef)) {
          result.ref = cleanRef;
          result.refType = 'commit';
        } else if (this.validation.refPattern.test(cleanRef)) {
          result.ref = cleanRef;
          result.refType = cleanRef.includes('/') ? 'branch' : 'unknown';
        } else {
          this.logger.warn('Invalid ref format, using default', { ref: cleanRef });
          result.ref = 'main';
        }
      }
      
      // Check for cross-repository format (owner/repo:path)
      if (pathPart.includes(':')) {
        const colonParts = pathPart.split(':');
        if (colonParts.length !== 2) {
          throw new Error('Invalid cross-repo format: expected owner/repo:path');
        }
        
        const repoPart = colonParts[0];
        const filePart = colonParts[1];
        
        // Parse owner/repo
        const slashParts = repoPart.split('/');
        if (slashParts.length !== 2) {
          throw new Error('Invalid repo format: expected owner/repo');
        }
        
        const [owner, repo] = slashParts;
        
        // Validate owner
        if (!this.validation.ownerPattern.test(owner)) {
          this.logger.warn('Invalid GitHub owner format', { owner });
        }
        result.owner = owner;
        
        // Validate repo
        if (!this.validation.repoPattern.test(repo)) {
          this.logger.warn('Invalid GitHub repo format', { repo });
        }
        result.repo = repo;
        
        // Validate file path
        if (filePart && !this.validation.pathPattern.test(filePart)) {
          this.logger.warn('Invalid file path format', { path: filePart });
        }
        result.filePath = filePart || '';
        
      } else {
        // Use default owner/repo from constructor
        result.owner = this.repoOwner;
        result.repo = this.repoName;
        result.filePath = pathPart;
        
        // Validate file path
        if (pathPart && !this.validation.pathPattern.test(pathPart)) {
          this.logger.warn('Invalid file path format', { path: pathPart });
        }
      }
      
      // Additional validations
      if (!result.owner || !result.repo) {
        throw new Error('Could not determine repository owner and name');
      }
      
      // Normalize empty path to root
      if (result.filePath === '' || result.filePath === '.') {
        result.filePath = '';
        result.isRoot = true;
      }
      
      // Detect file type
      const ext = path.extname(result.filePath).toLowerCase();
      if (ext && this.fileTypeMap[ext]) {
        result.fileType = this.fileTypeMap[ext];
      }
      
      this.logger.debug('Path parsed successfully', { result });
      return result;
      
    } catch (error) {
      this.logger.error('Path parsing error', { 
        inputPath, 
        error: error.message,
        stack: error.stack 
      });
      throw new Error(`Failed to parse path "${inputPath}": ${error.message}`);
    }
  }

  /**
   * Enhanced content fetching with retry logic and error handling
   */
  async fetchContent(pathInfo, options = {}) {
    const maxRetries = options.maxRetries || this.retryConfig.maxRetries;
    const retryDelay = options.retryDelay || this.retryConfig.retryDelay;
    
    this.logger.info('Fetching content', { 
      owner: pathInfo.owner,
      repo: pathInfo.repo,
      path: pathInfo.filePath,
      ref: pathInfo.ref
    });
    
    // Check cache first
    const cacheKey = `${pathInfo.owner}/${pathInfo.repo}/${pathInfo.filePath}@${pathInfo.ref}`;
    if (this.contentCache.has(cacheKey)) {
      const cached = this.contentCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.logger.debug('Cache hit', { cacheKey });
        this.stats.cacheHits++;
        return cached.data;
      } else {
        this.logger.debug('Cache expired', { cacheKey });
        this.contentCache.delete(cacheKey);
      }
    }
    
    this.stats.cacheMisses++;
    
    // Retry logic
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Fetch attempt ${attempt}/${maxRetries}`, { pathInfo });
        
        // Make API call
        const { data } = await this.octokit.repos.getContent({
          owner: pathInfo.owner,
          repo: pathInfo.repo,
          path: pathInfo.filePath,
          ref: pathInfo.ref
        });
        
        this.stats.apiCalls++;
        
        // Handle different response types
        let content;
        if (Array.isArray(data)) {
          // It's a directory
          this.logger.debug('Content is a directory', { 
            path: pathInfo.filePath,
            fileCount: data.length 
          });
          
          content = {
            type: 'directory',
            path: pathInfo.filePath,
            files: data.map(item => ({
              name: item.name,
              path: item.path,
              type: item.type,
              size: item.size,
              sha: item.sha
            }))
          };
        } else if (data.type === 'file') {
          // It's a file
          this.logger.debug('Content is a file', { 
            path: pathInfo.filePath,
            size: data.size 
          });
          
          // Detect file type
          const ext = path.extname(data.name).toLowerCase();
          const fileType = this.fileTypeMap[ext] || { type: 'unknown', mime: 'application/octet-stream' };
          
          content = {
            type: 'file',
            path: pathInfo.filePath,
            name: data.name,
            size: data.size,
            sha: data.sha,
            fileType: fileType.type,
            mimeType: fileType.mime,
            language: fileType.language
          };
          
          // Handle content based on type
          if (fileType.binary) {
            // Binary file - keep base64
            content.encoding = 'base64';
            content.content = data.content;
            
            if (fileType.skip) {
              content.skipped = true;
              content.reason = 'Binary file type not suitable for context';
              this.logger.info('Skipping binary file', { path: pathInfo.filePath, type: fileType.type });
            }
          } else {
            // Text file - decode
            try {
              content.encoding = 'utf-8';
              content.content = Buffer.from(data.content, 'base64').toString('utf-8');
              
              // Validate UTF-8
              if (content.content.includes('\ufffd')) {
                this.logger.warn('File contains invalid UTF-8 characters', { path: pathInfo.filePath });
              }
              
              // Check for sensitive content
              if (fileType.sensitive) {
                this.logger.warn('Loading potentially sensitive file', { path: pathInfo.filePath });
                content.sensitive = true;
              }
            } catch (decodeError) {
              this.logger.error('Failed to decode file content', { 
                path: pathInfo.filePath,
                error: decodeError.message 
              });
              content.error = 'Failed to decode content';
              content.content = data.content; // Keep base64
            }
          }
          
          this.stats.bytesLoaded += data.size;
          this.stats.filesLoaded++;
          
        } else if (data.type === 'symlink') {
          // It's a symlink
          this.logger.info('Content is a symlink', { 
            path: pathInfo.filePath,
            target: data.target 
          });
          
          content = {
            type: 'symlink',
            path: pathInfo.filePath,
            target: data.target,
            skipped: true,
            reason: 'Symlinks not followed for security'
          };
          
        } else if (data.type === 'submodule') {
          // It's a submodule
          this.logger.info('Content is a submodule', { 
            path: pathInfo.filePath,
            submodule_git_url: data.submodule_git_url 
          });
          
          content = {
            type: 'submodule',
            path: pathInfo.filePath,
            gitUrl: data.submodule_git_url,
            skipped: true,
            reason: 'Submodules not followed'
          };
          
        } else {
          // Unknown type
          this.logger.warn('Unknown content type', { 
            path: pathInfo.filePath,
            type: data.type 
          });
          
          content = {
            type: 'unknown',
            path: pathInfo.filePath,
            originalType: data.type,
            skipped: true,
            reason: 'Unknown content type'
          };
        }
        
        // Cache the result
        this.contentCache.set(cacheKey, {
          data: content,
          timestamp: Date.now()
        });
        
        this.logger.info('Content fetched successfully', { 
          path: pathInfo.filePath,
          type: content.type,
          size: content.size 
        });
        
        return content;
        
      } catch (error) {
        lastError = error;
        this.stats.errors++;
        
        // Check error type
        if (error.status === 404) {
          this.logger.error('Content not found', { 
            path: pathInfo.filePath,
            ref: pathInfo.ref 
          });
          throw new Error(`File not found: ${pathInfo.filePath} in ${pathInfo.owner}/${pathInfo.repo}@${pathInfo.ref}`);
          
        } else if (error.status === 403) {
          if (error.message.includes('rate limit')) {
            this.logger.warn('Rate limit hit, waiting...', { 
              attempt,
              retryAfter: error.response?.headers?.['retry-after'] 
            });
            
            // Wait for rate limit reset
            const retryAfter = parseInt(error.response?.headers?.['retry-after'] || '60');
            await this.sleep(retryAfter * 1000);
            
          } else {
            this.logger.error('Access forbidden', { 
              path: pathInfo.filePath,
              message: error.message 
            });
            throw new Error(`Access forbidden: ${pathInfo.filePath} in ${pathInfo.owner}/${pathInfo.repo}`);
          }
          
        } else if (error.status === 401) {
          this.logger.error('Authentication failed', { 
            path: pathInfo.filePath 
          });
          throw new Error('GitHub authentication failed - check your token');
          
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
          this.logger.warn('Network error, retrying...', { 
            attempt,
            error: error.code 
          });
          
        } else {
          this.logger.error('Unexpected error', { 
            path: pathInfo.filePath,
            error: error.message,
            status: error.status 
          });
        }
        
        // Retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = this.retryConfig.exponentialBackoff 
            ? retryDelay * Math.pow(2, attempt - 1)
            : retryDelay;
            
          this.logger.info(`Retrying in ${delay}ms...`, { attempt, maxRetries });
          await this.sleep(delay);
          this.stats.retries++;
        }
      }
    }
    
    // All retries exhausted
    this.logger.error('All fetch attempts failed', { 
      path: pathInfo.filePath,
      attempts: maxRetries,
      lastError: lastError?.message 
    });
    
    throw new Error(`Failed to fetch ${pathInfo.filePath} after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Load multimodal context with enhanced error handling
   */
  async loadMultimodalContext(contextPaths, options = {}) {
    this.logger.info('Loading multimodal context', { 
      pathCount: contextPaths.length,
      options 
    });
    
    const context = {
      files: [],
      directories: [],
      multimodal: {
        images: [],
        pdfs: [],
        code: [],
        documents: [],
        notebooks: [],
        data: []
      },
      errors: [],
      warnings: [],
      skipped: [],
      summary: {}
    };
    
    // Process paths in parallel with concurrency limit
    const concurrency = options.concurrency || 5;
    const results = [];
    
    for (let i = 0; i < contextPaths.length; i += concurrency) {
      const batch = contextPaths.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (contextPath) => {
          try {
            const pathInfo = this.parsePath(contextPath);
            const content = await this.fetchContent(pathInfo);
            
            return { success: true, pathInfo, content };
            
          } catch (error) {
            this.logger.error('Failed to load context path', { 
              path: contextPath,
              error: error.message 
            });
            
            context.errors.push({
              path: contextPath,
              error: error.message
            });
            
            return { success: false, path: contextPath, error: error.message };
          }
        })
      );
      
      results.push(...batchResults);
    }
    
    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        const { content, pathInfo } = result.value;
        
        if (content.type === 'directory') {
          context.directories.push(content);
          
          // Load directory contents if requested
          if (options.loadDirectoryContents) {
            await this.loadDirectoryContents(content, pathInfo, context, options);
          }
          
        } else if (content.type === 'file') {
          if (content.skipped) {
            context.skipped.push({
              path: content.path,
              reason: content.reason,
              type: content.fileType
            });
          } else {
            context.files.push(content);
            this.categorizeFile(content, context);
          }
        } else {
          context.skipped.push({
            path: content.path,
            reason: content.reason || 'Unknown type',
            type: content.type
          });
        }
      } else if (result.status === 'rejected') {
        this.logger.error('Context loading failed', { 
          error: result.reason?.message || result.reason 
        });
      }
    }
    
    // Generate summary
    context.summary = this.generateContextSummary(context);
    
    this.logger.info('Multimodal context loaded', { 
      summary: context.summary 
    });
    
    return context;
  }

  /**
   * Load directory contents with limits
   */
  async loadDirectoryContents(directory, pathInfo, context, options) {
    const maxFiles = options.maxFilesPerDirectory || 20;
    const includePatterns = options.includePatterns || [];
    const excludePatterns = options.excludePatterns || [];
    
    this.logger.debug('Loading directory contents', { 
      path: directory.path,
      fileCount: directory.files.length 
    });
    
    let filesToLoad = directory.files;
    
    // Apply filters
    if (includePatterns.length > 0) {
      filesToLoad = filesToLoad.filter(file => 
        includePatterns.some(pattern => pattern.test(file.path))
      );
    }
    
    if (excludePatterns.length > 0) {
      filesToLoad = filesToLoad.filter(file => 
        !excludePatterns.some(pattern => pattern.test(file.path))
      );
    }
    
    // Limit number of files
    if (filesToLoad.length > maxFiles) {
      this.logger.info('Directory has too many files, sampling', { 
        path: directory.path,
        total: filesToLoad.length,
        sampling: maxFiles 
      });
      
      // Sample intelligently by type
      filesToLoad = this.sampleFilesByType(filesToLoad, maxFiles);
    }
    
    // Load files
    for (const fileInfo of filesToLoad) {
      try {
        const filePathInfo = {
          ...pathInfo,
          filePath: fileInfo.path
        };
        
        const content = await this.fetchContent(filePathInfo);
        
        if (content.type === 'file' && !content.skipped) {
          context.files.push(content);
          this.categorizeFile(content, context);
        } else if (content.skipped) {
          context.skipped.push({
            path: content.path,
            reason: content.reason,
            type: content.fileType
          });
        }
        
      } catch (error) {
        context.errors.push({
          path: fileInfo.path,
          error: error.message
        });
      }
    }
  }

  /**
   * Categorize file into appropriate multimodal category
   */
  categorizeFile(file, context) {
    const { fileType } = file;
    
    switch (fileType) {
      case 'code':
        context.multimodal.code.push(file);
        break;
      case 'image':
        context.multimodal.images.push(file);
        break;
      case 'document':
      case 'pdf':
        context.multimodal.pdfs.push(file);
        break;
      case 'notebook':
        context.multimodal.notebooks.push(file);
        break;
      case 'data':
      case 'spreadsheet':
        context.multimodal.data.push(file);
        break;
      case 'text':
      case 'markup':
      case 'config':
        context.multimodal.documents.push(file);
        break;
      default:
        this.logger.debug('Uncategorized file type', { 
          path: file.path,
          type: fileType 
        });
    }
  }

  /**
   * Sample files intelligently by type
   */
  sampleFilesByType(files, maxCount) {
    const byType = {};
    
    // Group by type
    for (const file of files) {
      const ext = path.extname(file.path).toLowerCase();
      const fileType = this.fileTypeMap[ext]?.type || 'unknown';
      
      if (!byType[fileType]) {
        byType[fileType] = [];
      }
      byType[fileType].push(file);
    }
    
    // Priority order
    const priorities = ['code', 'config', 'text', 'data', 'image', 'document', 'unknown'];
    
    const sampled = [];
    let remaining = maxCount;
    
    for (const type of priorities) {
      if (byType[type] && remaining > 0) {
        const count = Math.min(
          Math.ceil(remaining * 0.3), // Take up to 30% per type
          byType[type].length
        );
        
        // Sort by size and take smallest
        byType[type].sort((a, b) => (a.size || 0) - (b.size || 0));
        sampled.push(...byType[type].slice(0, count));
        remaining -= count;
      }
    }
    
    return sampled;
  }

  /**
   * Generate context summary with statistics
   */
  generateContextSummary(context) {
    const summary = {
      totalFiles: context.files.length,
      totalDirectories: context.directories.length,
      totalSize: context.files.reduce((sum, f) => sum + (f.size || 0), 0),
      byType: {},
      errors: context.errors.length,
      warnings: context.warnings.length,
      skipped: context.skipped.length
    };
    
    // Count by type
    for (const [category, files] of Object.entries(context.multimodal)) {
      if (files.length > 0) {
        summary.byType[category] = {
          count: files.length,
          size: files.reduce((sum, f) => sum + (f.size || 0), 0)
        };
      }
    }
    
    // Add human-readable size
    summary.totalSizeFormatted = this.formatBytes(summary.totalSize);
    
    return summary;
  }

  /**
   * Utility functions
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheEfficiency: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0,
      errorRate: this.stats.errors / this.stats.apiCalls || 0,
      retryRate: this.stats.retries / this.stats.apiCalls || 0,
      averageFileSize: this.stats.bytesLoaded / this.stats.filesLoaded || 0
    };
  }

  /**
   * Get execution logs
   */
  getLogs() {
    return this.logger.getLogs();
  }

  /**
   * Clear cache and reset statistics
   */
  reset() {
    this.contentCache.clear();
    this.logger.clearLogs();
    this.stats = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      retries: 0,
      errors: 0,
      warnings: 0,
      filesLoaded: 0,
      filesSkipped: 0,
      bytesLoaded: 0
    };
  }
}

module.exports = { ABTestToolRobust, StructuredLogger };