/**
 * GitHub Integration for Prompt Expert Bank
 * Handles PR evaluation and feedback
 */

const { Octokit } = require('@octokit/rest');
const SecurityExpert = require('../experts/security-expert');
const { generateTestSuite } = require('../evaluation/test-scenarios');

class GitHubIntegration {
  constructor(githubToken, anthropicKey) {
    this.octokit = new Octokit({ auth: githubToken });
    this.experts = {
      security: new SecurityExpert(anthropicKey)
    };
  }

  /**
   * Main entry point for PR evaluation
   */
  async evaluatePR(owner, repo, prNumber) {
    console.log(`Evaluating PR #${prNumber} in ${owner}/${repo}`);

    try {
      // Get PR details
      const pr = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      // Get file changes
      const files = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      // Find prompt files
      const promptFiles = files.data.filter(file => 
        file.filename.includes('prompt') && 
        (file.filename.endsWith('.md') || file.filename.endsWith('.txt'))
      );

      if (promptFiles.length === 0) {
        await this.postComment(owner, repo, prNumber, 
          "ℹ️ No prompt files detected in this PR. Skipping evaluation.");
        return;
      }

      // Evaluate each prompt change
      const evaluations = [];
      for (const file of promptFiles) {
        if (file.status === 'modified') {
          const evaluation = await this.evaluatePromptChange(owner, repo, file, pr.data.base.sha);
          evaluations.push(evaluation);
        }
      }

      // Post results
      await this.postEvaluationResults(owner, repo, prNumber, evaluations);

      // Approve or request changes based on results
      await this.submitReview(owner, repo, prNumber, evaluations);

    } catch (error) {
      console.error('Error evaluating PR:', error);
      await this.postComment(owner, repo, prNumber, 
        `❌ Error during evaluation: ${error.message}`);
    }
  }

  /**
   * Evaluate a single prompt file change
   */
  async evaluatePromptChange(owner, repo, file, baseSha) {
    // Get old version
    const oldContent = await this.getFileContent(owner, repo, file.filename, baseSha);
    
    // Get new version
    const newContent = await this.getFileContent(owner, repo, file.filename, file.sha);

    // Determine domain from file path or content
    const domain = this.detectDomain(file.filename, newContent);
    
    // Get appropriate expert
    const expert = this.experts[domain] || this.experts.security;
    
    // Get test scenarios
    const scenarios = generateTestSuite(domain);
    
    // Run evaluation
    const results = await expert.evaluatePrompts(oldContent, newContent, scenarios);
    
    return {
      file: file.filename,
      domain,
      results
    };
  }

  /**
   * Get file content at specific commit
   */
  async getFileContent(owner, repo, path, ref) {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref
      });
      
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    } catch (error) {
      console.error(`Error getting file content: ${path} at ${ref}`);
      return '';
    }
  }

  /**
   * Detect domain from file path or content
   */
  detectDomain(filename, content) {
    if (filename.includes('security') || content.includes('security')) {
      return 'security';
    }
    // Add more domain detection logic
    return 'general';
  }

  /**
   * Post evaluation results as PR comment
   */
  async postEvaluationResults(owner, repo, prNumber, evaluations) {
    let comment = '## 🏦 Prompt Expert Bank Evaluation Results\n\n';
    
    for (const eval of evaluations) {
      const { results } = eval;
      const recommendation = results.recommendation;
      
      comment += `### 📄 ${eval.file}\n`;
      comment += `**Domain**: ${eval.domain} | **Expert**: ${results.expert}\n\n`;
      
      // Metrics table
      comment += '#### 📊 Metrics Comparison\n';
      comment += '| Metric | Old Prompt | New Prompt | Change |\n';
      comment += '|--------|------------|------------|--------|\n';
      
      for (const [metric, value] of Object.entries(results.metrics.oldPrompt)) {
        const oldVal = (value * 100).toFixed(1);
        const newVal = (results.metrics.newPrompt[metric] * 100).toFixed(1);
        const change = results.metrics.improvement[metric].percentage;
        const emoji = parseFloat(change) > 0 ? '📈' : parseFloat(change) < 0 ? '📉' : '➡️';
        
        comment += `| ${this.formatMetricName(metric)} | ${oldVal}% | ${newVal}% | ${emoji} ${change} |\n`;
      }
      
      comment += '\n#### 🔍 Detailed Analysis\n';
      comment += '```\n' + results.comparison + '\n```\n';
      
      comment += '\n#### 🎯 Recommendation\n';
      const actionEmoji = recommendation.action === 'APPROVE' ? '✅' : 
                         recommendation.action === 'REJECT' ? '❌' : '🔄';
      comment += `${actionEmoji} **${recommendation.action}** (Confidence: ${recommendation.confidence})\n`;
      comment += `*${recommendation.reason}*\n\n`;
      
      comment += '---\n\n';
    }
    
    await this.postComment(owner, repo, prNumber, comment);
  }

  /**
   * Submit PR review based on evaluations
   */
  async submitReview(owner, repo, prNumber, evaluations) {
    // Determine overall action
    let overallAction = 'APPROVE';
    let hasRejection = false;
    let hasChangesRequested = false;
    
    for (const eval of evaluations) {
      const action = eval.results.recommendation.action;
      if (action === 'REJECT') {
        hasRejection = true;
        overallAction = 'REQUEST_CHANGES';
      } else if (action === 'REQUEST_CHANGES' && !hasRejection) {
        hasChangesRequested = true;
        overallAction = 'REQUEST_CHANGES';
      }
    }
    
    const reviewBody = hasRejection ? 
      '❌ This PR contains prompt regressions that need to be addressed.' :
      hasChangesRequested ?
      '🔄 This PR needs improvements before merging.' :
      '✅ All prompt changes have been validated and show improvements.';
    
    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      body: reviewBody,
      event: overallAction
    });
  }

  /**
   * Post a comment on PR
   */
  async postComment(owner, repo, prNumber, body) {
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body
    });
  }

  /**
   * Format metric names for display
   */
  formatMetricName(metric) {
    const names = {
      detectionRate: 'Detection Rate',
      falsePositiveRate: 'False Positive Rate',
      contextAwareness: 'Context Awareness',
      responseClarity: 'Response Clarity',
      overallScore: 'Overall Score'
    };
    return names[metric] || metric;
  }
}

module.exports = GitHubIntegration;