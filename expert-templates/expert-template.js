/**
 * Template for creating new domain expert modules
 * Copy this file to experts/[domain]-expert.js and customize
 */

const domainExpert = {
  name: 'Domain Expert Name',
  domain: 'domain-name',
  description: 'Expert for evaluating [domain] prompts',
  
  // Define test scenarios specific to your domain
  testScenarios: [
    {
      name: "scenario-1",
      input: "User input that tests a specific capability",
      expected: {
        // Define what you expect the prompt to produce
        type: "expected-behavior", // e.g., "correct", "safe", "accurate"
        // Add other domain-specific expectations
      }
    },
    {
      name: "scenario-2",
      input: "Another test case",
      expected: {
        type: "expected-behavior",
        // Domain-specific expectations
      }
    }
    // Add more scenarios as needed
  ],
  
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
    // TODO: Implement domain-specific evaluation logic
    // Example: Check if response contains expected keywords, patterns, etc.
    const lowerResponse = response.toLowerCase();
    
    // This is a simple example - customize for your domain
    if (scenario.expected.type === 'correct') {
      // Check for correctness indicators
      return true; // Implement actual logic
    }
    
    return false;
  },
  
  analyzeResponse(response, scenario) {
    // TODO: Implement domain-specific analysis
    const analysis = {
      // Define domain-specific analysis properties
      quality: 'unknown',
      completeness: false,
      accuracy: false
    };
    
    // Analyze the response based on your domain criteria
    
    return analysis;
  },
  
  calculateMetrics(testResults) {
    // TODO: Define domain-specific metrics
    const metrics = {
      // Example metrics - customize for your domain
      accuracy: 0,
      completeness: 0,
      relevance: 0,
      clarity: 0,
      overallScore: 0
    };
    
    // Calculate metrics based on test results
    // Example:
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    
    if (total > 0) {
      metrics.accuracy = passed / total;
      // Calculate other metrics...
      
      // Calculate weighted overall score
      metrics.overallScore = (
        metrics.accuracy * 0.4 +
        metrics.completeness * 0.3 +
        metrics.relevance * 0.2 +
        metrics.clarity * 0.1
      );
    }
    
    return metrics;
  },
  
  generateReport(oldMetrics, newMetrics, oldResults, newResults) {
    let report = `### 🧪 ${this.name} Evaluation\n\n`;
    
    if (oldResults.length > 0) {
      report += `#### Previous Prompt Performance\n`;
      // Add metrics display
      report += `- **Accuracy**: ${(oldMetrics.accuracy * 100).toFixed(1)}%\n`;
      // Add other metrics...
      report += `- **Overall Score**: ${(oldMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    }
    
    report += `#### New Prompt Performance\n`;
    report += `- **Accuracy**: ${(newMetrics.accuracy * 100).toFixed(1)}%\n`;
    // Add other metrics...
    report += `- **Overall Score**: ${(newMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    
    // Add comparison if applicable
    if (oldResults.length > 0) {
      report += `### 📊 Performance Comparison\n\n`;
      const improvement = ((newMetrics.overallScore - oldMetrics.overallScore) * 100).toFixed(1);
      report += `Overall improvement: ${improvement > 0 ? '+' : ''}${improvement}%\n\n`;
    }
    
    // Add test case details
    const failedTests = newResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      report += `#### ❌ Failed Tests (${failedTests.length})\n`;
      for (const test of failedTests) {
        report += `- **${test.scenario}**: "${test.input}"\n`;
      }
    }
    
    return report;
  }
};

module.exports = domainExpert;