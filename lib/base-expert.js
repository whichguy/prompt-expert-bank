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
      overallScore: 0,
      passed: false,
      recommendation: 'REQUEST_CHANGES',
      feedback: '',
      scores: {},
      testResults: [],
      observations: [],
      recommendations: []
    };
    
    // Extract weighted overall score
    const overallScoreMatch = response.match(/weighted overall score[:\s]+(\d+(?:\.\d+)?)/i);
    if (overallScoreMatch) {
      evaluation.overallScore = parseFloat(overallScoreMatch[1]);
    }
    
    // Extract pass/fail result
    const resultMatch = response.match(/result[:\s]+(pass|fail)/i);
    if (resultMatch) {
      evaluation.passed = resultMatch[1].toLowerCase() === 'pass';
    }
    
    // Extract recommendation
    const recommendationMatch = response.match(/recommendation[:\s]+(approve|request_changes)/i);
    if (recommendationMatch) {
      evaluation.recommendation = recommendationMatch[1].toUpperCase();
    }
    
    // Extract individual scores
    const scoreMatches = response.match(/(\w+(?:\s+\w+)*)\s+score[:\s]+(\d+(?:\.\d+)?)/gi);
    if (scoreMatches) {
      scoreMatches.forEach(match => {
        const [, category, score] = match.match(/(\w+(?:\s+\w+)*)\s+score[:\s]+(\d+(?:\.\d+)?)/i);
        evaluation.scores[category.toLowerCase().replace(/\s+/g, '')] = parseFloat(score);
      });
    }
    
    // Extract test scenario results
    const testSectionMatch = response.match(/test scenario analysis([\s\S]*?)(?=###|$)/i);
    if (testSectionMatch) {
      const testLines = testSectionMatch[1].split('\n').filter(line => line.trim());
      let currentTest = {};
      
      testLines.forEach(line => {
        const scenarioMatch = line.match(/scenario[:\s]+(.+)/i);
        const resultMatch = line.match(/result[:\s]+(pass|fail)/i);
        
        if (scenarioMatch) {
          if (currentTest.scenario) {
            evaluation.testResults.push(currentTest);
          }
          currentTest = { scenario: scenarioMatch[1].trim() };
        } else if (resultMatch && currentTest.scenario) {
          currentTest.passed = resultMatch[1].toLowerCase() === 'pass';
        }
      });
      
      if (currentTest.scenario) {
        evaluation.testResults.push(currentTest);
      }
    }
    
    // Extract key observations
    const observationsMatch = response.match(/key observations([\s\S]*?)(?=###|$)/i);
    if (observationsMatch) {
      evaluation.observations = observationsMatch[1]
        .split('\n')
        .filter(line => line.trim() && (line.includes('•') || line.includes('-')))
        .map(line => line.replace(/^[-•*]\s*/, '').trim());
    }
    
    // Extract recommendations
    const recMatch = response.match(/recommendations([\s\S]*?)(?=###|$)/i);
    if (recMatch) {
      evaluation.recommendations = recMatch[1]
        .split('\n')
        .filter(line => line.trim() && (line.includes('•') || line.includes('-')))
        .map(line => line.replace(/^[-•*]\s*/, '').trim());
    }
    
    evaluation.feedback = response;
    
    return evaluation;
  }
  
  checkIfPassed(evaluation, expected) {
    // Use the expert's own evaluation - no domain-specific logic needed
    return evaluation.passed;
  }
  
  calculateMetrics(testResults) {
    // Extract metrics from expert evaluations
    const metrics = {
      overallScore: 0,
      passRate: 0,
      averageScore: 0,
      categoryScores: {}
    };
    
    if (testResults.length === 0) return metrics;
    
    // Calculate pass rate from test results
    const passedCount = testResults.filter(r => r.passed).length;
    metrics.passRate = passedCount / testResults.length;
    
    // Extract scores from evaluations
    const evaluations = testResults
      .filter(r => r.evaluation && typeof r.evaluation.overallScore === 'number')
      .map(r => r.evaluation);
    
    if (evaluations.length > 0) {
      // Average the overall scores
      metrics.averageScore = evaluations.reduce((sum, evaluation) => sum + evaluation.overallScore, 0) / evaluations.length;
      metrics.overallScore = metrics.averageScore / 10; // Normalize to 0-1 scale
      
      // Store the most recent evaluation for recommendation extraction
      metrics.lastEvaluation = evaluations[evaluations.length - 1];
      
      // Aggregate category scores
      const allCategories = new Set();
      evaluations.forEach(evaluation => {
        Object.keys(evaluation.scores || {}).forEach(category => allCategories.add(category));
      });
      
      allCategories.forEach(category => {
        const categoryScores = evaluations
          .filter(evaluation => evaluation.scores && evaluation.scores[category])
          .map(evaluation => evaluation.scores[category]);
        
        if (categoryScores.length > 0) {
          metrics.categoryScores[category] = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
        }
      });
    } else {
      // Fallback to pass rate if no detailed scores available
      metrics.overallScore = metrics.passRate;
    }
    
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
    // Use the expert's own recommendation from the most recent evaluation
    // But still apply some business logic for comparison scenarios
    
    // If we have test results with evaluations, use the expert's recommendation
    const lastEvaluation = newMetrics.lastEvaluation;
    if (lastEvaluation && lastEvaluation.recommendation) {
      return lastEvaluation.recommendation;
    }
    
    // Fallback to score-based logic
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