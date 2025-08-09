/**
 * Performance Monitor for Claude Code Integration
 * Tracks execution times, resource usage, and provides optimization suggestions
 */

const fs = require('fs').promises;
const { performance } = require('perf_hooks');

class PerformanceMonitor {
  constructor(options = {}) {
    this.sessionId = options.sessionId || `session-${Date.now()}`;
    this.logger = options.logger || console;
    this.thresholds = {
      slowOperation: options.slowOperationThreshold || 5000, // 5 seconds
      criticalMemory: options.criticalMemoryThreshold || 500 * 1024 * 1024, // 500MB
      highCpuUsage: options.highCpuUsageThreshold || 80 // 80%
    };
    
    // Metrics storage
    this.metrics = {
      operations: [],
      checkpoints: [],
      resourceSnapshots: [],
      errors: [],
      warnings: []
    };
    
    this.startTime = Date.now();
    this.startMark = performance.now();
    
    // Capture initial resource state
    this.captureResourceSnapshot('session_start');
    
    this.logger.log('info', '📊 Performance monitoring initialized', {
      sessionId: this.sessionId,
      thresholds: this.thresholds
    });
  }

  /**
   * Start timing an operation
   */
  startOperation(name, metadata = {}) {
    const operationId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const mark = performance.now();
    
    const operation = {
      id: operationId,
      name,
      startTime: Date.now(),
      startMark: mark,
      metadata,
      status: 'running'
    };
    
    this.metrics.operations.push(operation);
    
    this.logger.log('debug', `⏱️ Started operation: ${name}`, {
      operationId,
      metadata
    });
    
    return operationId;
  }

  /**
   * End timing an operation
   */
  endOperation(operationId, result = {}) {
    const operation = this.metrics.operations.find(op => op.id === operationId);
    
    if (!operation) {
      this.logger.log('warn', `Operation not found: ${operationId}`);
      return;
    }
    
    const endMark = performance.now();
    const duration = endMark - operation.startMark;
    
    operation.endTime = Date.now();
    operation.endMark = endMark;
    operation.duration = duration;
    operation.status = result.success !== false ? 'completed' : 'failed';
    operation.result = result;
    
    // Check if operation was slow
    if (duration > this.thresholds.slowOperation) {
      const warning = `Slow operation detected: ${operation.name} took ${duration.toFixed(2)}ms`;
      this.metrics.warnings.push({
        type: 'slow_operation',
        message: warning,
        operation: operation.name,
        duration,
        timestamp: Date.now()
      });
      
      this.logger.log('warn', `🐌 ${warning}`, {
        operationId,
        expected: this.thresholds.slowOperation,
        actual: duration
      });
    } else {
      this.logger.log('debug', `✅ Operation completed: ${operation.name}`, {
        operationId,
        duration: `${duration.toFixed(2)}ms`
      });
    }
    
    return {
      duration,
      status: operation.status
    };
  }

  /**
   * Add a checkpoint for tracking progress
   */
  checkpoint(name, metadata = {}) {
    const mark = performance.now();
    const elapsed = mark - this.startMark;
    
    // FIX: Handle duplicate checkpoint names
    const existingIndex = this.metrics.checkpoints.findIndex(cp => cp.name === name);
    
    const checkpoint = {
      name,
      timestamp: Date.now(),
      mark,
      elapsed,
      metadata,
      count: existingIndex >= 0 ? (this.metrics.checkpoints[existingIndex].count || 1) + 1 : 1
    };
    
    if (existingIndex >= 0) {
      // Update existing checkpoint with latest data
      this.metrics.checkpoints[existingIndex] = checkpoint;
    } else {
      this.metrics.checkpoints.push(checkpoint);
    }
    
    this.logger.log('info', `📍 Checkpoint: ${name}`, {
      elapsed: `${elapsed.toFixed(2)}ms`,
      metadata
    });
    
    return checkpoint;
  }

