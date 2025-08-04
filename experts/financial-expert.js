/**
 * Financial analysis expert for evaluating financial advice and calculation prompts
 */

const path = require('path');
const fs = require('fs');

// Load test scenarios from separate file
const testScenariosPath = path.join(__dirname, '..', 'test-scenarios', 'financial-tests.js');
const testData = fs.existsSync(testScenariosPath) ? require(testScenariosPath) : null;

const financialExpert = {
  name: 'Financial Analysis Expert',
  domain: 'financial',
  description: 'Evaluates prompts that provide financial advice, calculations, or investment guidance',
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
    
    // Determine recommendation - NEVER NEUTRAL
    const improvement = oldPrompt ? newMetrics.overallScore - oldMetrics.overallScore : 0;
    let recommendation;
    
    if (improvement > 0.05) {
      // Any meaningful improvement warrants approval
      recommendation = 'APPROVE';
    } else if (improvement < -0.05) {
      // Any decline warrants changes
      recommendation = 'REQUEST_CHANGES';
    } else if (!oldPrompt) {
      // New prompts: approve if decent, request changes if poor
      recommendation = newMetrics.overallScore >= 0.65 ? 'APPROVE' : 'REQUEST_CHANGES';
    } else {
      // Existing prompts with minimal change: lean toward current state
      // But still make a decision - approve if good, request changes if poor
      recommendation = newMetrics.overallScore >= 0.65 ? 'APPROVE' : 'REQUEST_CHANGES';
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
      hasCalculations: false,
      showsFormulas: false,
      includesRiskWarning: false,
      providesDisclaimer: false,
      explainsConcepts: false,
      usesRealNumbers: false,
      considersTimeValue: false,
      mentionsTaxes: false
    };
    
    const lowerResponse = response.toLowerCase();
    
    // Check for calculations and numbers
    analysis.hasCalculations = /\d+[\.,]\d+|\d{3,}|%|\$/.test(response);
    
    // Check for formulas
    analysis.showsFormulas = response.includes('=') || response.includes('×') || 
                            response.includes('*') || lowerResponse.includes('formula');
    
    // Check for risk warnings
    analysis.includesRiskWarning = lowerResponse.includes('risk') || lowerResponse.includes('volatil') || 
                                  lowerResponse.includes('loss') || lowerResponse.includes('careful');
    
    // Check for disclaimer
    analysis.providesDisclaimer = lowerResponse.includes('not financial advice') || 
                                 lowerResponse.includes('consult') || lowerResponse.includes('professional');
    
    // Check for explanations
    analysis.explainsConcepts = lowerResponse.includes('because') || lowerResponse.includes('this means') || 
                               lowerResponse.includes('in other words') || lowerResponse.includes('for example');
    
    // Check for real numbers
    analysis.usesRealNumbers = /\$[\d,]+|\d+%|[\d,]+\.\d{2}/.test(response);
    
    // Check for time value considerations
    analysis.considersTimeValue = lowerResponse.includes('year') || lowerResponse.includes('month') || 
                                 lowerResponse.includes('compound') || lowerResponse.includes('interest');
    
    // Check for tax considerations
    analysis.mentionsTaxes = lowerResponse.includes('tax') || lowerResponse.includes('after-tax') || 
                            lowerResponse.includes('deduct');
    
    // Determine if passed based on expected type
    let passed = false;
    if (scenario.expected.type === 'calculation') {
      passed = analysis.hasCalculations && analysis.showsFormulas;
    } else if (scenario.expected.type === 'advice') {
      passed = analysis.explainsConcepts && analysis.includesRiskWarning;
    } else if (scenario.expected.type === 'investment') {
      passed = analysis.hasCalculations && analysis.includesRiskWarning && analysis.considersTimeValue;
    } else if (scenario.expected.type === 'tax') {
      passed = analysis.mentionsTaxes && analysis.hasCalculations;
    }
    
    return { passed, analysis };
  },
  
  calculateMetrics(testResults) {
    const metrics = {
      calculationAccuracy: 0,
      riskAwareness: 0,
      conceptExplanation: 0,
      practicalApplicability: 0,
      disclaimerCompliance: 0,
      comprehensiveness: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Calculate individual metrics
    const hasCalculations = testResults.filter(r => r.analysis && r.analysis.hasCalculations).length;
    metrics.calculationAccuracy = hasCalculations / testResults.length;
    
    const hasRiskWarnings = testResults.filter(r => r.analysis && r.analysis.includesRiskWarning).length;
    metrics.riskAwareness = hasRiskWarnings / testResults.length;
    
    const explainsConcepts = testResults.filter(r => r.analysis && r.analysis.explainsConcepts).length;
    metrics.conceptExplanation = explainsConcepts / testResults.length;
    
    const usesRealNumbers = testResults.filter(r => r.analysis && r.analysis.usesRealNumbers).length;
    metrics.practicalApplicability = usesRealNumbers / testResults.length;
    
    const hasDisclaimers = testResults.filter(r => r.analysis && r.analysis.providesDisclaimer).length;
    metrics.disclaimerCompliance = hasDisclaimers / testResults.length;
    
    // Comprehensiveness based on multiple factors
    const comprehensive = testResults.filter(r => {
      if (!r.analysis) return false;
      let factors = 0;
      if (r.analysis.hasCalculations) factors++;
      if (r.analysis.includesRiskWarning) factors++;
      if (r.analysis.explainsConcepts) factors++;
      if (r.analysis.considersTimeValue) factors++;
      return factors >= 3;
    }).length;
    metrics.comprehensiveness = comprehensive / testResults.length;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.calculationAccuracy * 0.30 +     // 30% - Must provide accurate calculations
      metrics.riskAwareness * 0.25 +          // 25% - Must discuss risks
      metrics.conceptExplanation * 0.20 +      // 20% - Must explain concepts clearly
      metrics.practicalApplicability * 0.15 +  // 15% - Must use real examples
      metrics.disclaimerCompliance * 0.10     // 10% - Must include appropriate disclaimers
    );
    
    return metrics;
  },
  
  generateReport(oldMetrics, newMetrics, oldResults, newResults) {
    let report = `### 🧪 Financial Analysis Evaluation\n\n`;
    
    if (oldResults.length > 0) {
      report += `#### Previous Prompt Performance\n`;
      report += `- **Calculation Accuracy**: ${(oldMetrics.calculationAccuracy * 100).toFixed(1)}%\n`;
      report += `- **Risk Awareness**: ${(oldMetrics.riskAwareness * 100).toFixed(1)}%\n`;
      report += `- **Concept Explanation**: ${(oldMetrics.conceptExplanation * 100).toFixed(1)}%\n`;
      report += `- **Practical Applicability**: ${(oldMetrics.practicalApplicability * 100).toFixed(1)}%\n`;
      report += `- **Disclaimer Compliance**: ${(oldMetrics.disclaimerCompliance * 100).toFixed(1)}%\n`;
      report += `- **Comprehensiveness**: ${(oldMetrics.comprehensiveness * 100).toFixed(1)}%\n`;
      report += `- **Overall Score**: ${(oldMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    }
    
    report += `#### New Prompt Performance\n`;
    report += `- **Calculation Accuracy**: ${(newMetrics.calculationAccuracy * 100).toFixed(1)}%\n`;
    report += `- **Risk Awareness**: ${(newMetrics.riskAwareness * 100).toFixed(1)}%\n`;
    report += `- **Concept Explanation**: ${(newMetrics.conceptExplanation * 100).toFixed(1)}%\n`;
    report += `- **Practical Applicability**: ${(newMetrics.practicalApplicability * 100).toFixed(1)}%\n`;
    report += `- **Disclaimer Compliance**: ${(newMetrics.disclaimerCompliance * 100).toFixed(1)}%\n`;
    report += `- **Comprehensiveness**: ${(newMetrics.comprehensiveness * 100).toFixed(1)}%\n`;
    report += `- **Overall Score**: ${(newMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    
    if (oldResults.length > 0) {
      report += `### 📊 Performance Comparison\n\n`;
      
      report += `| Metric | Change | Status |\n`;
      report += `|--------|--------|--------|\n`;
      
      const metrics = ['calculationAccuracy', 'riskAwareness', 'conceptExplanation', 
                      'practicalApplicability', 'disclaimerCompliance'];
      const labels = ['Calculation Accuracy', 'Risk Awareness', 'Concept Explanation', 
                     'Practical Applicability', 'Disclaimer Compliance'];
      
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
    
    if (newMetrics.calculationAccuracy > 0.8) {
      report += `✅ **Strong Calculations**: The prompt provides accurate financial calculations.\n\n`;
    }
    
    if (newMetrics.riskAwareness > 0.7) {
      report += `✅ **Risk Conscious**: The prompt appropriately discusses financial risks.\n\n`;
    }
    
    if (newMetrics.disclaimerCompliance > 0.6) {
      report += `✅ **Compliance Aware**: The prompt includes appropriate disclaimers.\n\n`;
    }
    
    const failedTests = newResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      report += `⚠️ **Areas for Improvement**:\n`;
      if (newMetrics.calculationAccuracy < 0.6) report += `- Include more detailed calculations and formulas\n`;
      if (newMetrics.riskAwareness < 0.5) report += `- Add risk warnings and volatility discussions\n`;
      if (newMetrics.conceptExplanation < 0.5) report += `- Provide clearer explanations of financial concepts\n`;
      report += `\n`;
    }
    
    return report;
  }
};

module.exports = financialExpert;