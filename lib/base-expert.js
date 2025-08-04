const fs = require('fs');
const path = require('path');

class BaseExpert {
  constructor(expertDefinitionPath, testScenariosPath) {
    // Load expert definition from markdown
    this.definition = this.loadExpertDefinition(expertDefinitionPath);
    
    // Load test scenarios
    this.testScenarios = this.loadTestScenarios(testScenariosPath);
    
    // Extract metadata from definition
    this.parseMetadata();
  }
  
  loadExpertDefinition(definitionPath) {
    try {
      return fs.readFileSync(definitionPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to load expert definition: ${error.message}`);
    }
  }
  
  loadTestScenarios(scenariosPath) {
    try {
      const scenariosContent = fs.readFileSync(scenariosPath, 'utf-8');
      return JSON.parse(scenariosContent);
    } catch (error) {
      throw new Error(`Failed to load test scenarios: ${error.message}`);
    }
  }
  
  parseMetadata() {
    // Extract metadata from markdown frontmatter
    const metadataMatch = this.definition.match(/^---\n([\s\S]*?)\n---/);
    if (metadataMatch) {
      const metadataLines = metadataMatch[1].split('\n');
      this.metadata = {};
      
      metadataLines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          this.metadata[key.trim()] = valueParts.join(':').trim();
        }
      });
      
      // Remove frontmatter from definition
      this.expertPrompt = this.definition.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
    } else {
      this.metadata = {};
      this.expertPrompt = this.definition.trim();
    }
    
    // Set properties from metadata
    this.name = this.metadata.name || 'Unknown Expert';
    this.domain = this.metadata.domain || 'general';
    this.description = this.metadata.description || '';
  }
  
  async evaluatePrompts(oldPrompt, newPrompt, anthropic) {
    // Test both prompts
    const oldResults = oldPrompt ? await this.testPrompt(oldPrompt, anthropic) : [];
    const newResults = await this.testPrompt(newPrompt, anthropic);
    
    // Calculate metrics
    const oldMetrics = oldPrompt ? this.calculateMetrics(oldResults) : {};
    const newMetrics = this.calculateMetrics(newResults);
    
    // Generate comprehensive report
    const report = this.generateReport(oldMetrics, newMetrics, oldResults, newResults);
    
    // Determine recommendation - NEVER NEUTRAL
    const recommendation = this.determineRecommendation(oldMetrics, newMetrics, oldPrompt);
    const improvement = oldPrompt ? newMetrics.overallScore - oldMetrics.overallScore : 0;
    
    return {
      report,
      recommendation,
      improvement: improvement * 100,
      metrics: {
        old: oldMetrics,
        new: newMetrics
      }
    };
  }
  
  async testPrompt(userPrompt, anthropic) {
    const results = [];
    
    for (const scenario of this.testScenarios.scenarios) {
      try {
        // Create conversation with expert as system prompt
        const response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1000,
          system: this.expertPrompt,
          messages: [
            {
              role: 'user',
              content: `Evaluate the following prompt for ${this.domain} effectiveness:\n\n${userPrompt}\n\nTest scenario: ${scenario.input}`
            }
          ]
        });
        
        const responseText = response.content[0].text;
        const evaluation = this.parseEvaluation(responseText);
        
        results.push({
          scenario: scenario.name,
          input: scenario.input,
          expected: scenario.expected,
          evaluation: evaluation,
          rawResponse: responseText,
          passed: this.checkIfPassed(evaluation, scenario.expected)
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
  }
  
  parseEvaluation(response) {
    // Parse structured evaluation from expert response
    const evaluation = {
      score: 0,
      passed: false,
      feedback: '',
      riskLevel: null,
      recommendations: []
    };
    
    // Extract score
    const scoreMatch = response.match(/score[:\s]+(\d+(?:\.\d+)?)/i);
    if (scoreMatch) {
      evaluation.score = parseFloat(scoreMatch[1]);
    }
    
    // Extract pass/fail
    evaluation.passed = response.toLowerCase().includes('pass') || 
                       response.toLowerCase().includes('approve') ||
                       evaluation.score >= 7;
    
    // Extract risk level
    const riskMatch = response.match(/risk[:\s]+(\d+)/i);
    if (riskMatch) {
      evaluation.riskLevel = parseInt(riskMatch[1]);
    }
    
    // Extract recommendations
    const recMatch = response.match(/recommendations?:([\s\S]*?)(?:\n\n|$)/i);
    if (recMatch) {
      evaluation.recommendations = recMatch[1]
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^[-*]\s*/, '').trim());
    }
    
    evaluation.feedback = response;
    
    return evaluation;
  }
  
  checkIfPassed(evaluation, expected) {
    // Override this method in specific expert implementations
    return evaluation.passed;
  }
  
  calculateMetrics(testResults) {
    // Override this method in specific expert implementations
    const metrics = {
      overallScore: 0,
      passRate: 0,
      averageScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    const passedCount = testResults.filter(r => r.passed).length;
    metrics.passRate = passedCount / testResults.length;
    
    const scores = testResults
      .filter(r => r.evaluation && typeof r.evaluation.score === 'number')
      .map(r => r.evaluation.score);
    
    if (scores.length > 0) {
      metrics.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    
    metrics.overallScore = (metrics.passRate * 0.7 + metrics.averageScore / 10 * 0.3);
    
    return metrics;
  }
  
  generateReport(oldMetrics, newMetrics, oldResults, newResults) {
    let report = `### 🧪 ${this.name} Evaluation\n\n`;
    report += `${this.description}\n\n`;
    
    if (oldResults.length > 0) {
      report += `#### Previous Prompt Performance\n`;
      report += this.formatMetrics(oldMetrics);
      report += `\n`;
    }
    
    report += `#### New Prompt Performance\n`;
    report += this.formatMetrics(newMetrics);
    report += `\n`;
    
    // Performance comparison
    if (oldResults.length > 0) {
      report += `### 📊 Performance Comparison\n\n`;
      report += this.generateComparison(oldMetrics, newMetrics);
    }
    
    // Detailed test results
    report += `### 🔍 Detailed Test Results\n\n`;
    report += this.formatTestResults(newResults, oldResults);
    
    return report;
  }
  
  formatMetrics(metrics) {
    return Object.entries(metrics)
      .map(([key, value]) => {
        const displayName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const percentage = typeof value === 'number' ? (value * 100).toFixed(1) : value;
        return `- **${displayName}**: ${percentage}%`;
      })
      .join('\n');
  }
  
  generateComparison(oldMetrics, newMetrics) {
    let comparison = `| Metric | Old | New | Change |\n`;
    comparison += `|--------|-----|-----|--------|\n`;
    
    Object.keys(newMetrics).forEach(key => {
      const oldValue = (oldMetrics[key] * 100).toFixed(1);
      const newValue = (newMetrics[key] * 100).toFixed(1);
      const change = (newMetrics[key] - oldMetrics[key]) * 100;
      const changeStr = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
      const emoji = change > 0 ? '✅' : change < 0 ? '❌' : '➖';
      
      comparison += `| ${key} | ${oldValue}% | ${newValue}% | ${changeStr} ${emoji} |\n`;
    });
    
    return comparison;
  }
  
  formatTestResults(newResults, oldResults = []) {
    let formatted = '';
    
    newResults.forEach((result, index) => {
      const oldResult = oldResults[index];
      formatted += `#### Test ${index + 1}: ${result.scenario}\n`;
      formatted += `**Input**: \`${result.input}\`\n`;
      formatted += `**Expected**: ${JSON.stringify(result.expected)}\n\n`;
      
      if (oldResult) {
        formatted += `| | Old Prompt | New Prompt |\n`;
        formatted += `|---|------------|------------|\n`;
        formatted += `| **Result** | ${oldResult.passed ? '✅ PASS' : '❌ FAIL'} | ${result.passed ? '✅ PASS' : '❌ FAIL'} |\n`;
        formatted += `| **Score** | ${oldResult.evaluation?.score || 'N/A'} | ${result.evaluation?.score || 'N/A'} |\n`;
      } else {
        formatted += `**Result**: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`;
        formatted += `**Score**: ${result.evaluation?.score || 'N/A'}\n`;
      }
      
      if (result.evaluation?.recommendations?.length > 0) {
        formatted += `\n**Recommendations**:\n`;
        result.evaluation.recommendations.forEach(rec => {
          formatted += `- ${rec}\n`;
        });
      }
      
      formatted += `\n`;
    });
    
    return formatted;
  }
  
  determineRecommendation(oldMetrics, newMetrics, oldPrompt) {
    const improvement = oldPrompt ? newMetrics.overallScore - oldMetrics.overallScore : 0;
    
    if (improvement > 0.05) {
      return 'APPROVE';
    } else if (improvement < -0.05) {
      return 'REQUEST_CHANGES';
    } else if (!oldPrompt) {
      return newMetrics.overallScore >= 0.65 ? 'APPROVE' : 'REQUEST_CHANGES';
    } else {
      return newMetrics.overallScore >= 0.65 ? 'APPROVE' : 'REQUEST_CHANGES';
    }
  }
}

module.exports = BaseExpert;