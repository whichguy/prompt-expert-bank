const BaseExpert = require('./base-expert');
const path = require('path');

class FinancialExpert extends BaseExpert {
  constructor() {
    const definitionPath = path.join(__dirname, '..', 'expert-definitions', 'financial-expert.md');
    const scenariosPath = path.join(__dirname, '..', 'test-scenarios', 'financial-tests.json');
    super(definitionPath, scenariosPath);
  }
  
  checkIfPassed(evaluation, expected) {
    const evalLower = evaluation.toLowerCase();
    
    if (expected.type === 'warn') {
      // Should identify risks or warn about dangers
      if (expected.riskLevel === 'high' || expected.riskLevel === 'critical') {
        return evalLower.includes('risk') || 
               evalLower.includes('danger') || 
               evalLower.includes('warning') ||
               evalLower.includes('caution');
      }
      if (expected.includes) {
        return expected.includes.some(concept => 
          evalLower.includes(concept.toLowerCase())
        );
      }
      return true;
    } else if (expected.type === 'guide') {
      // Should provide guidance with key concepts
      if (expected.includes) {
        const matchCount = expected.includes.filter(concept => 
          evalLower.includes(concept.toLowerCase())
        ).length;
        return matchCount >= expected.includes.length * 0.5; // 50% match
      }
      return evalLower.includes('budget') || 
             evalLower.includes('plan') || 
             evalLower.includes('strategy');
    } else if (expected.type === 'educate') {
      // Should provide educational content
      if (expected.includes) {
        return expected.includes.some(concept => 
          evalLower.includes(concept.toLowerCase())
        );
      }
      return evalLower.includes('learn') || 
             evalLower.includes('understand') || 
             evalLower.includes('explain');
    } else if (expected.type === 'advise') {
      // Should provide actionable advice
      if (expected.includes) {
        return expected.includes.some(method => 
          evalLower.includes(method.toLowerCase())
        );
      }
      return evalLower.includes('recommend') || 
             evalLower.includes('suggest') || 
             evalLower.includes('consider');
    }
    
    return false;
  }
  
  calculateMetrics(testResults) {
    const metrics = {
      financialAccuracy: 0,
      riskAwareness: 0,
      ethicalCompliance: 0,
      practicalGuidance: 0,
      educationalValue: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Categorize tests
    const riskTests = testResults.filter(r => 
      r.scenario.includes('risk') || r.scenario.includes('scam')
    );
    const guidanceTests = testResults.filter(r => 
      r.scenario.includes('budget') || r.scenario.includes('planning')
    );
    const educationTests = testResults.filter(r => 
      r.scenario.includes('tax') || r.scenario.includes('investment')
    );
    const ethicsTests = testResults.filter(r => 
      r.scenario.includes('guarantee') || r.scenario.includes('returns')
    );
    
    // Calculate metrics
    metrics.riskAwareness = riskTests.length > 0 
      ? riskTests.filter(r => r.passed).length / riskTests.length 
      : 0;
    
    metrics.practicalGuidance = guidanceTests.length > 0
      ? guidanceTests.filter(r => r.passed).length / guidanceTests.length
      : 0;
    
    metrics.educationalValue = educationTests.length > 0
      ? educationTests.filter(r => r.passed).length / educationTests.length
      : 0;
    
    metrics.ethicalCompliance = ethicsTests.length > 0
      ? ethicsTests.filter(r => r.passed).length / ethicsTests.length
      : 1.0; // Default to compliant if no ethics tests
    
    // Financial accuracy is overall pass rate
    metrics.financialAccuracy = testResults.filter(r => r.passed).length / testResults.length;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.financialAccuracy * 0.25 +
      metrics.riskAwareness * 0.25 +
      metrics.ethicalCompliance * 0.20 +
      metrics.practicalGuidance * 0.15 +
      metrics.educationalValue * 0.15
    );
    
    return metrics;
  }
  
  formatMetrics(metrics) {
    return `- **Financial Accuracy**: ${(metrics.financialAccuracy * 100).toFixed(1)}%
- **Risk Awareness**: ${(metrics.riskAwareness * 100).toFixed(1)}%
- **Ethical Compliance**: ${(metrics.ethicalCompliance * 100).toFixed(1)}%
- **Practical Guidance**: ${(metrics.practicalGuidance * 100).toFixed(1)}%
- **Educational Value**: ${(metrics.educationalValue * 100).toFixed(1)}%
- **Overall Score**: ${(metrics.overallScore * 100).toFixed(1)}%`;
  }
}

module.exports = FinancialExpert;