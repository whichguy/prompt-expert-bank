#!/usr/bin/env node

/**
 * Production Readiness Check for Prompt Expert Integration
 * Comprehensive evaluation of all Claude API tooling
 */

const { HealthCheck } = require('./lib/HealthCheck');
const { PerformanceMonitor } = require('./lib/PerformanceMonitor');
const { StructuredLogger } = require('./lib/StructuredLogger');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ProductionReadinessCheck {
  constructor() {
    this.logger = new StructuredLogger({
      correlationId: `readiness-${Date.now()}`
    });
    
    this.results = {
      timestamp: new Date().toISOString(),
      isReady: false,
      score: 0,
      categories: {},
      criticalIssues: [],
      warnings: [],
      recommendations: []
    };
    
    this.weights = {
      healthCheck: 0.25,
      security: 0.20,
      errorHandling: 0.20,
      performance: 0.15,
      monitoring: 0.10,
      documentation: 0.10
    };
  }

  /**
   * Run comprehensive production readiness evaluation
   */
  async evaluate() {
    console.log('🚀 Starting Production Readiness Evaluation...\n');
    
    try {
      // Run all evaluations
      const [
        healthScore,
        securityScore,
        errorHandlingScore,
        performanceScore,
        monitoringScore,
        documentationScore
      ] = await Promise.all([
        this.evaluateHealth(),
        this.evaluateSecurity(),
        this.evaluateErrorHandling(),
        this.evaluatePerformance(),
        this.evaluateMonitoring(),
        this.evaluateDocumentation()
      ]);
      
      // Calculate weighted score
      this.results.score = Math.round(
        healthScore * this.weights.healthCheck +
        securityScore * this.weights.security +
        errorHandlingScore * this.weights.errorHandling +
        performanceScore * this.weights.performance +
        monitoringScore * this.weights.monitoring +
        documentationScore * this.weights.documentation
      );
      
      // Determine readiness
      this.results.isReady = 
        this.results.score >= 80 && 
        this.results.criticalIssues.length === 0;
      
      // Generate final report
      await this.generateReport();
      
      return this.results;
      
    } catch (error) {
      this.logger.log('error', 'Production readiness check failed', {
        error: error.message
      });
      
      this.results.criticalIssues.push({
        category: 'system',
        message: `Evaluation failed: ${error.message}`
      });
      
      return this.results;
    }
  }

  /**
   * Evaluate system health
   */
  async evaluateHealth() {
    console.log('🏥 Evaluating System Health...');
    
    const healthCheck = new HealthCheck({ logger: this.logger });
    const healthResults = await healthCheck.runAll();
    
    let score = 100;
    const issues = [];
    
    // Deduct points for errors and warnings
    score -= healthResults.errors.length * 10;
    score -= healthResults.warnings.length * 3;
    
    // Check specific requirements
    if (!healthResults.checks.environment?.passed?.find(e => e.name === 'GITHUB_TOKEN')) {
      issues.push('Missing GITHUB_TOKEN');
      this.results.criticalIssues.push({
        category: 'health',
        message: 'GITHUB_TOKEN environment variable not set'
      });
      score -= 20;
    }
    
    if (!healthResults.checks.environment?.passed?.find(e => e.name === 'ANTHROPIC_API_KEY')) {
      issues.push('Missing ANTHROPIC_API_KEY');
      this.results.criticalIssues.push({
        category: 'health',
        message: 'ANTHROPIC_API_KEY environment variable not set'
      });
      score -= 20;
    }
    
    // Check API connectivity
    if (healthResults.checks.apis?.failed?.length > 0) {
      issues.push('API connectivity issues');
      score -= 15;
    }
    
    this.results.categories.health = {
      score: Math.max(0, score),
      issues,
      details: healthResults
    };
    
    console.log(`  ✅ Health Score: ${Math.max(0, score)}/100`);
    
    return Math.max(0, score);
  }

  /**
   * Evaluate security measures
   */
  async evaluateSecurity() {
    console.log('🔒 Evaluating Security...');
    
    let score = 100;
    const issues = [];
    const passed = [];
    
    // Check for exposed secrets
    try {
      const files = await this.findFiles('**/*.{js,json,yml,yaml}');
      
      for (const file of files.slice(0, 50)) { // Limit to 50 files for performance
        const content = await fs.readFile(file, 'utf8');
        
        // Check for hardcoded secrets
        const secretPatterns = [
          /sk-[a-zA-Z0-9]{48}/g,  // OpenAI keys
          /sk-ant-api[0-9]{2}-[a-zA-Z0-9-_]{80,}/g,  // Anthropic keys
          /ghp_[a-zA-Z0-9]{36}/g,  // GitHub PATs
          /ghs_[a-zA-Z0-9]{36}/g,  // GitHub server tokens
          /ya29\.[a-zA-Z0-9_-]+/g,  // Google OAuth tokens
          /AKIA[0-9A-Z]{16}/g,  // AWS access keys
          /[a-z0-9]{32}\.apps\.googleusercontent\.com/g  // Google client IDs
        ];
        
        for (const pattern of secretPatterns) {
          if (pattern.test(content)) {
            issues.push(`Potential secret exposed in ${file}`);
            this.results.criticalIssues.push({
              category: 'security',
              message: `Potential secret exposed in ${file}`
            });
            score -= 25;
            break;
          }
        }
      }
      
      if (issues.length === 0) {
        passed.push('No hardcoded secrets detected');
      }
    } catch (error) {
      this.logger.log('warn', 'Could not scan for secrets', { error: error.message });
    }
    
    // Check for input validation
    try {
      const executorFile = 'src/scripts/lib/ClaudeToolExecutorOptimized.js';
      const content = await fs.readFile(executorFile, 'utf8');
      
      if (content.includes('sanitize') || content.includes('validate')) {
        passed.push('Input validation detected');
      } else {
        issues.push('No input validation detected');
        score -= 10;
      }
      
      if (content.includes('safe = true')) {
        passed.push('Safe mode for dangerous operations');
      } else {
        issues.push('No safe mode for dangerous operations');
        score -= 10;
      }
    } catch (error) {
      issues.push('Could not verify input validation');
      score -= 5;
    }
    
    // Check for rate limiting
    if (this.checkFileContains('src/scripts/lib/ClaudeToolExecutorOptimized.js', 'rate limit')) {
      passed.push('Rate limit handling implemented');
    } else {
      issues.push('No rate limit handling');
      score -= 5;
    }
    
    // Check for authentication
    if (this.checkFileContains('src/scripts/lib/ClaudeToolExecutorOptimized.js', 'auth')) {
      passed.push('Authentication checks present');
    } else {
      issues.push('No authentication verification');
      score -= 10;
    }
    
    this.results.categories.security = {
      score: Math.max(0, score),
      issues,
      passed
    };
    
    console.log(`  ✅ Security Score: ${Math.max(0, score)}/100`);
    
    return Math.max(0, score);
  }

  /**
   * Evaluate error handling
   */
  async evaluateErrorHandling() {
    console.log('⚠️ Evaluating Error Handling...');
    
    let score = 100;
    const issues = [];
    const passed = [];
    
    // Check for error recovery system
    try {
      await fs.access('src/scripts/lib/ErrorRecoveryEnhanced.js');
      passed.push('Enhanced error recovery system present');
      
      const content = await fs.readFile('src/scripts/lib/ErrorRecoveryEnhanced.js', 'utf8');
      
      // Check for specific recovery strategies
      const strategies = [
        'gitLock',
        'rateLimit',
        'networkTimeout',
        'authenticationError',
        'outOfMemory'
      ];
      
      let foundStrategies = 0;
      for (const strategy of strategies) {
        if (content.includes(strategy)) {
          foundStrategies++;
        }
      }
      
      if (foundStrategies >= 4) {
        passed.push(`${foundStrategies} recovery strategies implemented`);
      } else {
        issues.push(`Only ${foundStrategies}/5 recovery strategies found`);
        score -= 10;
      }
    } catch (error) {
      issues.push('Error recovery system not found');
      this.results.criticalIssues.push({
        category: 'errorHandling',
        message: 'ErrorRecoveryEnhanced.js not found'
      });
      score -= 25;
    }
    
    // Check for retry logic
    if (this.checkFileContains('src/scripts/lib/ClaudeToolExecutorOptimized.js', 'retry')) {
      passed.push('Retry logic implemented');
      
      // Check for exponential backoff
      if (this.checkFileContains('src/scripts/lib/ClaudeToolExecutorOptimized.js', 'exponential') ||
          this.checkFileContains('src/scripts/lib/ClaudeToolExecutorOptimized.js', 'backoff')) {
        passed.push('Exponential backoff implemented');
      } else {
        issues.push('No exponential backoff');
        score -= 5;
      }
    } else {
      issues.push('No retry logic');
      score -= 15;
    }
    
    // Check for proper error logging
    if (this.checkFileContains('src/scripts/lib/StructuredLogger.js', 'error')) {
      passed.push('Structured error logging present');
    } else {
      issues.push('No structured error logging');
      score -= 10;
    }
    
    // Check for graceful degradation
    if (this.checkFileContains('src/scripts/claude-code-session-optimized.js', 'fallback')) {
      passed.push('Fallback mechanisms present');
    } else {
      issues.push('No fallback mechanisms');
      score -= 5;
    }
    
    this.results.categories.errorHandling = {
      score: Math.max(0, score),
      issues,
      passed
    };
    
    console.log(`  ✅ Error Handling Score: ${Math.max(0, score)}/100`);
    
    return Math.max(0, score);
  }

  /**
   * Evaluate performance optimizations
   */
  async evaluatePerformance() {
    console.log('⚡ Evaluating Performance...');
    
    let score = 100;
    const issues = [];
    const passed = [];
    
    // Check for caching system
    try {
      await fs.access('src/scripts/lib/RepositoryCache.js');
      passed.push('Repository caching system present');
      
      const content = await fs.readFile('src/scripts/lib/RepositoryCache.js', 'utf8');
      
      if (content.includes('TTL') || content.includes('ttl')) {
        passed.push('Cache TTL management implemented');
      } else {
        issues.push('No cache TTL management');
        score -= 5;
      }
      
      if (content.includes('evict')) {
        passed.push('Cache eviction strategy present');
      } else {
        issues.push('No cache eviction strategy');
        score -= 5;
      }
    } catch (error) {
      issues.push('Caching system not found');
      score -= 20;
    }
    
    // Check for GitHub CLI optimization
    try {
      await fs.access('src/scripts/lib/GitHubCLIAdapter.js');
      passed.push('GitHub CLI optimization present');
    } catch (error) {
      issues.push('GitHub CLI adapter not found');
      score -= 10;
    }
    
    // Check for performance monitoring
    try {
      await fs.access('src/scripts/lib/PerformanceMonitor.js');
      passed.push('Performance monitoring system present');
      
      const content = await fs.readFile('src/scripts/lib/PerformanceMonitor.js', 'utf8');
      
      if (content.includes('checkpoint')) {
        passed.push('Performance checkpoints implemented');
      } else {
        issues.push('No performance checkpoints');
        score -= 5;
      }
    } catch (error) {
      issues.push('Performance monitoring not found');
      score -= 15;
    }
    
    // Check for parallel processing
    if (this.checkFileContains('src/scripts/lib/ClaudeToolExecutorOptimized.js', 'Promise.all')) {
      passed.push('Parallel processing utilized');
    } else {
      issues.push('No parallel processing');
      score -= 5;
    }
    
    // Check for resource limits
    if (this.checkFileContains('src/scripts/lib/RepositoryCache.js', 'maxSize')) {
      passed.push('Resource limits implemented');
    } else {
      issues.push('No resource limits');
      score -= 5;
    }
    
    this.results.categories.performance = {
      score: Math.max(0, score),
      issues,
      passed
    };
    
    console.log(`  ✅ Performance Score: ${Math.max(0, score)}/100`);
    
    return Math.max(0, score);
  }

  /**
   * Evaluate monitoring and observability
   */
  async evaluateMonitoring() {
    console.log('📊 Evaluating Monitoring...');
    
    let score = 100;
    const issues = [];
    const passed = [];
    
    // Check for structured logging
    try {
      await fs.access('src/scripts/lib/StructuredLogger.js');
      passed.push('Structured logging present');
      
      const content = await fs.readFile('src/scripts/lib/StructuredLogger.js', 'utf8');
      
      if (content.includes('correlationId')) {
        passed.push('Correlation ID tracking');
      } else {
        issues.push('No correlation ID tracking');
        score -= 10;
      }
      
      if (content.includes('metrics')) {
        passed.push('Metrics collection implemented');
      } else {
        issues.push('No metrics collection');
        score -= 10;
      }
    } catch (error) {
      issues.push('Structured logging not found');
      this.results.warnings.push({
        category: 'monitoring',
        message: 'StructuredLogger.js not found'
      });
      score -= 20;
    }
    
    // Check for GitHub Actions integration
    if (this.checkFileContains('src/scripts/lib/PerformanceMonitor.js', 'GITHUB_STEP_SUMMARY')) {
      passed.push('GitHub Actions summary integration');
    } else {
      issues.push('No GitHub Actions summary integration');
      score -= 5;
    }
    
    // Check for health checks
    try {
      await fs.access('src/scripts/lib/HealthCheck.js');
      passed.push('Health check system present');
    } catch (error) {
      issues.push('Health check system not found');
      score -= 15;
    }
    
    // Check for error tracking
    if (this.checkFileContains('src/scripts/lib/PerformanceMonitor.js', 'trackError')) {
      passed.push('Error tracking implemented');
    } else {
      issues.push('No error tracking');
      score -= 10;
    }
    
    // Check for performance reporting
    if (this.checkFileContains('src/scripts/lib/PerformanceMonitor.js', 'generateReport')) {
      passed.push('Performance reporting available');
    } else {
      issues.push('No performance reporting');
      score -= 10;
    }
    
    this.results.categories.monitoring = {
      score: Math.max(0, score),
      issues,
      passed
    };
    
    console.log(`  ✅ Monitoring Score: ${Math.max(0, score)}/100`);
    
    return Math.max(0, score);
  }

  /**
   * Evaluate documentation
   */
  async evaluateDocumentation() {
    console.log('📚 Evaluating Documentation...');
    
    let score = 100;
    const issues = [];
    const passed = [];
    
    // Check for main documentation
    const docFiles = [
      'docs/claude-code-integration-proposal.md',
      'docs/claude-code-integration-README.md',
      'docs/github-runner-optimization-plan.md'
    ];
    
    let foundDocs = 0;
    for (const docFile of docFiles) {
      try {
        await fs.access(docFile);
        foundDocs++;
      } catch (error) {
        // File not found
      }
    }
    
    if (foundDocs === docFiles.length) {
      passed.push('All documentation files present');
    } else {
      issues.push(`Only ${foundDocs}/${docFiles.length} documentation files found`);
      score -= (docFiles.length - foundDocs) * 10;
    }
    
    // Check for inline documentation
    const codeFiles = [
      'src/scripts/lib/ClaudeToolExecutorOptimized.js',
      'src/scripts/lib/ErrorRecoveryEnhanced.js',
      'src/scripts/lib/PerformanceMonitor.js'
    ];
    
    let wellDocumented = 0;
    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const commentLines = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
        const codeLines = content.split('\n').length;
        const commentRatio = commentLines * 10 / codeLines; // Rough estimate
        
        if (commentRatio > 0.1) {
          wellDocumented++;
        }
      } catch (error) {
        // File not found
      }
    }
    
    if (wellDocumented === codeFiles.length) {
      passed.push('Code is well documented');
    } else {
      issues.push(`Only ${wellDocumented}/${codeFiles.length} files well documented`);
      score -= (codeFiles.length - wellDocumented) * 5;
    }
    
    // Check for workflow documentation
    try {
      const workflow = await fs.readFile('.github/workflows/claude-code-handler-optimized.yml', 'utf8');
      
      if (workflow.includes('# ')) {
        passed.push('Workflow has comments');
      } else {
        issues.push('Workflow lacks comments');
        score -= 5;
      }
    } catch (error) {
      issues.push('Optimized workflow not found');
      score -= 10;
    }
    
    // Check for README
    try {
      await fs.access('README.md');
      passed.push('README.md exists');
    } catch (error) {
      issues.push('No README.md');
      score -= 10;
    }
    
    this.results.categories.documentation = {
      score: Math.max(0, score),
      issues,
      passed
    };
    
    console.log(`  ✅ Documentation Score: ${Math.max(0, score)}/100`);
    
    return Math.max(0, score);
  }

  /**
   * Generate final report
   */
  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 PRODUCTION READINESS REPORT');
    console.log('='.repeat(60) + '\n');
    
    const readyEmoji = this.results.isReady ? '✅' : '❌';
    const readyText = this.results.isReady ? 'PRODUCTION READY' : 'NOT PRODUCTION READY';
    
    console.log(`${readyEmoji} Status: ${readyText}`);
    console.log(`📊 Overall Score: ${this.results.score}/100\n`);
    
    // Category breakdown
    console.log('Category Scores:');
    console.log('-'.repeat(40));
    
    for (const [category, data] of Object.entries(this.results.categories)) {
      const emoji = data.score >= 80 ? '✅' : data.score >= 60 ? '⚠️' : '❌';
      console.log(`${emoji} ${category.padEnd(20)} ${data.score}/100`);
    }
    
    // Critical issues
    if (this.results.criticalIssues.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES:');
      console.log('-'.repeat(40));
      
      this.results.criticalIssues.forEach(issue => {
        console.log(`  • [${issue.category}] ${issue.message}`);
      });
    }
    
    // Warnings
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      console.log('-'.repeat(40));
      
      this.results.warnings.slice(0, 5).forEach(warning => {
        console.log(`  • [${warning.category}] ${warning.message}`);
      });
      
      if (this.results.warnings.length > 5) {
        console.log(`  ... and ${this.results.warnings.length - 5} more`);
      }
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-'.repeat(40));
    
    // Generate recommendations based on scores
    const recommendations = [];
    
    for (const [category, data] of Object.entries(this.results.categories)) {
      if (data.score < 80) {
        if (data.issues && data.issues.length > 0) {
          recommendations.push({
            category,
            priority: data.score < 60 ? 'HIGH' : 'MEDIUM',
            message: `Improve ${category}: ${data.issues[0]}`
          });
        }
      }
    }
    
    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    recommendations.slice(0, 5).forEach(rec => {
      const emoji = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟠' : '🟡';
      console.log(`  ${emoji} [${rec.priority}] ${rec.message}`);
    });
    
    // Save report to file
    const reportPath = `production-readiness-report-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log(`\n📁 Full report saved to: ${reportPath}`);
    console.log('='.repeat(60) + '\n');
    
    // Exit with appropriate code
    if (!this.results.isReady) {
      console.log('❌ System is not production ready. Please address critical issues.');
      process.exit(1);
    } else {
      console.log('✅ System is production ready!');
      process.exit(0);
    }
  }

  /**
   * Helper: Find files matching pattern
   */
  async findFiles(pattern) {
    try {
      const { stdout } = await execAsync(`find . -type f -name "${pattern}" | head -100`);
      return stdout.trim().split('\n').filter(f => f);
    } catch (error) {
      return [];
    }
  }

  /**
   * Helper: Check if file contains text
   */
  checkFileContains(filePath, text) {
    try {
      const content = require('fs').readFileSync(filePath, 'utf8');
      return content.toLowerCase().includes(text.toLowerCase());
    } catch (error) {
      return false;
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const checker = new ProductionReadinessCheck();
  checker.evaluate().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ProductionReadinessCheck;