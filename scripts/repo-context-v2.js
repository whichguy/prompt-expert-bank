#!/usr/bin/env node

/**
 * Repository Context Loader v2
 * Uses git hashes and supports images/PDFs via Anthropic Messages API
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class RepoContextV2 {
  constructor(repoPath, options = {}) {
    this.repoPath = repoPath;
    this.maxFiles = options.maxFiles || 50;
    this.maxFileSize = options.maxFileSize || 5000000; // 5MB for images/PDFs
    this.maxTextSize = options.maxTextSize || 100000; // 100KB for text files
    this.includeImages = options.includeImages !== false;
    this.includePDFs = options.includePDFs !== false;
  }

  async loadContext() {
    console.error(`[REPO-CONTEXT] Loading repository context from: ${this.repoPath}`);
    console.error(`[REPO-CONTEXT] Options: maxFiles=${this.maxFiles}, includeImages=${this.includeImages}, includePDFs=${this.includePDFs}`);
    
    try {
      // Get relevant files with git hashes
      const files = await this.getRelevantFiles();
      console.error(`[REPO-CONTEXT] Found ${files.length} relevant files to load`);
      
      // Build context structure for Anthropic API
      const context = await this.buildContextStructure(files);
      
      console.error(`[REPO-CONTEXT] Context built successfully:`);
      console.error(`[REPO-CONTEXT]   - Text files: ${context.summary.textFiles}`);
      console.error(`[REPO-CONTEXT]   - Image files: ${context.summary.imageFiles}`);
      console.error(`[REPO-CONTEXT]   - PDF files: ${context.summary.pdfFiles}`);
      console.error(`[REPO-CONTEXT]   - Total size: ${Math.round(context.summary.totalSize / 1024)}KB`);
      console.error(`[REPO-CONTEXT]   - Unique hashes: ${context.summary.uniqueHashes}`);
      
      return context;
    } catch (error) {
      console.error('[REPO-CONTEXT] Error loading repository context:', error);
      throw error;
    }
  }

  async getRelevantFiles() {
    const files = [];
    const isGitRepo = await this.isGitRepository();
    
    // Get file list with git hashes if available
    if (isGitRepo) {
      files.push(...await this.getGitFiles());
      // If git returns no files (e.g., no tracked files), fall back to scanning
      if (files.length === 0) {
        console.error('[REPO-CONTEXT] Git returned no tracked files, falling back to directory scan');
        files.push(...await this.scanDirectory());
      }
    } else {
      files.push(...await this.scanDirectory());
    }
    
    // Sort by importance
    files.sort((a, b) => this.getFileImportance(b.path) - this.getFileImportance(a.path));
    
    return files.slice(0, this.maxFiles);
  }

  async isGitRepository() {
    try {
      execSync('git rev-parse --is-inside-work-tree', { 
        cwd: this.repoPath, 
        stdio: 'pipe' 
      });
      return true;
    } catch {
      return false;
    }
  }

  async getGitFiles() {
    const files = [];
    
    try {
      // Get all tracked files with their blob hashes
      const output = execSync('git ls-tree -r HEAD --format="%(objectname) %(path)"', {
        cwd: this.repoPath,
        encoding: 'utf8'
      });
      
      const lines = output.trim().split('\n').filter(line => line);
      
      for (const line of lines) {
        const [hash, ...pathParts] = line.split(' ');
        const filePath = pathParts.join(' ');
        const fullPath = path.join(this.repoPath, filePath);
        
        // Check if file matches our criteria
        if (this.isRelevantFile(filePath)) {
          const stats = await fs.stat(fullPath);
          const type = this.getFileType(filePath);
          
          // Apply size limits based on type
          const maxSize = type === 'text' ? this.maxTextSize : this.maxFileSize;
          
          if (stats.size <= maxSize) {
            files.push({
              path: filePath,
              fullPath: fullPath,
              gitHash: hash,
              size: stats.size,
              type: type
            });
          }
        }
      }
    } catch (error) {
      console.warn('Error reading git files:', error.message);
    }
    
    return files;
  }

  async scanDirectory() {
    const files = [];
    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', 'venv'];
    
    const scanDir = async (dir, depth = 0) => {
      if (depth > 5) return; // Limit depth
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.repoPath, fullPath);
        
        if (entry.isDirectory()) {
          if (!skipDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            await scanDir(fullPath, depth + 1);
          }
        } else if (entry.isFile() && this.isRelevantFile(entry.name)) {
          const stats = await fs.stat(fullPath);
          const type = this.getFileType(entry.name);
          const maxSize = type === 'text' ? this.maxTextSize : this.maxFileSize;
          
          if (stats.size <= maxSize) {
            // Calculate content hash for non-git files
            const content = await fs.readFile(fullPath);
            const hash = this.calculateHash(type, content);
            
            files.push({
              path: relativePath,
              fullPath: fullPath,
              contentHash: hash,
              size: stats.size,
              type: type
            });
          }
        }
        
        if (files.length >= this.maxFiles) {
          return files;
        }
      }
    };
    
    await scanDir(this.repoPath);
    return files;
  }

  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    // Images
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) {
      return 'image';
    }
    
    // PDFs
    if (ext === '.pdf') {
      return 'pdf';
    }
    
    // Everything else is text
    return 'text';
  }

  isRelevantFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    // Text files
    const textExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs',
      '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift',
      '.md', '.json', '.yaml', '.yml', '.xml', '.toml', '.ini',
      '.sql', '.sh', '.bash', '.dockerfile', '.proto', '.txt', '.env.example'
    ];
    
    // Special files
    const specialFiles = ['Dockerfile', 'Makefile', '.gitignore', 'README', 'LICENSE'];
    
    if (textExtensions.includes(ext) || specialFiles.includes(path.basename(filename))) {
      return true;
    }
    
    // Images (if enabled)
    if (this.includeImages && this.getFileType(filename) === 'image') {
      return true;
    }
    
    // PDFs (if enabled)
    if (this.includePDFs && this.getFileType(filename) === 'pdf') {
      return true;
    }
    
    return false;
  }

  calculateHash(type, content) {
    // Create a consistent hash matching git's blob hash format
    // Git always uses 'blob' as the object type, not the file type
    const header = `blob ${content.length}\0`;
    return crypto
      .createHash('sha1')
      .update(header)
      .update(content)
      .digest('hex');
  }

  getFileImportance(filePath) {
    const name = path.basename(filePath);
    
    // Highest priority files
    if (name === 'package.json' || name === 'requirements.txt' || name === 'go.mod') return 100;
    if (name === 'README.md' || name === 'readme.md') return 90;
    if (name === '.env.example' || name === '.env.sample') return 85;
    if (name === 'docker-compose.yml' || name === 'Dockerfile') return 80;
    
    // Entry points
    if (name === 'index.js' || name === 'main.js' || name === 'app.js' || name === 'main.py') return 75;
    if (name === 'server.js' || name === 'api.js') return 70;
    
    // Configuration
    if (name.includes('config')) return 60;
    if (name === 'tsconfig.json' || name === '.eslintrc') return 55;
    
    // Architecture/Design docs or images
    if (filePath.includes('architecture') || filePath.includes('design')) {
      if (this.getFileType(name) === 'image') return 65;
      if (name.endsWith('.md')) return 60;
    }
    
    // Source code
    if (filePath.includes('src/') || filePath.includes('lib/')) return 50;
    
    // Tests
    if (filePath.includes('test') || filePath.includes('spec')) return 30;
    
    // Documentation
    if (filePath.includes('docs/')) return 25;
    
    // Default
    return 10;
  }

  async buildContextStructure(files) {
    console.error(`[REPO-CONTEXT] Building context structure for ${files.length} files`);
    const messages = [];
    const cacheableContent = [];
    const nonCacheableContent = [];
    
    // Group files by hash for efficient caching
    const filesByHash = new Map();
    
    for (const file of files) {
      const hash = file.gitHash || file.contentHash;
      
      if (!filesByHash.has(hash)) {
        filesByHash.set(hash, []);
      }
      filesByHash.get(hash).push(file);
    }
    
    console.error(`[REPO-CONTEXT] Grouped into ${filesByHash.size} unique content hashes`);
    
    // Build context content
    const textFiles = [];
    const mediaFiles = [];
    
    for (const [hash, fileGroup] of filesByHash) {
      const file = fileGroup[0]; // Use first file (they all have same content)
      
      try {
        if (file.type === 'text') {
          const content = await fs.readFile(file.fullPath, 'utf8');
          console.error(`[REPO-CONTEXT] Loaded text file: ${file.path} (${content.length} chars) - Hash: ${hash.substring(0, 8)}`);
          
          // Add to text content with hash identifier
          textFiles.push({
            hash: hash,
            paths: fileGroup.map(f => f.path),
            content: content,
            type: 'text'
          });
          
        } else if (file.type === 'image' || file.type === 'pdf') {
          const content = await fs.readFile(file.fullPath);
          const base64 = content.toString('base64');
          const mediaType = this.getMediaType(file.path);
          console.error(`[REPO-CONTEXT] Loaded ${file.type} file: ${file.path} (${Math.round(content.length / 1024)}KB) - Hash: ${hash.substring(0, 8)}`);
          
          mediaFiles.push({
            hash: hash,
            paths: fileGroup.map(f => f.path),
            data: base64,
            mediaType: mediaType,
            type: file.type
          });
        }
      } catch (error) {
        console.warn(`[REPO-CONTEXT] Error reading file ${file.path}: ${error.message}`);
      }
    }
    
    // Build the context structure for Anthropic API
    const contextStructure = {
      // System context that can be cached
      systemContext: this.buildSystemContext(textFiles),
      
      // Files that can be included as message content
      textFiles: textFiles,
      mediaFiles: mediaFiles,
      
      // Cache control metadata
      cacheControl: {
        // Use file hashes as cache keys
        cacheKeys: Array.from(filesByHash.keys()),
        ttl: 3600 // 1 hour cache
      },
      
      // Summary for logging
      summary: {
        totalFiles: files.length,
        textFiles: textFiles.length,
        imageFiles: mediaFiles.filter(f => f.type === 'image').length,
        pdfFiles: mediaFiles.filter(f => f.type === 'pdf').length,
        uniqueHashes: filesByHash.size,
        totalSize: files.reduce((sum, f) => sum + f.size, 0)
      }
    };
    
    return contextStructure;
  }

  buildSystemContext(textFiles) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('REPOSITORY CONTEXT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Repository: ${path.basename(this.repoPath)}`);
    lines.push(`Files Loaded: ${textFiles.length} text files`);
    
    // Try to get git info
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      }).trim();
      const commit = execSync('git rev-parse --short HEAD', {
        cwd: this.repoPath,
        encoding: 'utf8'
      }).trim();
      lines.push(`Git Branch: ${branch} (${commit})`);
    } catch (e) {
      // Not a git repo or git not available
    }
    
    lines.push('');
    lines.push('FILES:');
    lines.push('-'.repeat(60));
    
    for (const file of textFiles) {
      lines.push('');
      lines.push(`FILE: ${file.paths[0]} [Hash: ${file.hash.substring(0, 8)}]`);
      if (file.paths.length > 1) {
        lines.push(`  Also: ${file.paths.slice(1).join(', ')}`);
      }
      lines.push('-'.repeat(40));
      
      // Include content with truncation for very long files
      const maxLines = 100;
      const contentLines = file.content.split('\n');
      
      if (contentLines.length > maxLines) {
        lines.push(contentLines.slice(0, maxLines).join('\n'));
        lines.push(`\n[... truncated ${contentLines.length - maxLines} lines ...]`);
      } else {
        lines.push(file.content);
      }
      
      lines.push('');
    }
    
    lines.push('='.repeat(60));
    lines.push('END REPOSITORY CONTEXT');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  getMediaType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mediaTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.pdf': 'application/pdf'
    };
    
    return mediaTypes[ext] || 'application/octet-stream';
  }

  // Format context for Anthropic Messages API with cache control
  formatForAPI(contextStructure) {
    const messages = [];
    
    // Add system context as a cacheable message
    if (contextStructure.systemContext) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: contextStructure.systemContext,
            cache_control: {
              type: 'ephemeral'  // Cache this content
            }
          }
        ]
      });
    }
    
    // Add media files if any
    if (contextStructure.mediaFiles.length > 0) {
      const mediaContent = [];
      
      for (const file of contextStructure.mediaFiles) {
        if (file.type === 'image') {
          mediaContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.mediaType,
              data: file.data
            },
            cache_control: {
              type: 'ephemeral'
            }
          });
          
          // Add caption
          mediaContent.push({
            type: 'text',
            text: `Image: ${file.paths[0]} [Hash: ${file.hash.substring(0, 8)}]`
          });
        }
        // Note: PDFs would need to be converted to images or text
        // The Anthropic API doesn't directly support PDF files
      }
      
      if (mediaContent.length > 0) {
        messages.push({
          role: 'user',
          content: mediaContent
        });
      }
    }
    
    return messages;
  }
}

// Export for use in workflows
module.exports = RepoContextV2;

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node repo-context-v2.js <repository-path> [--max-files=N] [--include-images] [--include-pdfs]');
    process.exit(1);
  }
  
  const repoPath = args[0];
  const options = {};
  
  // Parse options
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--max-files=')) {
      options.maxFiles = parseInt(args[i].split('=')[1]);
    } else if (args[i] === '--include-images') {
      options.includeImages = true;
    } else if (args[i] === '--include-pdfs') {
      options.includePDFs = true;
    }
  }
  
  const loader = new RepoContextV2(repoPath, options);
  
  loader.loadContext().then(context => {
    // Prepare output for both evaluation and cache tracking
    const output = {
      ...context,
      // Add file list for cache manager tracking
      textFiles: context.textFiles || [],
      mediaFiles: context.mediaFiles || [],
      // Include file details for tracking
      files: []
    };
    
    // Combine all files for tracking
    if (context.textFiles) {
      for (const file of context.textFiles) {
        output.files.push({
          hash: file.hash,
          path: file.paths[0], // Use first path
          type: 'text',
          size: Buffer.byteLength(file.content, 'utf8'),
          content: file.content
        });
      }
    }
    
    if (context.mediaFiles) {
      for (const file of context.mediaFiles) {
        output.files.push({
          hash: file.hash,
          path: file.paths[0], // Use first path
          type: file.type,
          size: Buffer.byteLength(file.data, 'base64'),
          content: file.data
        });
      }
    }
    
    // Output JSON structure for use in evaluation and tracking
    console.log(JSON.stringify(output, null, 2));
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}