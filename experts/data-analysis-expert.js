/**
 * Data analysis expert for evaluating data processing and analytics prompts
 */

const path = require('path');
const fs = require('fs');

// Load test scenarios from separate file
const testScenariosPath = path.join(__dirname, '..', 'test-scenarios', 'data-analysis-tests.js');
const testData = fs.existsSync(testScenariosPath) ? require(testScenariosPath) : null;

const dataAnalysisExpert = {
  name: 'Data Analysis Expert',
  domain: 'data-analysis',
  description: 'Evaluates prompts that process, analyze, or visualize data',
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
      hasStatistics: false,
      mentionsVisualization: false,
      showsDataStructure: false,
      includesInsights: false,
      suggestsTools: false,
      considersDataQuality: false,
      providesCode: false,
      explainsMethodology: false
    };
    
    const lowerResponse = response.toLowerCase();
    
    // Check for statistical concepts
    analysis.hasStatistics = lowerResponse.includes('mean') || lowerResponse.includes('median') ||
                            lowerResponse.includes('correlation') || lowerResponse.includes('standard deviation') ||
                            lowerResponse.includes('average') || lowerResponse.includes('variance');
    
    // Check for visualization mentions
    analysis.mentionsVisualization = lowerResponse.includes('chart') || lowerResponse.includes('graph') ||
                                    lowerResponse.includes('plot') || lowerResponse.includes('visualiz') ||
                                    lowerResponse.includes('dashboard') || lowerResponse.includes('histogram');
    
    // Check for data structure understanding
    analysis.showsDataStructure = lowerResponse.includes('column') || lowerResponse.includes('row') ||
                                 lowerResponse.includes('dataframe') || lowerResponse.includes('csv') ||
                                 lowerResponse.includes('table') || lowerResponse.includes('dataset');
    
    // Check for insights and conclusions
    analysis.includesInsights = lowerResponse.includes('trend') || lowerResponse.includes('pattern') ||
                               lowerResponse.includes('conclusion') || lowerResponse.includes('insight') ||
                               lowerResponse.includes('finding') || lowerResponse.includes('indicates');
    
    // Check for tool suggestions
    analysis.suggestsTools = lowerResponse.includes('python') || lowerResponse.includes('pandas') ||
                           lowerResponse.includes('sql') || lowerResponse.includes('excel') ||
                           lowerResponse.includes('tableau') || lowerResponse.includes('r ') ||
                           lowerResponse.includes('numpy') || lowerResponse.includes('matplotlib');
    
    // Check for data quality considerations
    analysis.considersDataQuality = lowerResponse.includes('clean') || lowerResponse.includes('missing') ||
                                   lowerResponse.includes('outlier') || lowerResponse.includes('invalid') ||
                                   lowerResponse.includes('duplicate') || lowerResponse.includes('quality');
    
    // Check for code examples
    analysis.providesCode = response.includes('```') || response.includes('SELECT') ||
                          response.includes('df.') || response.includes('import') ||
                          response.includes('=') && (response.includes('pandas') || response.includes('numpy'));
    
    // Check for methodology explanation
    analysis.explainsMethodology = lowerResponse.includes('step') || lowerResponse.includes('process') ||
                                  lowerResponse.includes('method') || lowerResponse.includes('approach') ||
                                  lowerResponse.includes('first') || lowerResponse.includes('then');
    
    // Determine if passed based on expected type
    let passed = false;
    if (scenario.expected.type === 'analysis') {
      passed = analysis.hasStatistics && analysis.includesInsights;
    } else if (scenario.expected.type === 'visualization') {
      passed = analysis.mentionsVisualization && analysis.suggestsTools;
    } else if (scenario.expected.type === 'processing') {
      passed = analysis.showsDataStructure && analysis.considersDataQuality;
    } else if (scenario.expected.type === 'sql') {
      passed = analysis.providesCode && (response.includes('SELECT') || response.includes('FROM'));
    }
    
    return { passed, analysis };
  },
  
  calculateMetrics(testResults) {
    const metrics = {
      statisticalAccuracy: 0,
      visualizationGuidance: 0,
      dataProcessingSkills: 0,
      insightGeneration: 0,
      toolRecommendations: 0,
      methodologyClarity: 0,
      overallScore: 0
    };
    
    if (testResults.length === 0) return metrics;
    
    // Calculate individual metrics
    const hasStats = testResults.filter(r => r.analysis && r.analysis.hasStatistics).length;
    metrics.statisticalAccuracy = hasStats / testResults.length;
    
    const hasViz = testResults.filter(r => r.analysis && r.analysis.mentionsVisualization).length;
    metrics.visualizationGuidance = hasViz / testResults.length;
    
    const processesData = testResults.filter(r => r.analysis && r.analysis.considersDataQuality).length;
    metrics.dataProcessingSkills = processesData / testResults.length;
    
    const hasInsights = testResults.filter(r => r.analysis && r.analysis.includesInsights).length;
    metrics.insightGeneration = hasInsights / testResults.length;
    
    const suggestsTools = testResults.filter(r => r.analysis && r.analysis.suggestsTools).length;
    metrics.toolRecommendations = suggestsTools / testResults.length;
    
    const explainsMethod = testResults.filter(r => r.analysis && r.analysis.explainsMethodology).length;
    metrics.methodologyClarity = explainsMethod / testResults.length;
    
    // Calculate weighted overall score
    metrics.overallScore = (
      metrics.statisticalAccuracy * 0.25 +      // 25% - Must understand statistics
      metrics.insightGeneration * 0.25 +        // 25% - Must generate insights
      metrics.dataProcessingSkills * 0.20 +     // 20% - Must handle data properly
      metrics.visualizationGuidance * 0.15 +    // 15% - Must suggest visualizations
      metrics.toolRecommendations * 0.10 +      // 10% - Must suggest appropriate tools
      metrics.methodologyClarity * 0.05         // 5% - Must explain methodology
    );
    
    return metrics;
  },
  
  generateReport(oldMetrics, newMetrics, oldResults, newResults) {
    let report = `### 🧪 Data Analysis Evaluation\n\n`;
    
    if (oldResults.length > 0) {
      report += `#### Previous Prompt Performance\n`;
      report += `- **Statistical Accuracy**: ${(oldMetrics.statisticalAccuracy * 100).toFixed(1)}%\n`;
      report += `- **Visualization Guidance**: ${(oldMetrics.visualizationGuidance * 100).toFixed(1)}%\n`;
      report += `- **Data Processing Skills**: ${(oldMetrics.dataProcessingSkills * 100).toFixed(1)}%\n`;
      report += `- **Insight Generation**: ${(oldMetrics.insightGeneration * 100).toFixed(1)}%\n`;
      report += `- **Tool Recommendations**: ${(oldMetrics.toolRecommendations * 100).toFixed(1)}%\n`;
      report += `- **Methodology Clarity**: ${(oldMetrics.methodologyClarity * 100).toFixed(1)}%\n`;
      report += `- **Overall Score**: ${(oldMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    }
    
    report += `#### New Prompt Performance\n`;
    report += `- **Statistical Accuracy**: ${(newMetrics.statisticalAccuracy * 100).toFixed(1)}%\n`;
    report += `- **Visualization Guidance**: ${(newMetrics.visualizationGuidance * 100).toFixed(1)}%\n`;
    report += `- **Data Processing Skills**: ${(newMetrics.dataProcessingSkills * 100).toFixed(1)}%\n`;
    report += `- **Insight Generation**: ${(newMetrics.insightGeneration * 100).toFixed(1)}%\n`;
    report += `- **Tool Recommendations**: ${(newMetrics.toolRecommendations * 100).toFixed(1)}%\n`;
    report += `- **Methodology Clarity**: ${(newMetrics.methodologyClarity * 100).toFixed(1)}%\n`;
    report += `- **Overall Score**: ${(newMetrics.overallScore * 100).toFixed(1)}%\n\n`;
    
    if (oldResults.length > 0) {
      report += `### 📊 Performance Comparison\n\n`;
      
      report += `| Metric | Change | Status |\n`;
      report += `|--------|--------|--------|\n`;
      
      const metrics = ['statisticalAccuracy', 'visualizationGuidance', 'dataProcessingSkills', 
                      'insightGeneration', 'toolRecommendations', 'methodologyClarity'];
      const labels = ['Statistical Accuracy', 'Visualization Guidance', 'Data Processing', 
                     'Insight Generation', 'Tool Recommendations', 'Methodology Clarity'];
      
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
    
    if (newMetrics.statisticalAccuracy > 0.7) {
      report += `✅ **Strong Statistics**: The prompt demonstrates solid statistical understanding.\n\n`;
    }
    
    if (newMetrics.insightGeneration > 0.7) {
      report += `✅ **Insight-Driven**: The prompt generates meaningful insights from data.\n\n`;
    }
    
    if (newMetrics.toolRecommendations > 0.6) {
      report += `✅ **Tool-Aware**: The prompt suggests appropriate data analysis tools.\n\n`;
    }
    
    const failedTests = newResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      report += `⚠️ **Areas for Improvement**:\n`;
      if (newMetrics.statisticalAccuracy < 0.5) report += `- Include more statistical concepts and measures\n`;
      if (newMetrics.visualizationGuidance < 0.5) report += `- Suggest appropriate charts and visualizations\n`;
      if (newMetrics.insightGeneration < 0.5) report += `- Focus more on generating actionable insights\n`;
      report += `\n`;
    }
    
    return report;
  }
};

module.exports = dataAnalysisExpert;