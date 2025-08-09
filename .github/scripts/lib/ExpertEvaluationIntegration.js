/**
 * Expert Evaluation Integration
 * Bridges the gap between existing prompt evaluation and GitHub bot tooling
 * Enables Claude to use expert evaluation capabilities as tools
 */

const { PromptVersionManager } = require('./PromptVersionManager');
const path = require('path');
const fs = require('fs').promises;

class ExpertEvaluationIntegration {
  constructor(options = {}) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    this.workspace = options.workspace || process.cwd();
    this.versionManager = new PromptVersionManager(options);
  }

  /**
   * Get evaluation tools for Claude to use
   */
  getEvaluationTools() {
    return [
      {
        name: 'evaluate_prompt_changes',
        description: 'Evaluate prompt changes using the 3-thread model with domain experts',
        input_schema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Expert domain (security, programming, financial, data-analysis, general)',
              enum: ['security', 'programming', 'financial', 'data-analysis', 'general']
            },
            test_scenario: {
              type: 'string', 
              description: 'Custom test scenario to evaluate prompts against'
            },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific files to evaluate (optional)'
            }
          },
          required: ['domain']
        }
      },
      {
        name: 'get_prompt_history',
        description: 'Get version history and improvement trends for a prompt file',
        input_schema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the prompt file'
            },
            limit: {
              type: 'number',
              description: 'Number of versions to retrieve (default: 10)'
            }
          },
          required: ['file_path']
        }
      },
      {
        name: 'compare_prompt_versions',
        description: 'Compare two versions of a prompt and get improvement analysis',
        input_schema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the prompt file'
            },
            old_version: {
              type: 'string',
              description: 'Old version SHA or short hash'
            },
            new_version: {
              type: 'string',
              description: 'New version SHA or short hash'
            }
          },
          required: ['file_path', 'old_version', 'new_version']
        }
      },
      {
        name: 'get_expert_feedback',
        description: 'Get structured expert feedback on current PR prompt changes',
        input_schema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Expert domain to use for evaluation'
            },
            focus_areas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific areas to focus evaluation on'
            }
          },
          required: ['domain']
        }
      }
    ];
  }

  /**
   * Execute evaluation tool
   */
  async executeEvaluationTool(toolName, args, context) {
    switch (toolName) {
      case 'evaluate_prompt_changes':
        return await this.evaluatePromptChanges(args, context);
      case 'get_prompt_history':
        return await this.getPromptHistory(args);
      case 'compare_prompt_versions':
        return await this.comparePromptVersions(args);
      case 'get_expert_feedback':
        return await this.getExpertFeedback(args, context);
      default:
        throw new Error(`Unknown evaluation tool: ${toolName}`);
    }
  }

  /**
   * Evaluate prompt changes using existing 3-thread model
   */
  async evaluatePromptChanges(args, context) {
    const { domain, test_scenario, files } = args;
    
    try {
      // Get changed prompt files from PR
      let promptFiles = [];
      
      if (files && files.length > 0) {
        promptFiles = files.filter(f => f.includes('prompt') && (f.endsWith('.md') || f.endsWith('.txt')));
      } else if (context.pr) {
        // Get files from current PR
        const { data: prFiles } = await this.octokit.pulls.listFiles({
          owner: this.repoOwner,
          repo: this.repoName,
          pull_number: context.pr.number
        });
        
        promptFiles = prFiles
          .filter(f => f.filename.includes('prompt') && (f.filename.endsWith('.md') || f.filename.endsWith('.txt')))
          .map(f => f.filename);
      }

      if (promptFiles.length === 0) {
        return { error: 'No prompt files found to evaluate' };
      }

      // Load expert definition from GitHub
      let expertDefinition;
      
      try {
        // Always fetch from GitHub, never from local filesystem
        const { data } = await this.octokit.repos.getContent({
          owner: this.repoOwner,
          repo: this.repoName,
          path: `expert-definitions/${domain}-expert.md`,
          ref: 'main' // Use main branch for stable expert definitions
        });
        expertDefinition = Buffer.from(data.content, 'base64').toString('utf8');
      } catch (error) {
        return { error: `Expert definition not found for domain: ${domain} (fetching from GitHub)` };
      }

      // Get test scenario
      let scenario = test_scenario;
      if (!scenario) {
        try {
          // Fetch domain tests from GitHub
          const { data } = await this.octokit.repos.getContent({
            owner: this.repoOwner,
            repo: this.repoName,
            path: 'test-scenarios/domain-tests.json',
            ref: 'main'
          });
          const domainTests = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
          scenario = domainTests[domain]?.scenario || 'Please demonstrate your capabilities with a relevant example.';
        } catch (error) {
          console.log('Could not fetch domain tests from GitHub, using default scenario');
          scenario = 'Please demonstrate your capabilities with a relevant example.';
        }
      }

      const results = [];

      // Evaluate each file
      for (const filePath of promptFiles) {
        // Get current and previous content
        const currentContent = await this.getFileContent(filePath, 'head');
        const previousContent = await this.getFileContent(filePath, 'base');

        if (!currentContent) {
          results.push({ file: filePath, error: 'Could not read current content' });
          continue;
        }

        // Run 3-thread evaluation
        const evaluation = await this.run3ThreadEvaluation(
          previousContent || '',
          currentContent,
          expertDefinition,
          scenario,
          domain
        );

        results.push({
          file: filePath,
          domain: domain,
          scenario: scenario,
          evaluation: evaluation
        });
      }

      return { results };

    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Run 3-thread evaluation model
   */
  async run3ThreadEvaluation(oldContent, newContent, expertDefinition, scenario, domain) {
    if (!this.anthropic) {
      throw new Error('Anthropic client not available');
    }

    // Thread A: Evaluate current prompt
    const threadA = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are primed with this prompt definition:\n\n${oldContent}\n\nNow respond to this test scenario: "${scenario}"`
      }]
    });

    // Thread B: Evaluate new prompt
    const threadB = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are primed with this prompt definition:\n\n${newContent}\n\nNow respond to this test scenario: "${scenario}"`
      }]
    });

    // Thread C: Expert comparison
    const comparison = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `## EVALUATION FRAMEWORK

You are an expert prompt evaluator. Compare these two prompt implementations:

**Expert Domain Context:**
${expertDefinition}

**Test Scenario Used:**
"${scenario}"

**Candidate A (Current Implementation's Response):**
${threadA.content[0].text}

**Candidate B (Proposed Implementation's Response):**
${threadB.content[0].text}

Provide your evaluation with:
1. Detailed analysis comparing both candidates
2. Score out of 10 for the new implementation
3. Final decision: MERGE (≥8.5/10), SUGGEST (6-8.5/10), or REJECT (<6/10)
4. Specific improvements if SUGGEST

End with:
=== EVALUATION RESULT ===
DECISION: [MERGE/REJECT/SUGGEST]
SCORE: [X]/10
IMPROVEMENTS NEEDED:
- [If SUGGEST, list specific improvements]
=== END RESULT ===`
      }]
    });

    // Parse expert response
    const expertResponse = comparison.content[0].text;
    const result = this.parseExpertResponse(expertResponse);

    return {
      threadA: threadA.content[0].text,
      threadB: threadB.content[0].text,
      expertAnalysis: expertResponse,
      decision: result.decision,
      score: result.score,
      improvements: result.improvements
    };
  }

  /**
   * Get file content from PR
   */
  async getFileContent(filePath, refType) {
    try {
      let ref;
      if (refType === 'head') {
        ref = `refs/pull/${process.env.PR_NUMBER}/head`;
      } else if (refType === 'base') {
        ref = process.env.GITHUB_BASE_REF || 'main';
      }

      const { data } = await this.octokit.repos.getContent({
        owner: this.repoOwner,
        repo: this.repoName,
        path: filePath,
        ref: ref
      });

      if (data.content) {
        return Buffer.from(data.content, 'base64').toString('utf8');
      }
    } catch (error) {
      console.log(`Could not fetch ${refType} version of ${filePath}: ${error.message}`);
    }
    return null;
  }

  /**
   * Parse expert response
   */
  parseExpertResponse(response) {
    const result = {
      decision: 'UNKNOWN',
      score: null,
      improvements: []
    };

    // Extract structured result
    const structuredMatch = response.match(/=== EVALUATION RESULT ===([\s\S]*?)=== END RESULT ===/);
    if (structuredMatch) {
      const content = structuredMatch[1];
      
      const decisionMatch = content.match(/DECISION:\s*(\w+)/);
      if (decisionMatch) {
        result.decision = decisionMatch[1].toUpperCase();
      }

      const scoreMatch = content.match(/SCORE:\s*(\d+(?:\.\d+)?)/);
      if (scoreMatch) {
        result.score = parseFloat(scoreMatch[1]);
      }

      const improvementsMatch = content.match(/IMPROVEMENTS NEEDED:([\s\S]*?)(?:===|$)/);
      if (improvementsMatch) {
        result.improvements = improvementsMatch[1]
          .trim()
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.trim());
      }
    }

    return result;
  }

  /**
   * Get prompt history
   */
  async getPromptHistory(args) {
    const { file_path, limit = 10 } = args;
    
    try {
      const history = await this.versionManager.getVersionHistory(file_path, limit);
      const trends = await this.versionManager.getImprovementTrends(file_path);
      
      return {
        file: file_path,
        versions: history.map(v => ({
          version: v.version,
          date: v.date,
          author: v.author,
          message: v.message,
          metadata: v.metadata
        })),
        trends: trends
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Compare prompt versions
   */
  async comparePromptVersions(args) {
    const { file_path, old_version, new_version } = args;
    
    try {
      const comparison = await this.versionManager.compareVersions(file_path, old_version, new_version);
      return comparison;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get expert feedback for current PR
   */
  async getExpertFeedback(args, context) {
    const { domain, focus_areas = [] } = args;
    
    if (!context.pr) {
      return { error: 'No PR context available' };
    }

    try {
      // Run evaluation with focus areas
      const evaluation = await this.evaluatePromptChanges({ 
        domain, 
        test_scenario: focus_areas.length > 0 
          ? `Focus on these areas: ${focus_areas.join(', ')}`
          : undefined
      }, context);

      if (evaluation.error) {
        return evaluation;
      }

      // Format as expert feedback
      const feedback = {
        domain: domain,
        pr_number: context.pr.number,
        focus_areas: focus_areas,
        files_evaluated: evaluation.results.length,
        overall_decision: this.determineOverallDecision(evaluation.results),
        detailed_results: evaluation.results,
        summary: this.generateFeedbackSummary(evaluation.results, domain)
      };

      return feedback;

    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Determine overall decision from multiple file evaluations
   */
  determineOverallDecision(results) {
    const decisions = results
      .map(r => r.evaluation?.decision)
      .filter(Boolean);

    if (decisions.includes('REJECT')) return 'REJECT';
    if (decisions.includes('SUGGEST')) return 'SUGGEST';
    if (decisions.includes('MERGE')) return 'MERGE';
    return 'UNKNOWN';
  }

  /**
   * Generate feedback summary
   */
  generateFeedbackSummary(results, domain) {
    const successful = results.filter(r => r.evaluation?.decision === 'MERGE').length;
    const needsWork = results.filter(r => r.evaluation?.decision === 'SUGGEST').length;
    const rejected = results.filter(r => r.evaluation?.decision === 'REJECT').length;

    const avgScore = results
      .filter(r => r.evaluation?.score)
      .reduce((sum, r) => sum + r.evaluation.score, 0) / Math.max(results.length, 1);

    return `${domain} Expert Evaluation Summary:
- Files evaluated: ${results.length}
- Ready to merge: ${successful}
- Need improvements: ${needsWork}
- Require rework: ${rejected}
- Average score: ${avgScore.toFixed(1)}/10`;
  }
}

module.exports = { ExpertEvaluationIntegration };