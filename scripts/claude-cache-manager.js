#!/usr/bin/env node

/**
 * Claude Cache Manager
 * Manages file versions sent to Claude API and tracks what needs cleanup
 * Supports multimodal files (text, images, PDFs, markdown, etc.)
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class ClaudeCacheManager {
  constructor(repoPath, options = {}) {
    this.repoPath = repoPath;
    this.cacheIndexFile = options.cacheIndexFile || path.join(repoPath, '.claude-cache-index.json');
    this.maxAge = options.maxAge || 14; // Days
    this.index = null;
    
    // Supported file types for multimodal context
    this.supportedTypes = {
      text: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', 
             '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift',
             '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.toml', '.ini',
             '.sql', '.sh', '.bash', '.dockerfile', '.proto', '.env.example'],
      image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
      pdf: ['.pdf'],
      special: ['Dockerfile', 'Makefile', '.gitignore', 'README', 'LICENSE']
    };
  }

  async initialize() {
    // Ensure cache directory exists (for .claude-cache-index.json)
    const cacheDir = path.dirname(this.cacheIndexFile);
    try {
      await fs.mkdir(cacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Load existing cache index or create new one
    try {
      const data = await fs.readFile(this.cacheIndexFile, 'utf8');
      this.index = JSON.parse(data);
      
      // Migrate old format if needed
      if (!this.index.version || this.index.version < '2.0') {
        this.index = this.migrateIndex(this.index);
      }
    } catch (error) {
      // Index doesn't exist, create new one
      this.index = {
        version: '2.0',
        sessions: {},  // Track files sent in each session
        files: {},     // Global file tracking with metadata
        lastCleanup: new Date().toISOString(),
        stats: {
          totalFilesSent: 0,
          totalBytesSent: 0,
          cacheSavings: 0
        }
      };
    }
  }

  /**
   * Migrate from old cache format to new
   */
  migrateIndex(oldIndex) {
    const newIndex = {
      version: '2.0',
      sessions: {},
      files: oldIndex.files || {},
      lastCleanup: oldIndex.lastCleanup || new Date().toISOString(),
      stats: {
        totalFilesSent: 0,
        totalBytesSent: 0,
        cacheSavings: 0
      }
    };
    
    // Update file entries to new format
    for (const [hash, fileData] of Object.entries(newIndex.files)) {
      if (!fileData.type) {
        fileData.type = this.detectFileType(fileData.path);
      }
      if (!fileData.claudeId) {
        fileData.claudeId = hash; // Use hash as ID for backwards compatibility
      }
      if (!fileData.sentCount) {
        fileData.sentCount = fileData.referenceCount || 0;
      }
    }
    
    return newIndex;
  }

  /**
   * Detect file type from path
   */
  detectFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);
    
    // Check special files
    if (this.supportedTypes.special.includes(basename)) {
      return 'text';
    }
    
    // Check by extension
    for (const [type, extensions] of Object.entries(this.supportedTypes)) {
      if (type === 'special') continue;
      if (extensions.includes(ext)) {
        return type;
      }
    }
    
    return 'text'; // Default to text
  }

  /**
   * Get current git files with their blob hashes
   */
  async getCurrentGitFiles() {
    const files = {};
    
    try {
      // Get all files including binary files
      const output = execSync('git ls-tree -r HEAD', {
        cwd: this.repoPath,
        encoding: 'utf8'
      });
      
      const lines = output.trim().split('\n').filter(line => line);
      
      for (const line of lines) {
        // Format: mode type hash\tpath
        const match = line.match(/^\d+\s+\w+\s+([a-f0-9]{40})\t(.+)$/);
        if (match) {
          const [, hash, filePath] = match;
          files[filePath] = {
            hash: hash,
            type: this.detectFileType(filePath)
          };
        }
      }
    } catch (error) {
      console.warn('Not a git repository or git error:', error.message);
    }
    
    return files;
  }

  /**
   * Get file's last modification date from git
   */
  async getFileLastModified(filePath) {
    try {
      const output = execSync(`git log -1 --format=%cI -- "${filePath}"`, {
        cwd: this.repoPath,
        encoding: 'utf8'
      }).trim();
      
      return output || new Date().toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  /**
   * Calculate file ID consistently (matching git blob hash format)
   */
  calculateFileId(content, type = 'blob') {
    // Use git's blob hash format for consistency
    const header = `blob ${content.length}\0`;
    return crypto
      .createHash('sha1')
      .update(header)
      .update(content)
      .digest('hex');
  }

  /**
   * Get stale files that should be cleaned from Claude's perspective
   */
  async getStaleFiles() {
    const staleFiles = [];
    const currentDate = new Date();
    const maxAgeMs = this.maxAge * 24 * 60 * 60 * 1000;
    
    try {
      // Get current git files
      const currentFiles = await this.getCurrentGitFiles();
      
      // Track current file hashes for comparison
      const currentHashes = new Set();
      for (const fileInfo of Object.values(currentFiles)) {
        currentHashes.add(fileInfo.hash);
      }
      
      // Check each cached file
      for (const [fileId, fileData] of Object.entries(this.index.files)) {
        const isStale = await this.isFileStale(fileId, fileData, currentFiles, currentHashes, maxAgeMs);
        if (isStale) {
          staleFiles.push(isStale);
        }
      }
      
      // Check git history for old versions
      const historicalStale = await this.getHistoricalStaleVersions(currentFiles, maxAgeMs);
      staleFiles.push(...historicalStale);
      
    } catch (error) {
      console.error('Error checking stale files:', error);
    }
    
    return staleFiles;
  }

  /**
   * Check if a specific file is stale
   */
  async isFileStale(fileId, fileData, currentFiles, currentHashes, maxAgeMs) {
    const currentDate = new Date();
    
    // Check if this hash exists in current files
    if (!currentHashes.has(fileId)) {
      // File hash not in current repo - it's been deleted or modified
      
      // Check if it's an old version
      const lastModified = new Date(fileData.lastSent || fileData.firstSent);
      const age = currentDate - lastModified;
      
      if (age > maxAgeMs) {
        return {
          claudeId: fileData.claudeId || fileId,
          hash: fileId,
          path: fileData.path,
          type: fileData.type,
          reason: 'outdated',
          age: Math.floor(age / (24 * 60 * 60 * 1000)), // days
          sentCount: fileData.sentCount || 0,
          lastSent: fileData.lastSent
        };
      }
    }
    
    // Check if file hasn't been used recently
    if (fileData.lastSent) {
      const lastSentDate = new Date(fileData.lastSent);
      const unusedTime = currentDate - lastSentDate;
      
      // If not sent in 2x max age, mark as stale
      if (unusedTime > maxAgeMs * 2) {
        return {
          claudeId: fileData.claudeId || fileId,
          hash: fileId,
          path: fileData.path,
          type: fileData.type,
          reason: 'unused',
          unusedDays: Math.floor(unusedTime / (24 * 60 * 60 * 1000)),
          sentCount: fileData.sentCount || 0,
          lastSent: fileData.lastSent
        };
      }
    }
    
    return null;
  }

  /**
   * Get historical versions that are stale
   */
  async getHistoricalStaleVersions(currentFiles, maxAgeMs) {
    const staleVersions = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.maxAge);
    
    try {
      // Get commits older than cutoff date
      const output = execSync(
        `git log --before="${cutoffDate.toISOString()}" --pretty=format:"%H %cI" --name-status`,
        {
          cwd: this.repoPath,
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );
      
      const lines = output.trim().split('\n');
      let currentCommit = null;
      let currentDate = null;
      const processedHashes = new Set();
      
      for (const line of lines) {
        if (line.match(/^[a-f0-9]{40}/)) {
          // This is a commit line
          const [hash, ...dateParts] = line.split(' ');
          currentCommit = hash;
          currentDate = dateParts.join(' ');
        } else if (line && currentCommit) {
          // This is a file status line (A/M/D\tfilepath)
          const match = line.match(/^[AMD]\t(.+)$/);
          if (match) {
            const filePath = match[1];
            const fileType = this.detectFileType(filePath);
            
            // Only process supported file types
            if (fileType) {
              try {
                // Get the file's blob hash at this commit
                const blobHash = execSync(
                  `git ls-tree ${currentCommit} -- "${filePath}" | awk '{print $3}'`,
                  {
                    cwd: this.repoPath,
                    encoding: 'utf8'
                  }
                ).trim();
                
                if (blobHash && !processedHashes.has(blobHash)) {
                  processedHashes.add(blobHash);
                  
                  // Check if this old version exists in our cache
                  if (this.index.files[blobHash]) {
                    staleVersions.push({
                      claudeId: this.index.files[blobHash].claudeId || blobHash,
                      hash: blobHash,
                      path: filePath,
                      type: fileType,
                      reason: 'historical',
                      commit: currentCommit.substring(0, 8),
                      date: currentDate,
                      sentCount: this.index.files[blobHash].sentCount || 0
                    });
                  }
                }
              } catch (e) {
                // File might not exist in that commit
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error getting historical versions:', error.message);
    }
    
    return staleVersions;
  }

  /**
   * Track files being sent to Claude
   */
  async trackFilesSent(files, sessionId = null) {
    const now = new Date().toISOString();
    
    if (!sessionId) {
      sessionId = crypto.randomBytes(8).toString('hex');
    }
    
    console.error(`[CLAUDE-CACHE] Starting file tracking for session: ${sessionId}`);
    console.error(`[CLAUDE-CACHE] Processing ${files.length} files for Claude API`);
    
    // Initialize session if needed
    if (!this.index.sessions[sessionId]) {
      console.error(`[CLAUDE-CACHE] Creating new session: ${sessionId}`);
      this.index.sessions[sessionId] = {
        startTime: now,
        files: [],
        stats: {
          filesSent: 0,
          bytesSent: 0,
          cacheHits: 0
        }
      };
    }
    
    const session = this.index.sessions[sessionId];
    let newFiles = 0;
    let cachedFiles = 0;
    
    for (const file of files) {
      const fileId = file.hash || file.contentHash || this.calculateFileId(file.content);
      const fileType = file.type || this.detectFileType(file.path);
      
      // Track in global files index
      if (!this.index.files[fileId]) {
        console.error(`[CLAUDE-CACHE] NEW FILE: ${file.path} (${fileType}) - Hash: ${fileId.substring(0, 8)}`);
        newFiles++;
        this.index.files[fileId] = {
          path: file.path,
          type: fileType,
          firstSent: now,
          sentCount: 0,
          claudeId: fileId, // This would be replaced with actual Claude cache ID if available
          size: file.size || 0
        };
      } else {
        console.error(`[CLAUDE-CACHE] CACHED FILE: ${file.path} (${fileType}) - Hash: ${fileId.substring(0, 8)} - Sent ${this.index.files[fileId].sentCount} times before`);
        cachedFiles++;
      }
      
      const fileEntry = this.index.files[fileId];
      fileEntry.lastSent = now;
      fileEntry.sentCount++;
      
      // Track in session
      session.files.push({
        fileId: fileId,
        path: file.path,
        sentAt: now,
        cached: fileEntry.sentCount > 1 // Was it cached?
      });
      
      // Update stats
      session.stats.filesSent++;
      session.stats.bytesSent += file.size || 0;
      if (fileEntry.sentCount > 1) {
        session.stats.cacheHits++;
        this.index.stats.cacheSavings += file.size || 0;
        console.error(`[CLAUDE-CACHE] Cache hit saved ${file.size || 0} bytes`);
      }
      
      // Update global stats
      this.index.stats.totalFilesSent++;
      this.index.stats.totalBytesSent += file.size || 0;
    }
    
    console.error(`[CLAUDE-CACHE] Session ${sessionId} summary:`);
    console.error(`[CLAUDE-CACHE]   - New files: ${newFiles}`);
    console.error(`[CLAUDE-CACHE]   - Cached files: ${cachedFiles}`);
    console.error(`[CLAUDE-CACHE]   - Total bytes: ${session.stats.bytesSent}`);
    console.error(`[CLAUDE-CACHE]   - Cache hits: ${session.stats.cacheHits}`);
    console.error(`[CLAUDE-CACHE]   - Total cache savings: ${Math.round(this.index.stats.cacheSavings / 1024)}KB`);
    
    await this.saveIndex();
    return sessionId;
  }

  /**
   * Mark files for cleanup
   */
  async markForCleanup(staleFiles) {
    const cleaned = [];
    
    for (const stale of staleFiles) {
      const fileId = stale.hash;
      
      if (this.index.files[fileId]) {
        // Mark as cleaned in our index
        this.index.files[fileId].cleanedAt = new Date().toISOString();
        this.index.files[fileId].cleanReason = stale.reason;
        
        cleaned.push({
          claudeId: stale.claudeId,
          hash: fileId,
          path: stale.path,
          type: stale.type,
          reason: stale.reason,
          sentCount: stale.sentCount
        });
        
        // Don't delete from index, just mark as cleaned
        // This helps us track what we've already cleaned
      }
    }
    
    // Update last cleanup time
    this.index.lastCleanup = new Date().toISOString();
    await this.saveIndex();
    
    return cleaned;
  }

  /**
   * Generate cleanup report
   */
  generateCleanupReport(staleFiles, cleanedFiles) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        staleFilesFound: staleFiles.length,
        filesMarkedForCleanup: cleanedFiles.length,
        reasonBreakdown: {},
        typeBreakdown: {}
      },
      details: [],
      recommendations: []
    };
    
    // Count by reason and type
    for (const file of staleFiles) {
      report.summary.reasonBreakdown[file.reason] = 
        (report.summary.reasonBreakdown[file.reason] || 0) + 1;
      
      report.summary.typeBreakdown[file.type] = 
        (report.summary.typeBreakdown[file.type] || 0) + 1;
      
      report.details.push({
        path: file.path,
        hash: file.hash.substring(0, 8),
        type: file.type,
        reason: file.reason,
        age: file.age,
        sentCount: file.sentCount,
        cleaned: cleanedFiles.some(c => c.hash === file.hash)
      });
    }
    
    // Add recommendations
    if (staleFiles.length > 50) {
      report.recommendations.push('Consider increasing cleanup frequency - many stale files found');
    }
    
    if (report.summary.reasonBreakdown.historical > 20) {
      report.recommendations.push('Many historical versions found - consider archiving old branches');
    }
    
    return report;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    await this.initialize();
    
    const stats = {
      totalFiles: Object.keys(this.index.files).length,
      lastCleanup: this.index.lastCleanup,
      filesByType: {},
      totalSentCount: 0,
      averageAge: 0,
      cacheSavings: Math.round(this.index.stats.cacheSavings / 1024) + 'KB',
      recentSessions: []
    };
    
    const now = new Date();
    let totalAge = 0;
    let activeFiles = 0;
    
    for (const [hash, file] of Object.entries(this.index.files)) {
      // Count by type
      stats.filesByType[file.type] = (stats.filesByType[file.type] || 0) + 1;
      
      // Count total sends
      stats.totalSentCount += file.sentCount || 0;
      
      // Calculate age for active files
      if (!file.cleanedAt) {
        activeFiles++;
        if (file.firstSent) {
          const age = now - new Date(file.firstSent);
          totalAge += age;
        }
      }
    }
    
    if (activeFiles > 0) {
      stats.averageAge = Math.floor(totalAge / activeFiles / (24 * 60 * 60 * 1000)); // days
    }
    
    // Get recent sessions
    const sessions = Object.entries(this.index.sessions)
      .sort((a, b) => new Date(b[1].startTime) - new Date(a[1].startTime))
      .slice(0, 5);
    
    for (const [id, session] of sessions) {
      stats.recentSessions.push({
        id: id,
        startTime: session.startTime,
        filesSent: session.stats.filesSent,
        cacheHits: session.stats.cacheHits,
        bytesSent: Math.round(session.stats.bytesSent / 1024) + 'KB'
      });
    }
    
    stats.activeFiles = activeFiles;
    stats.cleanedFiles = Object.keys(this.index.files).length - activeFiles;
    
    return stats;
  }

  /**
   * Save index to disk
   */
  async saveIndex() {
    try {
      await fs.writeFile(
        this.cacheIndexFile,
        JSON.stringify(this.index, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error saving cache index:', error);
    }
  }

  /**
   * Delete specific files from cache by file ID
   */
  async deleteFilesByIds(fileIds) {
    const deleted = [];
    const notFound = [];
    
    for (const fileId of fileIds) {
      if (this.index.files[fileId]) {
        const fileData = this.index.files[fileId];
        
        // Mark as deleted
        fileData.deletedAt = new Date().toISOString();
        fileData.deleteReason = 'manual_deletion';
        
        deleted.push({
          fileId: fileId,
          path: fileData.path,
          type: fileData.type,
          sentCount: fileData.sentCount || 0
        });
        
        console.error(`[CLAUDE-CACHE] Deleted file: ${fileData.path} (ID: ${fileId.substring(0, 8)}...)`);
      } else {
        notFound.push(fileId);
      }
    }
    
    if (deleted.length > 0) {
      await this.saveIndex();
      console.error(`[CLAUDE-CACHE] Deleted ${deleted.length} files from cache`);
    }
    
    if (notFound.length > 0) {
      console.error(`[CLAUDE-CACHE] Files not found: ${notFound.map(id => id.substring(0, 8)).join(', ')}`);
    }
    
    return { deleted, notFound };
  }
  
  /**
   * Delete files by path pattern
   */
  async deleteFilesByPattern(pattern) {
    const fileIds = [];
    
    for (const [fileId, fileData] of Object.entries(this.index.files)) {
      if (fileData.path && fileData.path.includes(pattern)) {
        fileIds.push(fileId);
      }
    }
    
    if (fileIds.length > 0) {
      console.error(`[CLAUDE-CACHE] Found ${fileIds.length} files matching pattern: ${pattern}`);
      return await this.deleteFilesByIds(fileIds);
    } else {
      console.error(`[CLAUDE-CACHE] No files found matching pattern: ${pattern}`);
      return { deleted: [], notFound: [] };
    }
  }
  
  /**
   * Clean old sessions from index
   */
  async cleanOldSessions(daysToKeep = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    
    let removed = 0;
    for (const [sessionId, session] of Object.entries(this.index.sessions)) {
      if (new Date(session.startTime) < cutoff) {
        delete this.index.sessions[sessionId];
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`Cleaned ${removed} old sessions`);
      await this.saveIndex();
    }
    
    return removed;
  }
}

// Export for use in workflows
module.exports = ClaudeCacheManager;

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node claude-cache-manager.js <command> [options]');
    console.log('Commands:');
    console.log('  cleanup <repo-path>     - Clean up stale cached files');
    console.log('  stats <repo-path>       - Show cache statistics');
    console.log('  track <repo-path>       - Track files being sent (reads from stdin)');
    console.log('  list <repo-path>        - List cached files');
    console.log('  delete-pattern <repo-path> <pattern> - Delete files matching pattern');
    console.log('  delete-ids <repo-path> <id1,id2,...> - Delete specific files by ID');
    console.log('  clean-sessions <repo-path> [days] - Clean old sessions');
    process.exit(1);
  }
  
  const command = args[0];
  const repoPath = args[1] || process.cwd();
  
  const manager = new ClaudeCacheManager(repoPath);
  
  (async () => {
    await manager.initialize();
    
    switch (command) {
      case 'cleanup':
        console.log('Checking for stale files...');
        const staleFiles = await manager.getStaleFiles();
        console.log(`Found ${staleFiles.length} stale files`);
        
        const cleaned = await manager.markForCleanup(staleFiles);
        const report = manager.generateCleanupReport(staleFiles, cleaned);
        console.log(JSON.stringify(report, null, 2));
        break;
        
      case 'stats':
        const stats = await manager.getCacheStats();
        console.log(JSON.stringify(stats, null, 2));
        break;
        
      case 'track':
        // Read files from stdin (JSON format)
        let input = '';
        process.stdin.setEncoding('utf8');
        
        for await (const chunk of process.stdin) {
          input += chunk;
        }
        
        if (input) {
          const data = JSON.parse(input);
          // Handle the structure from repo-context-v2.js
          let filesToTrack = [];
          
          if (Array.isArray(data)) {
            filesToTrack = data;
          } else if (data.files) {
            filesToTrack = data.files;
          } else if (data.textFiles || data.mediaFiles) {
            // Combine text and media files
            filesToTrack = [...(data.textFiles || []), ...(data.mediaFiles || [])];
          }
          
          const sessionId = await manager.trackFilesSent(filesToTrack);
          console.log(JSON.stringify({ 
            sessionId, 
            tracked: filesToTrack.length 
          }));
        }
        break;
        
      case 'list':
        const activeFiles = Object.entries(manager.index.files)
          .filter(([, file]) => !file.cleanedAt)
          .map(([hash, file]) => ({
            hash: hash.substring(0, 8),
            path: file.path,
            type: file.type,
            sentCount: file.sentCount,
            lastSent: file.lastSent
          }));
        console.log(JSON.stringify(activeFiles, null, 2));
        break;
        
      case 'delete-pattern':
        if (args.length < 3) {
          console.error('Please specify a pattern to match');
          process.exit(1);
        }
        const pattern = args[2];
        const deleteResult = await manager.deleteFilesByPattern(pattern);
        console.log(JSON.stringify(deleteResult, null, 2));
        break;
        
      case 'delete-ids':
        if (args.length < 3) {
          console.error('Please specify file IDs to delete (comma-separated)');
          process.exit(1);
        }
        const ids = args[2].split(',').map(id => id.trim());
        const deleteByIdResult = await manager.deleteFilesByIds(ids);
        console.log(JSON.stringify(deleteByIdResult, null, 2));
        break;
        
      case 'clean-sessions':
        const days = parseInt(args[2]) || 30;
        const removed = await manager.cleanOldSessions(days);
        console.log(`Cleaned ${removed} sessions older than ${days} days`);
        break;
        
      default:
        console.error('Unknown command:', command);
        process.exit(1);
    }
  })().catch(console.error);
}