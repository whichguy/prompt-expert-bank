/**
 * Structured Logger for GitHub Actions
 * Provides comprehensive logging with GitHub Actions integration
 */

const fs = require('fs');
const crypto = require('crypto');

class StructuredLogger {
  constructor(context) {
    this.context = context;
    this.correlationId = this.generateCorrelationId();
    this.logBuffer = [];
    this.startTime = Date.now();
    this.metrics = {
      toolsExecuted: 0,
      toolsSucceeded: 0,
      toolsFailed: 0,
      apiCalls: 0,
      gitOperations: 0
    };
  }

  generateCorrelationId() {
    return crypto.randomBytes(8).toString('hex');
  }

  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      level: level,
      message: message,
      context: {
        pr: this.context.pr,
        issue: this.context.issue,
        repository: this.context.repository,
        workflow: {
          runId: process.env.GITHUB_RUN_ID,
          runNumber: process.env.GITHUB_RUN_NUMBER,
          actor: process.env.GITHUB_ACTOR,
          job: process.env.GITHUB_JOB
        }
      },
      data: data
    };
    
    // Console output for GitHub Actions
    this.writeToConsole(level, message, entry);
    
    // Buffer for summary report
    this.logBuffer.push(entry);
    
    // Update metrics
    this.updateMetrics(level, message, data);
    
    // Alert on critical errors
    if (level === 'error' && data.critical) {
      this.createAnnotation(message, data);
    }
    
    return entry;
  }

  writeToConsole(level, message, entry) {
    const githubLevel = this.getGitHubLogLevel(level);
    
    // Format for GitHub Actions
    if (process.env.GITHUB_ACTIONS === 'true') {
      // Use GitHub Actions logging commands
      switch (githubLevel) {
        case 'error':
          console.log(`::error::${message}`);
          break;
        case 'warning':
          console.log(`::warning::${message}`);
          break;
        case 'notice':
          console.log(`::notice::${message}`);
          break;
        case 'debug':
          console.log(`::debug::${message}`);
          break;
        default:
          console.log(message);
      }
      
      // Also log the full entry as debug
      console.log(`::debug::${JSON.stringify(entry)}`);
    } else {
      // Standard console output for local testing
      const prefix = `[${level.toUpperCase()}] [${entry.correlationId}]`;
      console.log(`${prefix} ${message}`);
      if (Object.keys(entry.data).length > 0) {
        console.log(`${prefix} Data:`, JSON.stringify(entry.data, null, 2));
      }
    }
  }

  getGitHubLogLevel(level) {
    const mapping = {
      'error': 'error',
      'warn': 'warning',
      'info': 'notice',
      'debug': 'debug'
    };
    return mapping[level] || 'notice';
  }

  createAnnotation(message, data) {
    // GitHub Actions annotation format
    const file = data.file || '.github/scripts/claude-code-session.js';
    const line = data.line || 1;
    const col = data.col || 1;
    
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.log(
        `::error file=${file},line=${line},col=${col}::${message}`
      );
    }
  }

  updateMetrics(level, message, data) {
    // Track tool executions
    if (message.includes('Executing tool:')) {
      this.metrics.toolsExecuted++;
    } else if (message.includes('Tool execution completed:')) {
      if (data.success) {
        this.metrics.toolsSucceeded++;
      } else {
        this.metrics.toolsFailed++;
      }
    }
    
    // Track API calls
    if (message.includes('API call') || data.apiCall) {
      this.metrics.apiCalls++;
    }
    
    // Track git operations
    if (message.includes('git') || data.gitOperation) {
      this.metrics.gitOperations++;
    }
  }

  generateSummaryReport() {
    const duration = Date.now() - this.startTime;
    const errors = this.logBuffer.filter(e => e.level === 'error');
    const warnings = this.logBuffer.filter(e => e.level === 'warn');
    
    const summary = {
      correlationId: this.correlationId,
      duration: duration,
      toolsExecuted: this.metrics.toolsExecuted,
      toolsSucceeded: this.metrics.toolsSucceeded,
      toolsFailed: this.metrics.toolsFailed,
      apiCalls: this.metrics.apiCalls,
      gitOperations: this.metrics.gitOperations,
      errors: errors,
      warnings: warnings,
      metrics: this.metrics
    };
    
    // Write to GitHub Actions summary if available
    this.writeGitHubSummary(summary);
    
    return summary;
  }

  writeGitHubSummary(summary) {
    if (process.env.GITHUB_ACTIONS !== 'true') return;
    
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;
    
    const markdown = this.formatSummaryMarkdown(summary);
    
    try {
      fs.appendFileSync(summaryPath, markdown);
      this.log('info', 'GitHub Actions summary written');
    } catch (error) {
      this.log('warn', 'Failed to write GitHub Actions summary', { 
        error: error.message 
      });
    }
  }

  formatSummaryMarkdown(summary) {
    const successRate = summary.toolsExecuted > 0 
      ? ((summary.toolsSucceeded / summary.toolsExecuted) * 100).toFixed(1)
      : 0;
    
    let markdown = `
## 🤖 Claude Code Session Summary

**Session ID**: \`${summary.correlationId}\`
**Duration**: ${this.formatDuration(summary.duration)}
**Success Rate**: ${successRate}%

### 📊 Metrics
| Metric | Value |
|--------|-------|
| Tools Executed | ${summary.toolsExecuted} |
| Tools Succeeded | ${summary.toolsSucceeded} |
| Tools Failed | ${summary.toolsFailed} |
| API Calls | ${summary.apiCalls} |
| Git Operations | ${summary.gitOperations} |
`;

    if (summary.errors.length > 0) {
      markdown += `
### ⚠️ Errors (${summary.errors.length})
`;
      summary.errors.slice(0, 5).forEach(error => {
        markdown += `- **${error.message}** at ${error.timestamp}\n`;
        if (error.data.error) {
          markdown += `  - Details: \`${error.data.error}\`\n`;
        }
      });
      
      if (summary.errors.length > 5) {
        markdown += `\n_...and ${summary.errors.length - 5} more errors_\n`;
      }
    }

    if (summary.warnings.length > 0) {
      markdown += `
### ⚡ Warnings (${summary.warnings.length})
`;
      summary.warnings.slice(0, 5).forEach(warning => {
        markdown += `- ${warning.message}\n`;
      });
      
      if (summary.warnings.length > 5) {
        markdown += `\n_...and ${summary.warnings.length - 5} more warnings_\n`;
      }
    }

    markdown += `
---
_Generated by Claude Code Integration System_
`;

    return markdown;
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  // Create a child logger with additional context
  child(additionalContext) {
    const childLogger = Object.create(this);
    childLogger.context = { ...this.context, ...additionalContext };
    return childLogger;
  }
}

