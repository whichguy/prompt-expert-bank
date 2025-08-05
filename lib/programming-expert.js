const BaseExpert = require('./base-expert');
const path = require('path');

class ProgrammingExpert extends BaseExpert {
  constructor() {
    const definitionPath = path.join(__dirname, '..', 'expert-definitions', 'programming-expert.md');
    const scenariosPath = path.join(__dirname, '..', 'test-scenarios', 'programming-tests.json');
    super(definitionPath, scenariosPath);
  }
  
  checkIfPassed(evaluation, expected) {
    const evalLower = evaluation.toLowerCase();
    
    if (expected.type === 'warn') {
      // Should identify the security/performance issue
      if (expected.issues) {
        return expected.issues.some(issue => 
          evalLower.includes(issue.toLowerCase())
        );
      }
      return evalLower.includes('warning') || 
             evalLower.includes('issue') || 
             evalLower.includes('vulnerability');
    } else if (expected.type === 'improve') {
      // Should suggest improvements
      if (expected.suggestions) {
        return expected.suggestions.some(suggestion => 
          evalLower.includes(suggestion.toLowerCase())
        );
      }
      return evalLower.includes('improve') || 
             evalLower.includes('optimize') || 
             evalLower.includes('better');
    } else if (expected.type === 'review') {
      // Should provide code review
      return evalLower.includes('review') || 
             evalLower.includes('suggest') || 
             evalLower.includes('consider');
    } else if (expected.type === 'guide') {
      // Should provide guidance with key concepts
      if (expected.includes) {
        const matchCount = expected.includes.filter(concept => 
          evalLower.includes(concept.toLowerCase())
        ).length;
        return matchCount >= expected.includes.length * 0.6; // 60% match
      }
      return true;
    }
    
    return false;
  }
  
  calculateMetrics(testResults) {
    const metrics = {
      codeQuality: 0,
      securityAwareness: 0,
      bestPractices: 0,
      technicalAccuracy: 0,
      problemSolving: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Categorize tests
    const securityTests = testResults.filter(r => 
      r.scenario.includes('security') || r.scenario.includes('vulnerability')
    );
    const optimizationTests = testResults.filter(r => 
      r.scenario.includes('optimization') || r.scenario.includes('performance')
    );
    const practiceTests = testResults.filter(r => 
      r.scenario.includes('practices') || r.scenario.includes('design')
    );
    const problemTests = testResults.filter(r => 
      r.scenario.includes('test') || r.scenario.includes('strategy')
    );
    
    // Calculate metrics
    metrics.securityAwareness = securityTests.length > 0 
      ? securityTests.filter(r => r.passed).length / securityTests.length 
      : 0;
    
    metrics.codeQuality = optimizationTests.length > 0
      ? optimizationTests.filter(r => r.passed).length / optimizationTests.length
      : 0;
    
    metrics.bestPractices = practiceTests.length > 0
      ? practiceTests.filter(r => r.passed).length / practiceTests.length
      : 0;
    
    metrics.problemSolving = problemTests.length > 0
      ? problemTests.filter(r => r.passed).length / problemTests.length
      : 0;
    
    // Technical accuracy is overall pass rate
    metrics.technicalAccuracy = testResults.filter(r => r.passed).length / testResults.length;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.securityAwareness * 0.25 +
      metrics.codeQuality * 0.20 +
      metrics.bestPractices * 0.20 +
      metrics.technicalAccuracy * 0.20 +
      metrics.problemSolving * 0.15
    );
    
    return metrics;
  }
  
  formatMetrics(metrics) {
    return `- **Security Awareness**: ${(metrics.securityAwareness * 100).toFixed(1)}%
- **Code Quality**: ${(metrics.codeQuality * 100).toFixed(1)}%
- **Best Practices**: ${(metrics.bestPractices * 100).toFixed(1)}%
- **Technical Accuracy**: ${(metrics.technicalAccuracy * 100).toFixed(1)}%
- **Problem Solving**: ${(metrics.problemSolving * 100).toFixed(1)}%
- **Overall Score**: ${(metrics.overallScore * 100).toFixed(1)}%`;
  }
}

module.exports = ProgrammingExpert;