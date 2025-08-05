const BaseExpert = require('./base-expert');
const path = require('path');

class GeneralExpert extends BaseExpert {
  constructor() {
    const definitionPath = path.join(__dirname, '..', 'expert-definitions', 'general-expert.md');
    const scenariosPath = path.join(__dirname, '..', 'test-scenarios', 'general-tests.json');
    super(definitionPath, scenariosPath);
  }
  
  checkIfPassed(evaluation, expected) {
    const evalLower = evaluation.toLowerCase();
    
    if (expected.type === 'explanation') {
      // Should provide clear explanations with reasoning
      if (expected.includes) {
        return expected.includes.some(concept => 
          evalLower.includes(concept.toLowerCase())
        );
      }
      return evalLower.includes('because') || 
             evalLower.includes('therefore') || 
             evalLower.includes('explain');
    } else if (expected.type === 'instruction') {
      // Should provide actionable instructions
      if (expected.includes) {
        const matchCount = expected.includes.filter(step => 
          evalLower.includes(step.toLowerCase())
        ).length;
        return matchCount >= expected.includes.length * 0.5; // 50% match for steps
      }
      return evalLower.includes('step') || 
             evalLower.includes('should') || 
             evalLower.includes('can');
    } else if (expected.type === 'creative') {
      // Should demonstrate creativity
      if (expected.includes) {
        return expected.includes.some(element => 
          evalLower.includes(element.toLowerCase())
        );
      }
      return evalLower.includes('creative') || 
             evalLower.includes('idea') || 
             evalLower.includes('imagine');
    } else if (expected.type === 'analysis') {
      // Should provide analytical thinking
      if (expected.includes) {
        return expected.includes.some(aspect => 
          evalLower.includes(aspect.toLowerCase())
        );
      }
      return evalLower.includes('analyze') || 
             evalLower.includes('consider') || 
             evalLower.includes('however');
    }
    
    return false;
  }
  
  calculateMetrics(testResults) {
    const metrics = {
      clarity: 0,
      completeness: 0,
      helpfulness: 0,
      reasoning: 0,
      engagement: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Categorize tests
    const explanationTests = testResults.filter(r => 
      r.scenario.includes('explain') || r.scenario.includes('what')
    );
    const instructionTests = testResults.filter(r => 
      r.scenario.includes('how') || r.scenario.includes('step')
    );
    const creativeTests = testResults.filter(r => 
      r.scenario.includes('creative') || r.scenario.includes('idea')
    );
    const analysisTests = testResults.filter(r => 
      r.scenario.includes('analyze') || r.scenario.includes('compare')
    );
    
    // Calculate metrics based on test categories
    metrics.clarity = explanationTests.length > 0 
      ? explanationTests.filter(r => r.passed).length / explanationTests.length 
      : 0;
    
    metrics.helpfulness = instructionTests.length > 0
      ? instructionTests.filter(r => r.passed).length / instructionTests.length
      : 0;
    
    metrics.engagement = creativeTests.length > 0
      ? creativeTests.filter(r => r.passed).length / creativeTests.length
      : 0;
    
    metrics.reasoning = analysisTests.length > 0
      ? analysisTests.filter(r => r.passed).length / analysisTests.length
      : 0;
    
    // Completeness is overall pass rate
    metrics.completeness = testResults.filter(r => r.passed).length / testResults.length;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.clarity * 0.25 +
      metrics.completeness * 0.20 +
      metrics.helpfulness * 0.20 +
      metrics.reasoning * 0.20 +
      metrics.engagement * 0.15
    );
    
    return metrics;
  }
  
  formatMetrics(metrics) {
    return `- **Clarity**: ${(metrics.clarity * 100).toFixed(1)}%
- **Completeness**: ${(metrics.completeness * 100).toFixed(1)}%
- **Helpfulness**: ${(metrics.helpfulness * 100).toFixed(1)}%
- **Reasoning**: ${(metrics.reasoning * 100).toFixed(1)}%
- **Engagement**: ${(metrics.engagement * 100).toFixed(1)}%
- **Overall Score**: ${(metrics.overallScore * 100).toFixed(1)}%`;
  }
}

module.exports = GeneralExpert;