// Metrics collector helper class
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
  }

  startTimer(name) {
    this.timers.set(name, Date.now());
  }

  endTimer(name) {
    const start = this.timers.get(name);
    if (!start) return 0;
    
    const duration = Date.now() - start;
    this.timers.delete(name);
    
    // Store in metrics
    const existing = this.metrics.get(`timer_${name}`) || [];
    existing.push(duration);
    this.metrics.set(`timer_${name}`, existing);
    
    return duration;
  }

  increment(name, value = 1) {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }

  set(name, value) {
    this.metrics.set(name, value);
  }

  current() {
    const result = {};
    for (const [key, value] of this.metrics) {
      result[key] = value;
    }
    return result;
  }

  summary() {
    const result = {};
    
    for (const [key, value] of this.metrics) {
      if (key.startsWith('timer_')) {
        // Calculate timer statistics
        const times = value;
        result[key] = {
          count: times.length,
          total: times.reduce((a, b) => a + b, 0),
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times)
        };
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  totalDuration() {
    let total = 0;
    for (const [key, value] of this.metrics) {
      if (key.startsWith('timer_')) {
        total += value.reduce((a, b) => a + b, 0);
      }
    }
    return total;
  }

  toolCount() {
    return this.metrics.get('tools_executed') || 0;
  }
}

module.exports = { StructuredLogger, MetricsCollector };