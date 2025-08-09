/**
 * Simple Performance Monitor
 * Reduced to essential metrics only
 */

class SimplePerformanceMonitor {
  constructor(options = {}) {
    this.sessionId = options.sessionId || `session-${Date.now()}`;
    this.startTime = Date.now();
    
    // Basic counters only
    this.metrics = {
      total: 0,
      successful: 0,
      errors: 0,
      totalDuration: 0
    };
  }

  /**
   * Time an operation
   */
  async measure(name, asyncFunc) {
    const start = Date.now();
    this.metrics.total++;
    
    try {
      const result = await asyncFunc();
      const duration = Date.now() - start;
      
      this.metrics.successful++;
      this.metrics.totalDuration += duration;
      
      if (duration > 5000) {
        console.warn(`Slow operation: ${name} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.metrics.errors++;
      this.metrics.totalDuration += duration;
      throw error;
    }
  }


  /**
   * Get basic report
   */
  getReport() {
    const sessionDuration = Date.now() - this.startTime;
    const { total, successful, errors, totalDuration } = this.metrics;
    
    return {
      sessionId: this.sessionId,
      duration: sessionDuration,
      operations: {
        total,
        successful,
        failed: errors,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 100
      },
      avgOperationTime: total > 0 ? Math.round(totalDuration / total) : 0
    };
  }

  /**
   * Format report as simple text
   */
  formatReport() {
    const report = this.getReport();
    return `
Performance Summary:
- Duration: ${(report.duration / 1000).toFixed(2)}s
- Operations: ${report.operations.successful}/${report.operations.total} successful (${report.operations.successRate}%)
- Avg Operation Time: ${report.avgOperationTime}ms
- Errors: ${report.errors}
    `.trim();
  }
}

module.exports = { SimplePerformanceMonitor };