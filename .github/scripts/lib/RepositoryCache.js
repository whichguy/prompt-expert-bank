/**
 * Repository Cache for Optimized File Operations
 * Caches repository state to reduce redundant API calls
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class RepositoryCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || process.env.CACHE_DIR || '/tmp/claude-cache';
    this.ttl = options.ttl || 300000; // 5 minutes default TTL
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB max cache size
    this.logger = options.logger || console;
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0
    };
  }

  /**
   * Initialize cache directory
   */
  async init() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.cleanupOldCache();
      
      this.logger.log('info', `Repository cache initialized at ${this.cacheDir}`);
      return true;
    } catch (error) {
      this.logger.log('error', 'Failed to initialize cache', { error: error.message });
      return false;
    }
  }

  /**
   * Generate cache key from context
   */
  getCacheKey(context) {
    const keyData = {
      repository: context.repository?.fullName || context.repository,
      sha: context.sha || context.pr?.branch?.headSha || context.ref || 'main',
      type: context.type || 'unknown'
      // FIX: Removed timestamp from key - it defeats SHA-based caching
    };
    
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(keyData));
    return hash.digest('hex').substring(0, 16); // Use first 16 chars for shorter filenames
  }

  /**
   * Get item from cache
   */
  async get(key, options = {}) {
    const { parseJson = true, checkTTL = true } = options;
    
    try {
      const cachePath = path.join(this.cacheDir, `${key}.cache`);
      const metaPath = path.join(this.cacheDir, `${key}.meta`);
      
      // Check if cache files exist
      const [cacheExists, metaExists] = await Promise.all([
        this.fileExists(cachePath),
        this.fileExists(metaPath)
      ]);
      
      if (!cacheExists || !metaExists) {
        this.stats.misses++;
        return null;
      }
      
      // Read metadata
      const metaData = await fs.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaData);
      
      // Check TTL if required
      // FIX: Check against item's specific TTL first, then fallback to default
      if (checkTTL && Date.now() - meta.timestamp > (meta.ttl || this.ttl)) {
        this.logger.log('debug', `Cache expired for key ${key}`);
        this.stats.misses++;
        await this.delete(key);
        return null;
      }
      
      // Read cached data
      const data = await fs.readFile(cachePath, 'utf8');
      
      this.stats.hits++;
      this.logger.log('debug', `Cache hit for key ${key}`, {
        size: meta.size,
        age: Date.now() - meta.timestamp
      });
      
      return parseJson ? JSON.parse(data) : data;
    } catch (error) {
      this.logger.log('warn', `Cache read error for key ${key}`, { error: error.message });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set item in cache
   */
  async set(key, data, options = {}) {
    const { ttl = this.ttl, metadata = {} } = options;
    
    try {
      const cachePath = path.join(this.cacheDir, `${key}.cache`);
      const metaPath = path.join(this.cacheDir, `${key}.meta`);
      
      // Prepare data
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      const dataSize = Buffer.byteLength(dataStr);
      
      // Check size limit
      if (dataSize > this.maxSize) {
        this.logger.log('warn', `Data too large for cache: ${dataSize} bytes`);
        return false;
      }
      
      // Check total cache size and evict if necessary
      const totalSize = await this.getTotalCacheSize();
      if (totalSize + dataSize > this.maxSize) {
        await this.evictOldest(dataSize);
      }
      
      // Write metadata
      const meta = {
        key,
        timestamp: Date.now(),
        ttl,
        size: dataSize,
        ...metadata
      };
      
      await fs.writeFile(metaPath, JSON.stringify(meta));
      await fs.writeFile(cachePath, dataStr);
      
      this.stats.writes++;
      this.logger.log('debug', `Cache set for key ${key}`, { size: dataSize });
      
      return true;
    } catch (error) {
      this.logger.log('error', `Cache write error for key ${key}`, { error: error.message });
      return false;
    }
  }

  /**
   * Delete item from cache
   */
  async delete(key) {
    try {
      const cachePath = path.join(this.cacheDir, `${key}.cache`);
      const metaPath = path.join(this.cacheDir, `${key}.meta`);
      
      await Promise.all([
        fs.unlink(cachePath).catch(() => {}),
        fs.unlink(metaPath).catch(() => {})
      ]);
      
      return true;
    } catch (error) {
      this.logger.log('warn', `Failed to delete cache key ${key}`, { error: error.message });
      return false;
    }
  }

  /**
   * Clear entire cache
   */
  async clear() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const deletePromises = files
        .filter(f => f.endsWith('.cache') || f.endsWith('.meta'))
        .map(f => fs.unlink(path.join(this.cacheDir, f)).catch(() => {}));
      
      await Promise.all(deletePromises);
      
      this.stats = {
        hits: 0,
        misses: 0,
        writes: 0,
        evictions: 0
      };
      
      this.logger.log('info', 'Cache cleared');
      return true;
    } catch (error) {
      this.logger.log('error', 'Failed to clear cache', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      totalRequests: this.stats.hits + this.stats.misses
    };
  }

  /**
   * Cache repository files
   */
  async cacheRepositoryFiles(context, files) {
    const cacheKey = `${this.getCacheKey(context)}-files`;
    const fileMap = {};
    
    for (const file of files) {
      fileMap[file.path] = {
        content: file.content,
        size: file.size,
        sha: file.sha,
        encoding: file.encoding
      };
    }
    
    return this.set(cacheKey, fileMap, {
      metadata: {
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0)
      }
    });
  }

  /**
   * Get cached repository files
   */
  async getCachedRepositoryFiles(context) {
    const cacheKey = `${this.getCacheKey(context)}-files`;
    return this.get(cacheKey);
  }

  /**
   * Cache PR/Issue data
   */
  async cacheContextData(context) {
    const cacheKey = `${this.getCacheKey(context)}-context`;
    
    const contextData = {
      pr: context.pr,
      issue: context.issue,
      repository: context.repository,
      files: context.files,
      timestamp: Date.now()
    };
    
    return this.set(cacheKey, contextData, {
      ttl: 600000, // 10 minutes for context data
      metadata: {
        type: context.type,
        number: context.pr?.number || context.issue?.number
      }
    });
  }

  /**
   * Get cached context data
   */
  async getCachedContextData(context) {
    const cacheKey = `${this.getCacheKey(context)}-context`;
    return this.get(cacheKey);
  }

  /**
   * Cache API response
   */
  async cacheAPIResponse(endpoint, response, ttl = 60000) {
    const hash = crypto.createHash('md5').update(endpoint).digest('hex').substring(0, 8);
    const cacheKey = `api-${hash}`;
    
    return this.set(cacheKey, response, {
      ttl,
      metadata: {
        endpoint,
        cached: new Date().toISOString()
      }
    });
  }

  /**
   * Get cached API response
   */
  async getCachedAPIResponse(endpoint) {
    const hash = crypto.createHash('md5').update(endpoint).digest('hex').substring(0, 8);
    const cacheKey = `api-${hash}`;
    
    return this.get(cacheKey);
  }

  // Private helper methods

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getTotalCacheSize() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          try {
            // FIX: Handle file deletion race condition
            const stats = await fs.stat(path.join(this.cacheDir, file));
            totalSize += stats.size;
          } catch (err) {
            if (err.code !== 'ENOENT') {
              throw err; // Re-throw non-ENOENT errors
            }
            // File was deleted, continue
          }
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }

  async evictOldest(requiredSpace) {
    try {
      const files = await fs.readdir(this.cacheDir);
      const metaFiles = files.filter(f => f.endsWith('.meta'));
      
      // Get all metadata with timestamps
      const entries = [];
      for (const metaFile of metaFiles) {
        try {
          const metaPath = path.join(this.cacheDir, metaFile);
          const metaData = await fs.readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaData);
          entries.push({
            key: meta.key,
            timestamp: meta.timestamp,
            size: meta.size
          });
        } catch (err) {
          // FIX: Log errors for debugging
          this.logger.log('debug', 'Skipping invalid metadata file', { 
            file: metaFile, 
            error: err.message 
          });
        }
      }
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);
      
      // FIX: Add maximum eviction attempts to prevent infinite loop
      const maxAttempts = Math.min(entries.length, 10);
      let freedSpace = 0;
      let attempts = 0;
      
      for (const entry of entries) {
        if (freedSpace >= requiredSpace || attempts >= maxAttempts) break;
        
        await this.delete(entry.key);
        freedSpace += entry.size;
        this.stats.evictions++;
        attempts++;
        
        this.logger.log('debug', `Evicted cache entry ${entry.key} (${entry.size} bytes)`);
      }
    } catch (error) {
      this.logger.log('warn', 'Failed to evict cache entries', { error: error.message });
    }
  }

  async cleanupOldCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      let cleaned = 0;
      
      for (const file of files) {
        if (file.endsWith('.meta')) {
          try {
            const metaPath = path.join(this.cacheDir, file);
            const metaData = await fs.readFile(metaPath, 'utf8');
            const meta = JSON.parse(metaData);
            
            // Remove entries older than 1 hour
            if (now - meta.timestamp > 3600000) {
              const key = file.replace('.meta', '');
              await this.delete(key);
              cleaned++;
            }
          } catch (err) {
            // FIX: Log corruption for debugging
            this.logger.log('debug', 'Removing corrupted metadata file', {
              file,
              error: err.message
            });
            // Remove corrupted metadata files
            await fs.unlink(path.join(this.cacheDir, file)).catch(() => {});
          }
        }
      }
      
      if (cleaned > 0) {
        this.logger.log('info', `Cleaned up ${cleaned} old cache entries`);
      }
    } catch (error) {
      this.logger.log('warn', 'Cache cleanup failed', { error: error.message });
    }
  }
}

module.exports = { RepositoryCache };