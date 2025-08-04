/**
 * Security Expert - Evaluates security-related prompts
 * Specializes in assessing risk detection, false positive rates, and security coverage
 */

const { Anthropic } = require('@anthropic-ai/sdk');

class SecurityExpert {
  constructor(apiKey) {
    this.anthropic = new Anthropic({ apiKey });
    this.name = "Security Domain Expert";
    this.expertise = ["command injection", "privilege escalation", "data exposure", "context awareness"];
  }

  /**
   * Evaluate security prompts by comparing their effectiveness
   */
  async evaluatePrompts(oldPrompt, newPrompt, testScenarios) {
    const results = {
      expert: this.name,
      timestamp: new Date().toISOString(),
      comparison: {},
      recommendation: null,
      metrics: {}
    };

    // Test both prompts against scenarios
    const oldResults = await this.testPrompt(oldPrompt, testScenarios);
    const newResults = await this.testPrompt(newPrompt, testScenarios);

    // Calculate metrics
    results.metrics = {
      oldPrompt: this.calculateMetrics(oldResults),
      newPrompt: this.calculateMetrics(newResults),
      improvement: {}
    };

    // Calculate improvements
    for (const metric in results.metrics.oldPrompt) {
      const oldValue = results.metrics.oldPrompt[metric];
      const newValue = results.metrics.newPrompt[metric];
      results.metrics.improvement[metric] = {
        absolute: newValue - oldValue,
        percentage: ((newValue - oldValue) / oldValue * 100).toFixed(2) + '%'
      };
    }

    // Generate detailed comparison
    results.comparison = await this.generateComparison(oldPrompt, newPrompt, results.metrics);

    // Make recommendation
    results.recommendation = this.makeRecommendation(results.metrics);

    return results;
  }

  /**
   * Test a prompt against security scenarios
   */
  async testPrompt(prompt, scenarios) {
    const results = [];

    for (const scenario of scenarios) {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: prompt,
        messages: [{
          role: 'user',
          content: scenario.input
        }]
      });

      results.push({
        scenario: scenario.name,
        input: scenario.input,
        expectedBehavior: scenario.expected,
        actualResponse: response.content[0].text,
        passed: this.evaluateResponse(response.content[0].text, scenario)
      });
    }

    return results;
  }

  /**
   * Calculate security metrics from test results
   */
  calculateMetrics(testResults) {
    const metrics = {
      detectionRate: 0,
      falsePositiveRate: 0,
      contextAwareness: 0,
      responseClarity: 0,
      overallScore: 0
    };

    let detected = 0;
    let falsePositives = 0;
    let contextCorrect = 0;
    let clearResponses = 0;

    for (const result of testResults) {
      if (result.scenario.includes('malicious') && result.passed) detected++;
      if (result.scenario.includes('benign') && !result.passed) falsePositives++;
      if (result.scenario.includes('context') && result.passed) contextCorrect++;
      if (this.isResponseClear(result.actualResponse)) clearResponses++;
    }

    metrics.detectionRate = (detected / testResults.filter(r => r.scenario.includes('malicious')).length) || 0;
    metrics.falsePositiveRate = (falsePositives / testResults.filter(r => r.scenario.includes('benign')).length) || 0;
    metrics.contextAwareness = (contextCorrect / testResults.filter(r => r.scenario.includes('context')).length) || 0;
    metrics.responseClarity = clearResponses / testResults.length;
    
    // Overall score weighted by importance
    metrics.overallScore = (
      metrics.detectionRate * 0.4 +
      (1 - metrics.falsePositiveRate) * 0.3 +
      metrics.contextAwareness * 0.2 +
      metrics.responseClarity * 0.1
    );

    return metrics;
  }

  /**
   * Evaluate if response matches expected behavior
   */
  evaluateResponse(response, scenario) {
    // Implementation depends on scenario type
    if (scenario.expected.type === 'block') {
      return response.toLowerCase().includes('risk') || 
             response.toLowerCase().includes('danger') ||
             response.toLowerCase().includes('warning');
    } else if (scenario.expected.type === 'allow') {
      return !response.toLowerCase().includes('risk') &&
             !response.toLowerCase().includes('danger');
    }
    return false;
  }

  /**
   * Check if response is clear and actionable
   */
  isResponseClear(response) {
    // Simple clarity check - can be enhanced
    return response.length > 20 && 
           response.includes(' ') &&
           (response.includes('Risk:') || response.includes('Safe') || response.includes('Warning'));
  }

  /**
   * Generate detailed comparison analysis
   */
  async generateComparison(oldPrompt, newPrompt, metrics) {
    const prompt = `As a security expert, analyze these two security prompts and their test metrics:

OLD PROMPT:
${oldPrompt.substring(0, 500)}...

NEW PROMPT:
${newPrompt.substring(0, 500)}...

METRICS:
${JSON.stringify(metrics, null, 2)}

Provide a detailed comparison focusing on:
1. Key differences in approach
2. Strengths and weaknesses of each
3. Specific improvements or regressions
4. Edge cases handling`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return response.content[0].text;
  }

  /**
   * Make recommendation based on metrics
   */
  makeRecommendation(metrics) {
    const improvementScore = metrics.improvement.overallScore.absolute;
    
    if (improvementScore > 0.1) {
      return {
        action: 'APPROVE',
        confidence: 'HIGH',
        reason: 'Significant improvement in security detection and accuracy'
      };
    } else if (improvementScore > 0.05) {
      return {
        action: 'APPROVE',
        confidence: 'MEDIUM',
        reason: 'Moderate improvements observed'
      };
    } else if (improvementScore > -0.05) {
      return {
        action: 'REQUEST_CHANGES',
        confidence: 'MEDIUM',
        reason: 'Minimal improvement - consider additional refinements'
      };
    } else {
      return {
        action: 'REJECT',
        confidence: 'HIGH',
        reason: 'Regression in security effectiveness detected'
      };
    }
  }
}

module.exports = SecurityExpert;