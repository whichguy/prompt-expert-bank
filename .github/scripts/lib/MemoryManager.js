/**
 * Memory Manager for Claude Code Integration
 * Prevents memory leaks and manages resource limits
 */

class MemoryManager {
  constructor(options = {}) {
    this.maxMessageSize = options.maxMessageSize || 50 * 1024 * 1024; // 50MB
    this.maxMessagesCount = options.maxMessagesCount || 100;
    this.maxSnapshotCount = options.maxSnapshotCount || 20;
    this.maxCacheSize = options.maxCacheSize || 100 * 1024 * 1024; // 100MB
    this.logger = options.logger || console;
    
    // Track memory usage
    this.memoryCheckInterval = null;
    this.memoryThreshold = options.memoryThreshold || 0.8; // 80% of heap
    this.lastGC = Date.now();
    this.gcInterval = options.gcInterval || 60000; // 1 minute
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Check current memory usage
   */
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsedPercent = usage.heapUsed / usage.heapTotal;
    
    if (heapUsedPercent > this.memoryThreshold) {
      this.logger.log('warn', `High memory usage detected: ${(heapUsedPercent * 100).toFixed(1)}%`, {
        heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`
      });
      
      // Trigger garbage collection if available
      this.forceGarbageCollection();
    }
    
    return {
      heapUsedPercent,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external
    };
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection() {
    if (global.gc && Date.now() - this.lastGC > this.gcInterval) {
      this.logger.log('info', 'Forcing garbage collection');
      global.gc();
      this.lastGC = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Trim message array to prevent unbounded growth
   */
  trimMessages(messages, maxSize = null) {
    const limit = maxSize || this.maxMessagesCount;
    
    if (messages.length <= limit) {
      return messages;
    }
    
    // Keep first message (system) and last N messages
    const trimmed = [
      messages[0], // Keep system/initial message
      ...messages.slice(-(limit - 1))
    ];
    
    this.logger.log('info', `Trimmed messages from ${messages.length} to ${trimmed.length}`);
    
    return trimmed;
  }

  /**
   * Summarize old messages to reduce size
   */
  async summarizeMessages(messages, anthropic) {
    if (messages.length <= 10) {
      return messages;
    }
    
    try {
      // Take middle messages to summarize
      const toSummarize = messages.slice(1, -5); // Keep first and last 5
      
      const summaryRequest = `Summarize these conversation messages concisely, preserving key tool calls and results:\n\n${
        JSON.stringify(toSummarize, null, 2).substring(0, 10000)
      }`;
      
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Use faster model for summarization
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: summaryRequest
          }
        ]
      });
      
      const summary = response.content[0].text;
      
      // Reconstruct messages with summary
      const summarized = [
        messages[0], // Keep initial message
        {
          role: 'assistant',
          content: `[Previous conversation summary: ${summary}]`
        },
        ...messages.slice(-5) // Keep last 5 messages
      ];
      
      this.logger.log('info', `Summarized ${messages.length} messages to ${summarized.length}`);
      
      return summarized;
    } catch (error) {
      this.logger.log('error', 'Failed to summarize messages', { error: error.message });
      // Fall back to simple trimming
      return this.trimMessages(messages);
    }
  }

  /**
   * Limit array size with FIFO eviction
   */
  limitArraySize(array, maxSize, label = 'array') {
    if (array.length <= maxSize) {
      return array;
    }
    
    const removed = array.length - maxSize;
    const limited = array.slice(-maxSize);
    
    this.logger.log('debug', `Limited ${label} from ${array.length} to ${maxSize} items (removed ${removed})`);
    
    return limited;
  }

  /**
   * Calculate size of object in bytes
   */
  getObjectSize(obj) {
    const str = JSON.stringify(obj);
    return Buffer.byteLength(str, 'utf8');
  }

  /**
   * Check if object exceeds size limit
   */
  checkSizeLimit(obj, limit = null) {
    const maxSize = limit || this.maxMessageSize;
    const size = this.getObjectSize(obj);
    
    if (size > maxSize) {
      this.logger.log('warn', `Object exceeds size limit`, {
        size: `${(size / 1024 / 1024).toFixed(2)}MB`,
        limit: `${(maxSize / 1024 / 1024).toFixed(2)}MB`
      });
      return false;
    }
    
    return true;
  }

  /**
   * Safe JSON stringify with circular reference handling
   */
  safeStringify(obj, space = 2) {
    const seen = new WeakSet();
    
    try {
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        
        // Limit string length
        if (typeof value === 'string' && value.length > 10000) {
          return value.substring(0, 10000) + '... [truncated]';
        }
        
        // Limit array size
        if (Array.isArray(value) && value.length > 100) {
          return [...value.slice(0, 100), '... [truncated]'];
        }
        
        return value;
      }, space);
    } catch (error) {
      this.logger.log('error', 'Failed to stringify object', { error: error.message });
      return '{"error": "Failed to serialize object"}';
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopMonitoring();
    
    // Clear any large data structures
    if (global.gc) {
      global.gc();
    }
    
    const usage = process.memoryUsage();
    this.logger.log('info', 'Memory manager cleanup completed', {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`
    });
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const usage = process.memoryUsage();
    
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      heapUsedPercent: (usage.heapUsed / usage.heapTotal * 100).toFixed(1),
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0,
      heapUsedMB: (usage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (usage.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: (usage.rss / 1024 / 1024).toFixed(2)
    };
  }
}

module.exports = { MemoryManager };