  /**
   * Capture resource usage snapshot
   */
  captureResourceSnapshot(label = 'snapshot') {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const snapshot = {
      label,
      timestamp: Date.now(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
    
    this.metrics.resourceSnapshots.push(snapshot);
    
    // Check for high memory usage
    if (memoryUsage.heapUsed > this.thresholds.criticalMemory) {
      const warning = `High memory usage: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`;
      this.metrics.warnings.push({
        type: 'high_memory',
        message: warning,
        value: memoryUsage.heapUsed,
        timestamp: Date.now()
      });
      
      this.logger.log('warn', `⚠️ ${warning}`, {
        threshold: this.thresholds.criticalMemory,
        actual: memoryUsage.heapUsed
      });
    }
    
    return snapshot;
  }

  /**
   * Track an error
   */
  trackError(error, context = {}) {
    const errorEntry = {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      context,
      timestamp: Date.now()
    };
    
    this.metrics.errors.push(errorEntry);
    
    this.logger.log('error', `❌ Error tracked: ${error.message}`, {
      type: error.constructor.name,
      context
    });
  }

  /**
   * Track a custom metric
   */
  trackMetric(name, value, unit = '', metadata = {}) {
    const metric = {
      name,
      value,
      unit,
      metadata,
      timestamp: Date.now()
    };
    
    if (!this.metrics.custom) {
      this.metrics.custom = [];
    }
    
    this.metrics.custom.push(metric);
    
    this.logger.log('debug', `📈 Metric tracked: ${name}`, {
      value: `${value}${unit}`,
      metadata
    });
  }

  /**
   * Measure async function execution
   */
  async measure(name, asyncFunc, metadata = {}) {
    const operationId = this.startOperation(name, metadata);
    
    try {
      const result = await asyncFunc();
      this.endOperation(operationId, { success: true });
      return result;
    } catch (error) {
      this.endOperation(operationId, { success: false, error: error.message });
      this.trackError(error, { operation: name });
      throw error;
    }
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    // Calculate operation statistics
    const completedOps = this.metrics.operations.filter(op => op.status === 'completed');
    const failedOps = this.metrics.operations.filter(op => op.status === 'failed');
    
    const opStats = {
      total: this.metrics.operations.length,
      completed: completedOps.length,
      failed: failedOps.length,
      successRate: completedOps.length / Math.max(1, this.metrics.operations.length) * 100,
      // FIX: Properly handle division by zero with conditional check
      averageDuration: completedOps.length > 0 
        ? completedOps.reduce((sum, op) => sum + (op.duration || 0), 0) / completedOps.length
        : 0,
      slowest: completedOps.reduce((max, op) => 
        (op.duration || 0) > (max.duration || 0) ? op : max, { duration: 0 }
      ),
      fastest: completedOps.reduce((min, op) => 
        op.duration && (!min.duration || op.duration < min.duration) ? op : min, { duration: Infinity }
      )
    };
    
    // Calculate resource usage
    const resourceStats = this.analyzeResourceUsage();
    
    // Generate optimization suggestions
    const suggestions = this.generateOptimizationSuggestions(opStats, resourceStats);
    
    const report = {
      sessionId: this.sessionId,
      duration: totalDuration,
      startTime: this.startTime,
      endTime,
      operations: opStats,
      resources: resourceStats,
      errors: {
        count: this.metrics.errors.length,
        types: this.groupByType(this.metrics.errors)
      },
      warnings: {
        count: this.metrics.warnings.length,
        types: this.groupByType(this.metrics.warnings)
      },
      checkpoints: this.metrics.checkpoints.map(cp => ({
        name: cp.name,
        elapsed: cp.elapsed,
        metadata: cp.metadata
      })),
      suggestions,
      custom: this.metrics.custom || []
    };
    
    return report;
  }

  /**
   * Analyze resource usage trends
   */
  analyzeResourceUsage() {
    if (this.metrics.resourceSnapshots.length < 2) {
      return {
        memory: { trend: 'insufficient_data' },
        cpu: { trend: 'insufficient_data' }
      };
    }
    
    const first = this.metrics.resourceSnapshots[0];
    const last = this.metrics.resourceSnapshots[this.metrics.resourceSnapshots.length - 1];
    
    const memoryGrowth = last.memory.heapUsed - first.memory.heapUsed;
    const memoryGrowthPercent = (memoryGrowth / first.memory.heapUsed) * 100;
    
    const cpuUserGrowth = last.cpu.user - first.cpu.user;
    const cpuSystemGrowth = last.cpu.system - first.cpu.system;
    
    return {
      memory: {
        initial: first.memory.heapUsed,
        final: last.memory.heapUsed,
        growth: memoryGrowth,
        growthPercent: memoryGrowthPercent,
        peak: Math.max(...this.metrics.resourceSnapshots.map(s => s.memory.heapUsed)),
        trend: memoryGrowthPercent > 50 ? 'increasing' : memoryGrowthPercent < -20 ? 'decreasing' : 'stable'
      },
      cpu: {
        userTime: cpuUserGrowth,
        systemTime: cpuSystemGrowth,
        totalTime: cpuUserGrowth + cpuSystemGrowth
      }
    };
  }

  /**
   * Generate optimization suggestions
   */
  generateOptimizationSuggestions(opStats, resourceStats) {
    const suggestions = [];
    
    // Check for slow operations
    if (opStats.averageDuration > 3000) {
      suggestions.push({
        type: 'performance',
        priority: 'high',
        message: `Average operation time is ${opStats.averageDuration.toFixed(0)}ms. Consider optimizing slow operations.`,
        operations: this.metrics.operations
          .filter(op => op.duration > this.thresholds.slowOperation)
          .map(op => op.name)
      });
    }
    
    // Check for high failure rate
    if (opStats.successRate < 90) {
      suggestions.push({
        type: 'reliability',
        priority: 'critical',
        message: `Success rate is only ${opStats.successRate.toFixed(1)}%. Investigate failing operations.`,
        failedOperations: failedOps.map(op => ({
          name: op.name,
          error: op.result?.error
        }))
      });
    }
    
    // Check for memory issues
    if (resourceStats.memory.growthPercent > 100) {
      suggestions.push({
        type: 'memory',
        priority: 'high',
        message: `Memory usage increased by ${resourceStats.memory.growthPercent.toFixed(1)}%. Check for memory leaks.`,
        details: {
          initial: `${(resourceStats.memory.initial / 1024 / 1024).toFixed(2)}MB`,
          final: `${(resourceStats.memory.final / 1024 / 1024).toFixed(2)}MB`
        }
      });
    }
    
    // Check for repeated errors
    const errorGroups = this.groupByType(this.metrics.errors);
    for (const [type, errors] of Object.entries(errorGroups)) {
      if (errors.length > 2) {
        suggestions.push({
          type: 'error_pattern',
          priority: 'medium',
          message: `Repeated ${type} errors detected (${errors.length} occurrences)`,
          sample: errors[0].message
        });
      }
    }
    
    // Suggest caching for repeated operations
    const opCounts = {};
    this.metrics.operations.forEach(op => {
      opCounts[op.name] = (opCounts[op.name] || 0) + 1;
    });
    
    for (const [name, count] of Object.entries(opCounts)) {
      if (count > 5) {
        suggestions.push({
          type: 'caching',
          priority: 'low',
          message: `Operation '${name}' executed ${count} times. Consider caching results.`
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Group items by type
   */
  groupByType(items) {
    const groups = {};
    
    items.forEach(item => {
      const type = item.type || 'unknown';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(item);
    });
    
    return groups;
  }

  /**
   * Write performance report to GitHub Actions summary
   */
  async writeToGitHubSummary(report) {
    if (!process.env.GITHUB_STEP_SUMMARY) {
      this.logger.log('debug', 'Not in GitHub Actions environment, skipping summary');
      return;
    }
    
    const summary = this.formatReportAsMarkdown(report);
    
    try {
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
      this.logger.log('info', '📝 Performance report written to GitHub Actions summary');
    } catch (error) {
      this.logger.log('error', 'Failed to write GitHub Actions summary', {
        error: error.message
      });
    }
  }

  /**
   * Format report as markdown
   */
  formatReportAsMarkdown(report) {
    const duration = (report.duration / 1000).toFixed(2);
    const successRate = report.operations.successRate.toFixed(1);
    
    let markdown = `
## 📊 Performance Report

**Session ID**: ${report.sessionId}
**Duration**: ${duration}s
**Success Rate**: ${successRate}%

### Operations Summary
- Total: ${report.operations.total}
- Completed: ${report.operations.completed}
- Failed: ${report.operations.failed}
- Average Duration: ${report.operations.averageDuration.toFixed(0)}ms
`;

    if (report.operations.slowest.name) {
      markdown += `- Slowest: ${report.operations.slowest.name} (${report.operations.slowest.duration.toFixed(0)}ms)\n`;
    }

    if (report.resources.memory.trend !== 'insufficient_data') {
      markdown += `
### Resource Usage
- Memory Growth: ${report.resources.memory.growthPercent.toFixed(1)}%
- Memory Peak: ${(report.resources.memory.peak / 1024 / 1024).toFixed(2)}MB
- CPU Time: ${(report.resources.cpu.totalTime / 1000).toFixed(2)}s
`;
    }

    if (report.errors.count > 0) {
      markdown += `
### ⚠️ Errors (${report.errors.count})
`;
      for (const [type, errors] of Object.entries(report.errors.types)) {
        markdown += `- ${type}: ${errors.length} occurrences\n`;
      }
    }

    if (report.suggestions.length > 0) {
      markdown += `
### 💡 Optimization Suggestions
`;
      report.suggestions.forEach(suggestion => {
        const icon = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢'
        }[suggestion.priority] || '⚪';
        
        markdown += `${icon} **${suggestion.priority.toUpperCase()}**: ${suggestion.message}\n`;
      });
    }

    if (report.checkpoints.length > 0) {
      markdown += `
### 📍 Checkpoints
`;
      report.checkpoints.forEach(cp => {
        markdown += `- ${cp.name}: ${(cp.elapsed / 1000).toFixed(2)}s\n`;
      });
    }

    return markdown;
  }

  /**
   * Export metrics to JSON file
   */
  async exportMetrics(filepath) {
    const report = this.generateReport();
    
    try {
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      this.logger.log('info', `📁 Metrics exported to ${filepath}`);
      return true;
    } catch (error) {
      this.logger.log('error', 'Failed to export metrics', {
        filepath,
        error: error.message
      });
      return false;
    }
  }
}

module.exports = { PerformanceMonitor };