/**
 * General purpose expert for evaluating prompts that don't fit specific domains
 */

const path = require('path');
const fs = require('fs');

// Load test scenarios from separate file
const testScenariosPath = path.join(__dirname, '..', 'test-scenarios', 'general-tests.js');
const testData = fs.existsSync(testScenariosPath) ? require(testScenariosPath) : null;

const generalExpert = {
  name: 'General Purpose Expert',
  domain: 'general',
  description: 'Evaluates general prompts for clarity, completeness, and effectiveness',
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
      isComplete: false,
      isRelevant: false,
      isStructured: false,
      hasExamples: false,
      isActionable: false,
      showsReasoning: false,
      handlesEdgeCases: false,
      isPolite: false
    };
    
    const lowerResponse = response.toLowerCase();
    
    // Check for completeness (reasonable length and covers the topic)
    analysis.isComplete = response.length > 100 && response.length < 5000;
    
    // Check for relevance to the query
    analysis.isRelevant = this.checkRelevance(response, scenario.input);
    
    // Check for structure (paragraphs, lists, clear organization)
    analysis.isStructured = response.includes('\n\n') || response.includes('1.') || 
                           response.includes('•') || response.includes('-');
    
    // Check for examples or concrete details
    analysis.hasExamples = lowerResponse.includes('example') || lowerResponse.includes('for instance') ||
                          lowerResponse.includes('such as') || /\d+/.test(response);
    
    // Check for actionable advice
    analysis.isActionable = lowerResponse.includes('should') || lowerResponse.includes('can') ||
                           lowerResponse.includes('try') || lowerResponse.includes('consider') ||
                           lowerResponse.includes('recommend');
    
    // Check for reasoning or explanations
    analysis.showsReasoning = lowerResponse.includes('because') || lowerResponse.includes('since') ||
                             lowerResponse.includes('therefore') || lowerResponse.includes('due to');
    
    // Check for handling edge cases or limitations
    analysis.handlesEdgeCases = lowerResponse.includes('however') || lowerResponse.includes('although') ||
                               lowerResponse.includes('except') || lowerResponse.includes('unless') ||
                               lowerResponse.includes('note that');
    
    // Check for politeness and helpfulness
    analysis.isPolite = lowerResponse.includes('please') || lowerResponse.includes('thank') ||
                       lowerResponse.includes('happy to help') || !lowerResponse.includes('obviously');
    
    // Determine if passed based on expected type
    let passed = false;
    if (scenario.expected.type === 'explanation') {
      passed = analysis.isComplete && analysis.isRelevant && analysis.showsReasoning;
    } else if (scenario.expected.type === 'instruction') {
      passed = analysis.isActionable && analysis.isStructured && analysis.isComplete;
    } else if (scenario.expected.type === 'creative') {
      passed = analysis.isComplete && analysis.isRelevant && (analysis.hasExamples || analysis.isStructured);
    } else if (scenario.expected.type === 'analysis') {
      passed = analysis.showsReasoning && analysis.isStructured && analysis.handlesEdgeCases;
    }
    
    return { passed, analysis };
  },
  
  checkRelevance(response, input) {
    // Simple keyword matching for relevance
    const inputWords = input.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const responseWords = response.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of inputWords) {
      if (responseWords.some(rWord => rWord.includes(word) || word.includes(rWord))) {
        matches++;
      }
    }
    
    return matches / inputWords.length > 0.3; // At least 30% keyword overlap
  },
  
  calculateMetrics(testResults) {
    const metrics = {
      completeness: 0,
      relevance: 0,
      structure: 0,
      actionability: 0,
      reasoning: 0,
      helpfulness: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Calculate individual metrics
    const complete = testResults.filter(r => r.analysis && r.analysis.isComplete).length;
    metrics.completeness = complete / testResults.length;
    
    const relevant = testResults.filter(r => r.analysis && r.analysis.isRelevant).length;
    metrics.relevance = relevant / testResults.length;
    
    const structured = testResults.filter(r => r.analysis && r.analysis.isStructured).length;
    metrics.structure = structured / testResults.length;
    
    const actionable = testResults.filter(r => r.analysis && r.analysis.isActionable).length;
    metrics.actionability = actionable / testResults.length;
    
    const reasoning = testResults.filter(r => r.analysis && r.analysis.showsReasoning).length;
    metrics.reasoning = reasoning / testResults.length;
    
    const helpful = testResults.filter(r => r.analysis && r.analysis.isPolite).length;
    metrics.helpfulness = helpful / testResults.length;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.relevance * 0.25 +        // 25% - Must be relevant to the query
      metrics.completeness * 0.20 +     // 20% - Must provide complete information
      metrics.structure * 0.20 +        // 20% - Must be well-structured
      metrics.actionability * 0.15 +    // 15% - Must be actionable when appropriate
      metrics.reasoning * 0.15 +        // 15% - Must show reasoning
      metrics.helpfulness * 0.05        // 5% - Must be polite and helpful
    );
    
    return metrics;
  },
  
  generateReport(oldMetrics, newMetrics, oldResults, newResults) {
    let report = `### 🧪 General Purpose Evaluation\n\n`;
    
    if (oldResults.length > 0) {
      report += `#### Previous Prompt Performance\n`;
      report += `- **Relevance**: ${(oldMetrics.relevance * 100).toFixed(1)}%\n`;
      report += `- **Completeness**: ${(oldMetrics.completeness * 100).toFixed(1)}%\n`;
      report += `- **Structure**: ${(oldMetrics.structure * 100).toFixed(1)}%\n`;
      report += `- **Actionability**: ${(oldMetrics.actionability * 100).toFixed(1)}%\n`;
      report += `- **Reasoning**: ${(oldMetrics.reasoning * 100).toFixed(1)}%\n`;
      report += `- **Helpfulness**: ${(oldMetrics.helpfulness * 100).toFixed(1)}%\n`;
      report += `- **Overall Score**: ${(oldMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    }
    
    report += `#### New Prompt Performance\n`;
    report += `- **Relevance**: ${(newMetrics.relevance * 100).toFixed(1)}%\n`;
    report += `- **Completeness**: ${(newMetrics.completeness * 100).toFixed(1)}%\n`;
    report += `- **Structure**: ${(newMetrics.structure * 100).toFixed(1)}%\n`;
    report += `- **Actionability**: ${(newMetrics.actionability * 100).toFixed(1)}%\n`;
    report += `- **Reasoning**: ${(newMetrics.reasoning * 100).toFixed(1)}%\n`;
    report += `- **Helpfulness**: ${(newMetrics.helpfulness * 100).toFixed(1)}%\n`;
    report += `- **Overall Score**: ${(newMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    
    if (oldResults.length > 0) {
      report += `### 📊 Performance Comparison\n\n`;
      
      report += `| Metric | Change | Status |\n`;
      report += `|--------|--------|--------|\n`;
      
      const metrics = ['relevance', 'completeness', 'structure', 'actionability', 'reasoning', 'helpfulness'];
      const labels = ['Relevance', 'Completeness', 'Structure', 'Actionability', 'Reasoning', 'Helpfulness'];
      
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
    
    if (newMetrics.relevance > 0.8) {
      report += `✅ **Highly Relevant**: The prompt generates responses that directly address user queries.\n\n`;
    }
    
    if (newMetrics.structure > 0.7) {
      report += `✅ **Well-Structured**: The prompt produces organized, easy-to-follow responses.\n\n`;
    }
    
    if (newMetrics.reasoning > 0.7) {
      report += `✅ **Reasoning-Focused**: The prompt encourages clear explanations and logical thinking.\n\n`;
    }
    
    const failedTests = newResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      report += `⚠️ **Areas for Improvement**:\n`;
      if (newMetrics.relevance < 0.6) report += `- Improve relevance to user queries\n`;
      if (newMetrics.completeness < 0.6) report += `- Provide more complete and comprehensive responses\n`;
      if (newMetrics.structure < 0.6) report += `- Encourage better organization and structure\n`;
      if (newMetrics.actionability < 0.5) report += `- Include more actionable advice and suggestions\n`;
      report += `\n`;
    }
    
    return report;
  }
};

module.exports = generalExpert;