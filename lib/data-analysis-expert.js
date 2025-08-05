const BaseExpert = require('./base-expert');
const path = require('path');

class DataAnalysisExpert extends BaseExpert {
  constructor() {
    const definitionPath = path.join(__dirname, '..', 'expert-definitions', 'data-analysis-expert.md');
    const scenariosPath = path.join(__dirname, '..', 'test-scenarios', 'data-analysis-tests.json');
    super(definitionPath, scenariosPath);
  }
  
  checkIfPassed(evaluation, expected) {
    const evalLower = evaluation.toLowerCase();
    
    if (expected.type === 'guide') {
      // Should provide guidance with key concepts
      if (expected.includes) {
        const matchCount = expected.includes.filter(concept => 
          evalLower.includes(concept.toLowerCase())
        ).length;
        return matchCount >= expected.includes.length * 0.5; // 50% match for data concepts
      }
      return evalLower.includes('approach') || 
             evalLower.includes('method') || 
             evalLower.includes('strategy');
    } else if (expected.type === 'recommend') {
      // Should recommend specific methods/tools
      if (expected.includes) {
        return expected.includes.some(method => 
          evalLower.includes(method.toLowerCase())
        );
      }
      return evalLower.includes('recommend') || 
             evalLower.includes('suggest') || 
             evalLower.includes('use');
    } else if (expected.type === 'secure') {
      // Should address privacy/security
      if (expected.includes) {
        return expected.includes.some(security => 
          evalLower.includes(security.toLowerCase())
        );
      }
      return evalLower.includes('privacy') || 
             evalLower.includes('secure') || 
             evalLower.includes('protect');
    } else if (expected.type === 'optimize') {
      // Should suggest optimization
      if (expected.includes) {
        return expected.includes.some(optimization => 
          evalLower.includes(optimization.toLowerCase())
        );
      }
      return evalLower.includes('optimize') || 
             evalLower.includes('improve') || 
             evalLower.includes('faster');
    }
    
    return false;
  }
  
  calculateMetrics(testResults) {
    const metrics = {
      dataHandling: 0,
      statisticalRigor: 0,
      visualizationQuality: 0,
      privacyAwareness: 0,
      insightGeneration: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Categorize tests
    const dataTests = testResults.filter(r => 
      r.scenario.includes('cleaning') || r.scenario.includes('missing')
    );
    const statsTests = testResults.filter(r => 
      r.scenario.includes('statistical') || r.scenario.includes('test')
    );
    const vizTests = testResults.filter(r => 
      r.scenario.includes('visualiz') || r.scenario.includes('chart')
    );
    const privacyTests = testResults.filter(r => 
      r.scenario.includes('privacy') || r.scenario.includes('protect')
    );
    const performanceTests = testResults.filter(r => 
      r.scenario.includes('performance') || r.scenario.includes('slow')
    );
    
    // Calculate metrics
    metrics.dataHandling = dataTests.length > 0 
      ? dataTests.filter(r => r.passed).length / dataTests.length 
      : 0;
    
    metrics.statisticalRigor = statsTests.length > 0
      ? statsTests.filter(r => r.passed).length / statsTests.length
      : 0;
    
    metrics.visualizationQuality = vizTests.length > 0
      ? vizTests.filter(r => r.passed).length / vizTests.length
      : 0;
    
    metrics.privacyAwareness = privacyTests.length > 0
      ? privacyTests.filter(r => r.passed).length / privacyTests.length
      : 0;
    
    // Insight generation is based on performance tests and overall quality
    const performanceScore = performanceTests.length > 0
      ? performanceTests.filter(r => r.passed).length / performanceTests.length
      : 0;
    
    metrics.insightGeneration = (performanceScore + 
      testResults.filter(r => r.passed).length / testResults.length) / 2;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.dataHandling * 0.25 +
      metrics.statisticalRigor * 0.20 +
      metrics.visualizationQuality * 0.20 +
      metrics.privacyAwareness * 0.20 +
      metrics.insightGeneration * 0.15
    );
    
    return metrics;
  }
  
  formatMetrics(metrics) {
    return `- **Data Handling**: ${(metrics.dataHandling * 100).toFixed(1)}%
- **Statistical Rigor**: ${(metrics.statisticalRigor * 100).toFixed(1)}%
- **Visualization Quality**: ${(metrics.visualizationQuality * 100).toFixed(1)}%
- **Privacy Awareness**: ${(metrics.privacyAwareness * 100).toFixed(1)}%
- **Insight Generation**: ${(metrics.insightGeneration * 100).toFixed(1)}%
- **Overall Score**: ${(metrics.overallScore * 100).toFixed(1)}%`;
  }
}

module.exports = DataAnalysisExpert;