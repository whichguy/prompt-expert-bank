/**
 * Programming expert for evaluating code generation, review, and technical prompts
 */

const path = require('path');
const fs = require('fs');

// Load test scenarios from separate file
const testScenariosPath = path.join(__dirname, '..', 'test-scenarios', 'programming-tests.js');
const testData = fs.existsSync(testScenariosPath) ? require(testScenariosPath) : null;

const programmingExpert = {
  name: 'Programming & Code Review Expert',
  domain: 'programming',
  description: 'Evaluates prompts that generate, review, or analyze code across multiple programming languages',
  testScenarios: testData ? testData.scenarios : [],
  
  async evaluatePrompts(oldPrompt, newPrompt, anthropic) {
    // Test both prompts
    const oldResults = oldPrompt ? await this.testPrompt(oldPrompt, this.testScenarios, anthropic) : [];
    const newResults = await this.testPrompt(newPrompt, this.testScenarios, anthropic);
    
    // Calculate metrics
    const oldMetrics = oldPrompt ? this.calculateMetrics(oldResults) : {};
    const newMetrics = this.calculateMetrics(newResults);
    
    // Generate report
    const report = this.generateReport(oldMetrics, newMetrics, oldResults, newResults);
    
    // Determine recommendation
    const improvement = oldPrompt ? newMetrics.overallScore - oldMetrics.overallScore : 0;
    let recommendation = 'NEUTRAL';
    
    if (improvement > 0.1) {
      recommendation = 'APPROVE';
    } else if (improvement < -0.1) {
      recommendation = 'REQUEST_CHANGES';
    } else if (!oldPrompt && newMetrics.overallScore > 0.7) {
      recommendation = 'APPROVE';
    }
    
    return {
      report,
      recommendation,
      improvement: improvement * 100,
      metrics: {
        old: oldMetrics,
        new: newMetrics
      }
    };
  },
  
  async testPrompt(prompt, scenarios, anthropic) {
    const results = [];
    
    for (const scenario of scenarios) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          system: prompt,
          messages: [{
            role: 'user',
            content: scenario.input
          }]
        });
        
        const responseText = response.content[0].text;
        const evaluation = this.evaluateResponse(responseText, scenario);
        
        results.push({
          scenario: scenario.name,
          input: scenario.input,
          expected: scenario.expected,
          actualResponse: responseText.substring(0, 300) + (responseText.length > 300 ? '...' : ''),
          fullResponse: responseText,
          passed: evaluation.passed,
          analysis: evaluation.analysis
        });
      } catch (error) {
        results.push({
          scenario: scenario.name,
          input: scenario.input,
          expected: scenario.expected,
          error: error.message,
          passed: false
        });
      }
    }
    
    return results;
  },
  
  evaluateResponse(response, scenario) {
    const analysis = {
      hasCodeBlock: false,
      syntaxAware: false,
      errorHandling: false,
      bestPractices: false,
      performanceAware: false,
      securityConscious: false,
      wellExplained: false,
      languageAgnostic: false,
      testingMentioned: false,
      maintainable: false
    };
    
    const lowerResponse = response.toLowerCase();
    
    // Check for code blocks or syntax
    analysis.hasCodeBlock = response.includes('```') || response.includes('function') || 
                           response.includes('def ') || response.includes('class ') ||
                           response.includes('public ') || response.includes('const ') ||
                           response.includes('let ') || response.includes('#include');
    
    // Check for syntax awareness across languages
    analysis.syntaxAware = response.includes('{') || response.includes('(') || 
                          response.includes(';') || response.includes(':') ||
                          response.includes('->') || response.includes('=>');
    
    // Check for error handling concepts
    analysis.errorHandling = lowerResponse.includes('try') || lowerResponse.includes('catch') || 
                            lowerResponse.includes('error') || lowerResponse.includes('exception') ||
                            lowerResponse.includes('throw') || lowerResponse.includes('finally');
    
    // Check for best practices discussion
    analysis.bestPractices = lowerResponse.includes('best practice') || lowerResponse.includes('convention') ||
                            lowerResponse.includes('standard') || lowerResponse.includes('clean code') ||
                            lowerResponse.includes('maintainable') || lowerResponse.includes('readable');
    
    // Check for performance considerations
    analysis.performanceAware = lowerResponse.includes('performance') || lowerResponse.includes('efficient') ||
                               lowerResponse.includes('optimiz') || lowerResponse.includes('complexity') ||
                               lowerResponse.includes('memory') || lowerResponse.includes('speed');
    
    // Check for security awareness
    analysis.securityConscious = lowerResponse.includes('security') || lowerResponse.includes('sanitiz') ||
                                lowerResponse.includes('validat') || lowerResponse.includes('escape') ||
                                lowerResponse.includes('injection') || lowerResponse.includes('auth');
    
    // Check for explanations
    analysis.wellExplained = lowerResponse.includes('because') || lowerResponse.includes('this ') ||
                            lowerResponse.includes('explain') || response.includes('//') ||
                            lowerResponse.includes('reason') || lowerResponse.includes('purpose');
    
    // Check for language-agnostic principles
    analysis.languageAgnostic = lowerResponse.includes('principle') || lowerResponse.includes('pattern') ||
                               lowerResponse.includes('approach') || lowerResponse.includes('design') ||
                               lowerResponse.includes('architecture') || lowerResponse.includes('algorithm');
    
    // Check for testing mentions
    analysis.testingMentioned = lowerResponse.includes('test') || lowerResponse.includes('unit') ||
                               lowerResponse.includes('integration') || lowerResponse.includes('debug') ||
                               lowerResponse.includes('assert') || lowerResponse.includes('mock');
    
    // Check for maintainability
    analysis.maintainable = lowerResponse.includes('maintainable') || lowerResponse.includes('modular') ||
                           lowerResponse.includes('reusable') || lowerResponse.includes('documentation') ||
                           lowerResponse.includes('comment') || lowerResponse.includes('refactor');
    
    // Determine if passed based on expected type
    let passed = false;
    if (scenario.expected.type === 'implementation') {
      passed = analysis.hasCodeBlock && analysis.syntaxAware && analysis.errorHandling;
    } else if (scenario.expected.type === 'review') {
      passed = analysis.wellExplained && (analysis.bestPractices || analysis.securityConscious);
    } else if (scenario.expected.type === 'architecture') {
      passed = analysis.languageAgnostic && analysis.wellExplained && analysis.bestPractices;
    } else if (scenario.expected.type === 'debugging') {
      passed = analysis.errorHandling && analysis.wellExplained && analysis.testingMentioned;
    } else if (scenario.expected.type === 'optimization') {
      passed = analysis.performanceAware && analysis.wellExplained;
    }
    
    return { passed, analysis };
  },
  
  calculateMetrics(testResults) {
    const metrics = {
      codeQuality: 0,
      errorHandling: 0,
      bestPractices: 0,
      securityAwareness: 0,
      performanceAwareness: 0,
      explanationClarity: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Calculate individual metrics
    const qualityTests = testResults.filter(r => r.analysis && (r.analysis.hasCodeBlock && r.analysis.syntaxAware)).length;
    metrics.codeQuality = qualityTests / testResults.length;
    
    const errorHandled = testResults.filter(r => r.analysis && r.analysis.errorHandling).length;
    metrics.errorHandling = errorHandled / testResults.length;
    
    const bestPracticed = testResults.filter(r => r.analysis && r.analysis.bestPractices).length;
    metrics.bestPractices = bestPracticed / testResults.length;
    
    const securityAware = testResults.filter(r => r.analysis && r.analysis.securityConscious).length;
    metrics.securityAwareness = securityAware / testResults.length;
    
    const performanceAware = testResults.filter(r => r.analysis && r.analysis.performanceAware).length;
    metrics.performanceAwareness = performanceAware / testResults.length;
    
    const explained = testResults.filter(r => r.analysis && r.analysis.wellExplained).length;
    metrics.explanationClarity = explained / testResults.length;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.codeQuality * 0.25 +           // 25% - Code must be well-structured
      metrics.errorHandling * 0.20 +         // 20% - Proper error handling
      metrics.bestPractices * 0.20 +         // 20% - Following programming best practices
      metrics.explanationClarity * 0.15 +    // 15% - Clear explanations
      metrics.securityAwareness * 0.10 +     // 10% - Security considerations
      metrics.performanceAwareness * 0.10    // 10% - Performance considerations
    );
    
    return metrics;
  },
  
  generateReport(oldMetrics, newMetrics, oldResults, newResults) {
    let report = `### 🧪 Programming & Code Review Evaluation\n\n`;
    
    if (oldResults.length > 0) {
      report += `#### Previous Prompt Performance\n`;
      report += `- **Code Quality**: ${(oldMetrics.codeQuality * 100).toFixed(1)}%\n`;
      report += `- **Error Handling**: ${(oldMetrics.errorHandling * 100).toFixed(1)}%\n`;
      report += `- **Best Practices**: ${(oldMetrics.bestPractices * 100).toFixed(1)}%\n`;
      report += `- **Security Awareness**: ${(oldMetrics.securityAwareness * 100).toFixed(1)}%\n`;
      report += `- **Performance Awareness**: ${(oldMetrics.performanceAwareness * 100).toFixed(1)}%\n`;
      report += `- **Explanation Clarity**: ${(oldMetrics.explanationClarity * 100).toFixed(1)}%\n`;
      report += `- **Overall Score**: ${(oldMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    }
    
    report += `#### New Prompt Performance\n`;
    report += `- **Code Quality**: ${(newMetrics.codeQuality * 100).toFixed(1)}%\n`;
    report += `- **Error Handling**: ${(newMetrics.errorHandling * 100).toFixed(1)}%\n`;
    report += `- **Best Practices**: ${(newMetrics.bestPractices * 100).toFixed(1)}%\n`;
    report += `- **Security Awareness**: ${(newMetrics.securityAwareness * 100).toFixed(1)}%\n`;
    report += `- **Performance Awareness**: ${(newMetrics.performanceAwareness * 100).toFixed(1)}%\n`;
    report += `- **Explanation Clarity**: ${(newMetrics.explanationClarity * 100).toFixed(1)}%\n`;
    report += `- **Overall Score**: ${(newMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    
    if (oldResults.length > 0) {
      report += `### 📊 Performance Comparison\n\n`;
      
      report += `| Metric | Change | Status |\n`;
      report += `|--------|--------|--------|\n`;
      
      const metrics = ['codeQuality', 'errorHandling', 'bestPractices', 'securityAwareness', 'performanceAwareness', 'explanationClarity'];
      const labels = ['Code Quality', 'Error Handling', 'Best Practices', 'Security Awareness', 'Performance Awareness', 'Explanation Clarity'];
      
      metrics.forEach((metric, i) => {
        const change = ((newMetrics[metric] - oldMetrics[metric]) * 100).toFixed(1);
        const positive = parseFloat(change) > 0;
        report += `| ${labels[i]} | ${positive ? '+' : ''}${change}% | ${positive ? '✅' : '❌'} |\n`;
      });
      
      const overallChange = ((newMetrics.overallScore - oldMetrics.overallScore) * 100).toFixed(1);
      report += `| **Overall Score** | **${parseFloat(overallChange) > 0 ? '+' : ''}${overallChange}%** | **${parseFloat(overallChange) > 0 ? '✅' : '❌'}** |\n\n`;
    }
    
    // Key observations
    report += `### 💡 Key Observations\n\n`;
    
    if (newMetrics.codeQuality > 0.8) {
      report += `✅ **High Code Quality**: The prompt generates well-structured, syntactically correct code.\n\n`;
    }
    
    if (newMetrics.bestPractices > 0.7) {
      report += `✅ **Best Practices**: The prompt follows programming best practices and conventions.\n\n`;
    }
    
    if (newMetrics.securityAwareness > 0.6) {
      report += `✅ **Security Conscious**: The prompt considers security implications in code.\n\n`;
    }
    
    const failedTests = newResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      report += `⚠️ **Areas for Improvement**:\n`;
      if (newMetrics.codeQuality < 0.6) report += `- Improve code structure and syntax correctness\n`;
      if (newMetrics.errorHandling < 0.5) report += `- Add more robust error handling patterns\n`;
      if (newMetrics.bestPractices < 0.5) report += `- Follow programming best practices and conventions\n`;
      if (newMetrics.explanationClarity < 0.5) report += `- Provide clearer explanations and documentation\n`;
      report += `\n`;
    }
    
    return report;
  }
};

module.exports = programmingExpert;