/**
 * Node.js coding expert for evaluating code generation and review prompts
 */

const path = require('path');
const fs = require('fs');

// Load test scenarios from separate file
const testScenariosPath = path.join(__dirname, '..', 'test-scenarios', 'nodejs-tests.js');
const testData = fs.existsSync(testScenariosPath) ? require(testScenariosPath) : null;

const nodejsExpert = {
  name: 'Node.js Coding Expert',
  domain: 'nodejs',
  description: 'Evaluates prompts that generate, review, or analyze Node.js code',
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
      syntaxCorrect: false,
      usesAsync: false,
      errorHandling: false,
      bestPractices: false,
      efficiency: false,
      security: false,
      explanation: false
    };
    
    const lowerResponse = response.toLowerCase();
    
    // Check for syntax correctness (basic check for code blocks)
    analysis.syntaxCorrect = response.includes('```') || response.includes('function') || response.includes('const');
    
    // Check for async/await usage
    analysis.usesAsync = response.includes('async') || response.includes('await') || response.includes('.then');
    
    // Check for error handling
    analysis.errorHandling = response.includes('try') || response.includes('catch') || response.includes('error');
    
    // Check for best practices
    analysis.bestPractices = response.includes('const') || response.includes('let');
    analysis.bestPractices = analysis.bestPractices && !response.includes('var ');
    
    // Check for performance considerations
    analysis.efficiency = lowerResponse.includes('performance') || lowerResponse.includes('efficient') || 
                         lowerResponse.includes('optimiz') || response.includes('O(');
    
    // Check for security considerations
    analysis.security = lowerResponse.includes('security') || lowerResponse.includes('sanitiz') || 
                       lowerResponse.includes('validat') || lowerResponse.includes('escape');
    
    // Check for explanation
    analysis.explanation = lowerResponse.includes('because') || lowerResponse.includes('this') || 
                          lowerResponse.includes('explain') || response.includes('//');
    
    // Determine if passed based on expected type
    let passed = false;
    if (scenario.expected.type === 'implementation') {
      passed = analysis.syntaxCorrect && analysis.errorHandling;
    } else if (scenario.expected.type === 'review') {
      passed = analysis.explanation && (analysis.bestPractices || analysis.security || analysis.efficiency);
    } else if (scenario.expected.type === 'async') {
      passed = analysis.syntaxCorrect && analysis.usesAsync && analysis.errorHandling;
    } else if (scenario.expected.type === 'security') {
      passed = analysis.security && analysis.explanation;
    }
    
    return { passed, analysis };
  },
  
  calculateMetrics(testResults) {
    const metrics = {
      syntaxAccuracy: 0,
      asyncHandling: 0,
      errorHandling: 0,
      bestPractices: 0,
      securityAwareness: 0,
      codeExplanation: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Calculate individual metrics
    const syntaxCorrect = testResults.filter(r => r.analysis && r.analysis.syntaxCorrect).length;
    metrics.syntaxAccuracy = syntaxCorrect / testResults.length;
    
    const asyncTests = testResults.filter(r => r.expected.type === 'async');
    const asyncCorrect = asyncTests.filter(r => r.analysis && r.analysis.usesAsync).length;
    metrics.asyncHandling = asyncTests.length > 0 ? asyncCorrect / asyncTests.length : 0;
    
    const errorHandled = testResults.filter(r => r.analysis && r.analysis.errorHandling).length;
    metrics.errorHandling = errorHandled / testResults.length;
    
    const bestPracticed = testResults.filter(r => r.analysis && r.analysis.bestPractices).length;
    metrics.bestPractices = bestPracticed / testResults.length;
    
    const securityAware = testResults.filter(r => r.analysis && r.analysis.security).length;
    metrics.securityAwareness = securityAware / testResults.length;
    
    const explained = testResults.filter(r => r.analysis && r.analysis.explanation).length;
    metrics.codeExplanation = explained / testResults.length;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.syntaxAccuracy * 0.25 +      // 25% - Code must be syntactically correct
      metrics.errorHandling * 0.20 +       // 20% - Proper error handling
      metrics.bestPractices * 0.20 +       // 20% - Following Node.js best practices
      metrics.asyncHandling * 0.15 +       // 15% - Async/await handling
      metrics.codeExplanation * 0.10 +     // 10% - Clear explanations
      metrics.securityAwareness * 0.10     // 10% - Security considerations
    );
    
    return metrics;
  },
  
  generateReport(oldMetrics, newMetrics, oldResults, newResults) {
    let report = `### 🧪 Node.js Coding Evaluation\n\n`;
    
    if (oldResults.length > 0) {
      report += `#### Previous Prompt Performance\n`;
      report += `- **Syntax Accuracy**: ${(oldMetrics.syntaxAccuracy * 100).toFixed(1)}%\n`;
      report += `- **Error Handling**: ${(oldMetrics.errorHandling * 100).toFixed(1)}%\n`;
      report += `- **Best Practices**: ${(oldMetrics.bestPractices * 100).toFixed(1)}%\n`;
      report += `- **Async Handling**: ${(oldMetrics.asyncHandling * 100).toFixed(1)}%\n`;
      report += `- **Code Explanation**: ${(oldMetrics.codeExplanation * 100).toFixed(1)}%\n`;
      report += `- **Security Awareness**: ${(oldMetrics.securityAwareness * 100).toFixed(1)}%\n`;
      report += `- **Overall Score**: ${(oldMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    }
    
    report += `#### New Prompt Performance\n`;
    report += `- **Syntax Accuracy**: ${(newMetrics.syntaxAccuracy * 100).toFixed(1)}%\n`;
    report += `- **Error Handling**: ${(newMetrics.errorHandling * 100).toFixed(1)}%\n`;
    report += `- **Best Practices**: ${(newMetrics.bestPractices * 100).toFixed(1)}%\n`;
    report += `- **Async Handling**: ${(newMetrics.asyncHandling * 100).toFixed(1)}%\n`;
    report += `- **Code Explanation**: ${(newMetrics.codeExplanation * 100).toFixed(1)}%\n`;
    report += `- **Security Awareness**: ${(newMetrics.securityAwareness * 100).toFixed(1)}%\n`;
    report += `- **Overall Score**: ${(newMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    
    if (oldResults.length > 0) {
      report += `### 📊 Performance Comparison\n\n`;
      const improvements = {};
      for (const metric in newMetrics) {
        if (metric !== 'overallScore') {
          improvements[metric] = ((newMetrics[metric] - oldMetrics[metric]) * 100).toFixed(1);
        }
      }
      
      report += `| Metric | Change | Status |\n`;
      report += `|--------|--------|--------|\n`;
      report += `| Syntax Accuracy | ${improvements.syntaxAccuracy > 0 ? '+' : ''}${improvements.syntaxAccuracy}% | ${improvements.syntaxAccuracy > 0 ? '✅' : '❌'} |\n`;
      report += `| Error Handling | ${improvements.errorHandling > 0 ? '+' : ''}${improvements.errorHandling}% | ${improvements.errorHandling > 0 ? '✅' : '❌'} |\n`;
      report += `| Best Practices | ${improvements.bestPractices > 0 ? '+' : ''}${improvements.bestPractices}% | ${improvements.bestPractices > 0 ? '✅' : '⚠️'} |\n`;
      report += `| Async Handling | ${improvements.asyncHandling > 0 ? '+' : ''}${improvements.asyncHandling}% | ${improvements.asyncHandling > 0 ? '✅' : '⚠️'} |\n`;
      report += `| **Overall Score** | **${((newMetrics.overallScore - oldMetrics.overallScore) * 100).toFixed(1) > 0 ? '+' : ''}${((newMetrics.overallScore - oldMetrics.overallScore) * 100).toFixed(1)}%** | **${newMetrics.overallScore > oldMetrics.overallScore ? '✅' : '❌'}** |\n\n`;
    }
    
    // Show specific test results
    const failedTests = newResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      report += `#### ❌ Failed Tests (${failedTests.length})\n`;
      for (const test of failedTests) {
        report += `- **${test.scenario}**: "${test.input}"\n`;
        if (test.analysis) {
          const issues = [];
          if (!test.analysis.syntaxCorrect) issues.push('syntax');
          if (!test.analysis.errorHandling) issues.push('error handling');
          if (!test.analysis.bestPractices) issues.push('best practices');
          report += `  - Missing: ${issues.join(', ')}\n`;
        }
      }
      report += `\n`;
    }
    
    const passedTests = newResults.filter(r => r.passed);
    if (passedTests.length > 0) {
      report += `#### ✅ Passed Tests (${passedTests.length}/${newResults.length})\n\n`;
    }
    
    // Key observations
    report += `### 💡 Key Observations\n\n`;
    
    if (newMetrics.syntaxAccuracy > 0.8) {
      report += `✅ **Strong Syntax**: The prompt generates syntactically correct Node.js code.\n\n`;
    }
    
    if (newMetrics.errorHandling > 0.7) {
      report += `✅ **Error Handling**: The prompt includes proper error handling patterns.\n\n`;
    }
    
    if (newMetrics.securityAwareness > 0.5) {
      report += `✅ **Security Conscious**: The prompt considers security implications.\n\n`;
    }
    
    if (failedTests.length > 0) {
      report += `⚠️ **Areas for Improvement**:\n`;
      if (newMetrics.syntaxAccuracy < 0.7) report += `- Improve code syntax generation\n`;
      if (newMetrics.errorHandling < 0.5) report += `- Add more robust error handling\n`;
      if (newMetrics.bestPractices < 0.5) report += `- Follow Node.js best practices (const/let, async/await)\n`;
      report += `\n`;
    }
    
    return report;
  }
};

module.exports = nodejsExpert;