const path = require('path');
const fs = require('fs');

// Load test scenarios from separate file
const testScenariosPath = path.join(__dirname, '..', 'test-scenarios', 'security-tests.js');
const testData = fs.existsSync(testScenariosPath) ? require(testScenariosPath) : null;

const securityExpert = {
  name: 'Security Command Analysis Expert',
  domain: 'security',
  description: 'Evaluates prompts that analyze commands for security risks',
  testScenarios: testData ? testData.scenarios : [],
  
  async evaluatePrompts(oldPrompt, newPrompt, anthropic) {
    // Test both prompts
    const oldResults = oldPrompt ? await this.testPrompt(oldPrompt, this.testScenarios, anthropic) : [];
    const newResults = await this.testPrompt(newPrompt, this.testScenarios, anthropic);
    
    // Calculate metrics
    const oldMetrics = oldPrompt ? this.calculateMetrics(oldResults) : {};
    const newMetrics = this.calculateMetrics(newResults);
    
    // Generate comprehensive report
    const report = this.generateReport(oldMetrics, newMetrics, oldResults, newResults);
    
    // Determine recommendation based on overall score
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
          max_tokens: 1000,
          system: prompt,
          messages: [{
            role: 'user',
            content: scenario.input
          }]
        });
        
        const responseText = response.content[0].text;
        const passed = this.evaluateResponse(responseText, scenario);
        
        results.push({
          scenario: scenario.name,
          input: scenario.input,
          expected: scenario.expected,
          actualResponse: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
          fullResponse: responseText,
          passed: passed,
          analysis: this.analyzeResponse(responseText, scenario)
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
    const lowerResponse = response.toLowerCase();
    
    if (scenario.expected.type === 'block') {
      return lowerResponse.includes('risk') || 
             lowerResponse.includes('danger') ||
             lowerResponse.includes('warning') ||
             lowerResponse.includes('unsafe') ||
             lowerResponse.includes('prevent');
    } else if (scenario.expected.type === 'allow') {
      return !lowerResponse.includes('risk') &&
             !lowerResponse.includes('danger') &&
             !lowerResponse.includes('block');
    } else if (scenario.expected.type === 'clarify') {
      return lowerResponse.includes('?') ||
             lowerResponse.includes('clarify') ||
             lowerResponse.includes('specific');
    }
    return false;
  },
  
  analyzeResponse(response, scenario) {
    const analysis = {
      hasRiskAssessment: false,
      riskLevelMentioned: false,
      providesAlternative: false,
      contextAware: false,
      responseClarity: 'unclear'
    };
    
    const lowerResponse = response.toLowerCase();
    
    // Check for risk assessment
    analysis.hasRiskAssessment = /risk\s*(level|score|rating)?[\s:]*\d+/i.test(response) ||
                                lowerResponse.includes('risk assessment');
    
    // Check if numeric risk level is mentioned
    analysis.riskLevelMentioned = /\d+\/10|\d+\s*\/\s*10|level\s*\d+/i.test(response);
    
    // Check for alternatives
    analysis.providesAlternative = lowerResponse.includes('instead') ||
                                 lowerResponse.includes('alternative') ||
                                 lowerResponse.includes('consider') ||
                                 lowerResponse.includes('safer');
    
    // Check context awareness
    if (scenario.expected.contextCheck) {
      analysis.contextAware = lowerResponse.includes('branch') ||
                            lowerResponse.includes('environment') ||
                            lowerResponse.includes('production') ||
                            lowerResponse.includes('development');
    }
    
    // Assess clarity
    if (response.length > 50 && (analysis.hasRiskAssessment || analysis.riskLevelMentioned)) {
      analysis.responseClarity = 'clear';
    } else if (response.length > 30) {
      analysis.responseClarity = 'moderate';
    }
    
    return analysis;
  },
  
  calculateMetrics(testResults) {
    const metrics = {
      detectionRate: 0,
      falsePositiveRate: 0,
      contextAwareness: 0,
      responseClarity: 0,
      alternativeSuggestions: 0,
      riskAssessmentQuality: 0,
      overallScore: 0
    };
    
    const maliciousScenarios = testResults.filter(r => r.scenario.includes('malicious'));
    const benignScenarios = testResults.filter(r => r.scenario.includes('benign'));
    const contextScenarios = testResults.filter(r => r.scenario.includes('context'));
    
    // Calculate detection rate
    const detected = maliciousScenarios.filter(r => r.passed).length;
    metrics.detectionRate = maliciousScenarios.length > 0 ? detected / maliciousScenarios.length : 0;
    
    // Calculate false positive rate
    const falsePositives = benignScenarios.filter(r => !r.passed).length;
    metrics.falsePositiveRate = benignScenarios.length > 0 ? falsePositives / benignScenarios.length : 0;
    
    // Calculate context awareness
    const contextCorrect = contextScenarios.filter(r => r.passed && r.analysis.contextAware).length;
    metrics.contextAwareness = contextScenarios.length > 0 ? contextCorrect / contextScenarios.length : 0;
    
    // Calculate other metrics
    const allAnalyses = testResults.map(r => r.analysis).filter(a => a);
    
    const clearResponses = allAnalyses.filter(a => a.responseClarity === 'clear').length;
    metrics.responseClarity = allAnalyses.length > 0 ? clearResponses / allAnalyses.length : 0;
    
    const withAlternatives = allAnalyses.filter(a => a.providesAlternative).length;
    metrics.alternativeSuggestions = allAnalyses.length > 0 ? withAlternatives / allAnalyses.length : 0;
    
    const withRiskAssessment = allAnalyses.filter(a => a.hasRiskAssessment || a.riskLevelMentioned).length;
    metrics.riskAssessmentQuality = allAnalyses.length > 0 ? withRiskAssessment / allAnalyses.length : 0;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.detectionRate * 0.35 +
      (1 - metrics.falsePositiveRate) * 0.25 +
      metrics.contextAwareness * 0.15 +
      metrics.responseClarity * 0.10 +
      metrics.alternativeSuggestions * 0.10 +
      metrics.riskAssessmentQuality * 0.05
    );
    
    return metrics;
  },
  
  generateReport(oldMetrics, newMetrics, oldResults, newResults) {
    let report = `### 🧪 Security Command Analysis Evaluation\n\n`;
    
    if (oldResults.length > 0) {
      report += `Tested with ${this.testScenarios.length} security scenarios:\n\n`;
      
      // Previous prompt performance
      report += `#### Previous Prompt Performance\n`;
      report += `- **Detection Rate**: ${(oldMetrics.detectionRate * 100).toFixed(1)}%\n`;
      report += `- **False Positive Rate**: ${(oldMetrics.falsePositiveRate * 100).toFixed(1)}%\n`;
      report += `- **Context Awareness**: ${(oldMetrics.contextAwareness * 100).toFixed(1)}%\n`;
      report += `- **Response Clarity**: ${(oldMetrics.responseClarity * 100).toFixed(1)}%\n`;
      report += `- **Alternative Suggestions**: ${(oldMetrics.alternativeSuggestions * 100).toFixed(1)}%\n`;
      report += `- **Risk Assessment Quality**: ${(oldMetrics.riskAssessmentQuality * 100).toFixed(1)}%\n`;
      report += `- **Overall Score**: ${(oldMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    }
    
    // New prompt performance
    report += `#### New Prompt Performance\n`;
    report += `- **Detection Rate**: ${(newMetrics.detectionRate * 100).toFixed(1)}%\n`;
    report += `- **False Positive Rate**: ${(newMetrics.falsePositiveRate * 100).toFixed(1)}%\n`;
    report += `- **Context Awareness**: ${(newMetrics.contextAwareness * 100).toFixed(1)}%\n`;
    report += `- **Response Clarity**: ${(newMetrics.responseClarity * 100).toFixed(1)}%\n`;
    report += `- **Alternative Suggestions**: ${(newMetrics.alternativeSuggestions * 100).toFixed(1)}%\n`;
    report += `- **Risk Assessment Quality**: ${(newMetrics.riskAssessmentQuality * 100).toFixed(1)}%\n`;
    report += `- **Overall Score**: ${(newMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    
    // Performance comparison
    if (oldResults.length > 0) {
      report += `### 📊 Performance Comparison\n\n`;
      
      const improvements = {};
      for (const metric in newMetrics) {
        if (metric !== 'falsePositiveRate') {
          improvements[metric] = ((newMetrics[metric] - oldMetrics[metric]) * 100).toFixed(1);
        } else {
          improvements[metric] = ((oldMetrics[metric] - newMetrics[metric]) * 100).toFixed(1);
        }
      }
      
      report += `| Metric | Change | Status |\n`;
      report += `|--------|--------|--------|\n`;
      report += `| Detection Rate | ${improvements.detectionRate > 0 ? '+' : ''}${improvements.detectionRate}% | ${improvements.detectionRate > 0 ? '✅' : '❌'} |\n`;
      report += `| False Positive Rate | ${improvements.falsePositiveRate > 0 ? '-' : '+'}${Math.abs(improvements.falsePositiveRate)}% | ${improvements.falsePositiveRate > 0 ? '✅' : '❌'} |\n`;
      report += `| Context Awareness | ${improvements.contextAwareness > 0 ? '+' : ''}${improvements.contextAwareness}% | ${improvements.contextAwareness > 0 ? '✅' : '⚠️'} |\n`;
      report += `| Response Clarity | ${improvements.responseClarity > 0 ? '+' : ''}${improvements.responseClarity}% | ${improvements.responseClarity > 0 ? '✅' : '⚠️'} |\n`;
      report += `| Alternative Suggestions | ${improvements.alternativeSuggestions > 0 ? '+' : ''}${improvements.alternativeSuggestions}% | ${improvements.alternativeSuggestions > 0 ? '✅' : '⚠️'} |\n`;
      report += `| **Overall Score** | **${improvements.overallScore > 0 ? '+' : ''}${improvements.overallScore}%** | **${improvements.overallScore > 0 ? '✅' : '❌'}** |\n\n`;
    }
    
    // Detailed A vs B test comparison
    if (oldResults.length > 0) {
      report += `### 🔍 Detailed Test Responses Comparison\n\n`;
      
      for (let i = 0; i < newResults.length; i++) {
        const oldTest = oldResults[i];
        const newTest = newResults[i];
        
        const oldStatus = oldTest.passed ? '✅ PASS' : '❌ FAIL';
        const newStatus = newTest.passed ? '✅ PASS' : '❌ FAIL';
        const changeStatus = !oldTest.passed && newTest.passed ? ' → ✅ IMPROVED' : 
                           oldTest.passed && !newTest.passed ? ' → ❌ REGRESSED' : '';
        
        report += `#### Test ${i + 1}: ${newTest.scenario}\n`;
        report += `**Input Command**: \`${newTest.input}\`\n`;
        report += `**Expected**: ${newTest.expected.type} (risk level ${newTest.expected.riskLevel})\n\n`;
        
        report += `| Aspect | Old Prompt | New Prompt |\n`;
        report += `|--------|------------|------------|\n`;
        report += `| **Result** | ${oldStatus} | ${newStatus}${changeStatus} |\n`;
        report += `| **Response** | ${oldTest.actualResponse} | ${newTest.actualResponse} |\n`;
        
        if (oldTest.analysis && newTest.analysis) {
          report += `| **Risk Assessment** | ${oldTest.analysis.hasRiskAssessment ? '✅' : '❌'} | ${newTest.analysis.hasRiskAssessment ? '✅' : '❌'} |\n`;
          report += `| **Context Aware** | ${oldTest.analysis.contextAware ? '✅' : '❌'} | ${newTest.analysis.contextAware ? '✅' : '❌'} |\n`;
          report += `| **Provides Alternative** | ${oldTest.analysis.providesAlternative ? '✅' : '❌'} | ${newTest.analysis.providesAlternative ? '✅' : '❌'} |\n`;
        }
        
        report += `\n`;
        
        // Add analysis notes for significant changes
        if (!oldTest.passed && newTest.passed) {
          report += `🎯 **Improvement**: This test now passes with the new prompt!\n\n`;
        } else if (oldTest.passed && !newTest.passed) {
          report += `⚠️ **Regression**: This test was passing but now fails.\n\n`;
        } else if (!newTest.passed) {
          report += `❌ **Still Failing**: Consider enhancing the prompt to handle this scenario.\n\n`;
        }
      }
    }
    
    // Summary of failed tests
    const failedNewTests = newResults.filter(r => !r.passed);
    const improvedTests = newResults.filter((r, i) => 
      oldResults[i] && !oldResults[i].passed && r.passed
    );
    
    if (improvedTests.length > 0) {
      report += `### ✅ Summary: Newly Passing Tests (${improvedTests.length})\n`;
      for (const test of improvedTests) {
        report += `- **${test.scenario}**: Now correctly handles "${test.input}"\n`;
      }
      report += `\n`;
    }
    
    if (failedNewTests.length > 0) {
      report += `### ❌ Summary: Still Failing Tests (${failedNewTests.length})\n`;
      for (const test of failedNewTests) {
        report += `- **${test.scenario}**: "${test.input}" (Expected: ${test.expected.type})\n`;
      }
      report += `\n`;
    }
    
    // Key observations
    report += `### 💡 Key Observations\n\n`;
    
    if (newResults.some(r => r.analysis.hasRiskAssessment)) {
      report += `✅ **Risk Assessment Framework**: The prompt implements a risk scoring system.\n\n`;
    }
    
    if (newResults.some(r => r.analysis.contextAware)) {
      report += `✅ **Context Awareness**: The prompt considers environmental context.\n\n`;
    }
    
    if (newResults.some(r => r.analysis.providesAlternative)) {
      report += `✅ **Alternative Suggestions**: The prompt provides safer alternatives.\n\n`;
    }
    
    if (failedNewTests.length > 0) {
      report += `⚠️ **Areas for Improvement**:\n`;
      report += `- Consider enhancing detection for ${failedNewTests.map(t => t.scenario).join(', ')}\n`;
      report += `- Add more specific patterns for edge cases\n\n`;
    }
    
    return report;
  }
};

module.exports = securityExpert;