/**
 * ABTest Tool for Comparative Prompt Analysis
 * Performs expert evaluation comparing two prompt versions
 * Supports version comparison within the same file
 */

const { Octokit } = require('@octokit/rest');
const path = require('path');

class ABTestTool {
  constructor(options) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    this.workspace = options.workspace;
  }

  /**
   * Main ABTest execution
   * @param {string} pathToExpertPromptDefinition - Path to expert definition (e.g., "expert-definitions/security.md")
   * @param {string} pathToPromptA - Path to prompt A (e.g., "prompts/code-reviewer.md@v1" or "prompts/code-reviewer.md@3a5f8e2")
   * @param {string} pathToPromptB - Path to prompt B (e.g., "prompts/code-reviewer.md@HEAD" or "prompts/code-reviewer.md")
   * @param {array} testContextPaths - Optional array of paths to reference materials for testing
   * @returns {object} Comparative analysis results with expert verdict
   */
  async executeABTest(pathToExpertPromptDefinition, pathToPromptA, pathToPromptB, testContextPaths = []) {
    try {
      // Parse paths to extract file path and version info
      const expertInfo = this.parsePath(pathToExpertPromptDefinition);
      const promptAInfo = this.parsePath(pathToPromptA);
      const promptBInfo = this.parsePath(pathToPromptB);

      // Fetch expert definition
      const expertPrompt = await this.fetchContent(expertInfo);
      
      // Fetch both prompt versions
      const promptA = await this.fetchContent(promptAInfo);
      const promptB = await this.fetchContent(promptBInfo);

      // Fetch test context materials if provided
      const testContext = await this.fetchTestContext(testContextPaths);

      // Run 3-thread evaluation for each prompt with test context
      const evaluationA = await this.runThreeThreadEvaluation(expertPrompt, promptA, promptAInfo, testContext);
      const evaluationB = await this.runThreeThreadEvaluation(expertPrompt, promptB, promptBInfo, testContext);

      // Perform comparative analysis
      const comparison = await this.compareEvaluations(
        expertPrompt,
        evaluationA,
        evaluationB,
        promptAInfo,
        promptBInfo
      );

      // Generate expert verdict
      const verdict = await this.generateExpertVerdict(
        expertPrompt,
        comparison,
        promptAInfo,
        promptBInfo
      );

      return {
        success: true,
        testConfiguration: {
          expert: expertInfo,
          promptA: promptAInfo,
          promptB: promptBInfo,
          testContext: testContextPaths
        },
        evaluations: {
          promptA: evaluationA,
          promptB: evaluationB
        },
        comparison: comparison,
        verdict: verdict,
        summary: this.generateSummary(verdict)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.stack
      };
    }
  }

  /**
   * Fetch test context materials
   * Supports files, directories, and cross-repository references
   */
  async fetchTestContext(contextPaths) {
    const context = {
      files: [],
      directories: [],
      totalSize: 0,
      summary: []
    };

    for (const path of contextPaths) {
      try {
        const pathInfo = this.parsePath(path);
        
        // Check if it's a directory by trying to list contents
        try {
          const { data } = await this.octokit.repos.getContent({
            owner: pathInfo.owner,
            repo: pathInfo.repo,
            path: pathInfo.filePath,
            ref: pathInfo.version
          });

          if (Array.isArray(data)) {
            // It's a directory
            context.directories.push({
              path: pathInfo.filePath,
              fileCount: data.length,
              files: data.map(f => f.name)
            });
            
            // Fetch first few files as samples
            const samples = data.slice(0, 3);
            for (const file of samples) {
              if (file.type === 'file') {
                const content = await this.fetchContent({
                  ...pathInfo,
                  filePath: file.path
                });
                context.files.push({
                  path: file.path,
                  name: file.name,
                  content: content.content.substring(0, 1000) + '...',
                  size: content.size
                });
                context.totalSize += content.size;
              }
            }
          } else {
            // It's a file
            const content = await this.fetchContent(pathInfo);
            context.files.push({
              path: pathInfo.filePath,
              name: pathInfo.filePath.split('/').pop(),
              content: content.content,
              size: content.size
            });
            context.totalSize += content.size;
          }
        } catch (error) {
          // Try as single file
          const content = await this.fetchContent(pathInfo);
          context.files.push({
            path: pathInfo.filePath,
            name: pathInfo.filePath.split('/').pop(),
            content: content.content,
            size: content.size
          });
          context.totalSize += content.size;
        }

        context.summary.push(`✓ Loaded: ${pathInfo.filePath}`);
      } catch (error) {
        context.summary.push(`✗ Failed: ${path} - ${error.message}`);
      }
    }

    return context;
  }

  /**
   * Parse path to extract file path and version information
   * Supports formats:
   * - "path/to/file.md" (latest version)
   * - "path/to/file.md@v1" (tag)
   * - "path/to/file.md@branch-name" (branch)
   * - "path/to/file.md@3a5f8e2" (commit SHA)
   * - "owner/repo:path/to/file.md@version" (cross-repo)
   */
  parsePath(pathString) {
    let owner = this.repoOwner;
    let repo = this.repoName;
    let filePath = pathString;
    let version = 'HEAD';

    // Check for cross-repo format
    if (pathString.includes(':')) {
      const [repopart, filepart] = pathString.split(':');
      if (repopart.includes('/')) {
        [owner, repo] = repopart.split('/');
        filePath = filepart;
      }
    }

    // Check for version specification
    if (filePath.includes('@')) {
      const parts = filePath.split('@');
      filePath = parts[0];
      version = parts[1];
    }

    return {
      owner,
      repo,
      filePath,
      version,
      fullPath: pathString
    };
  }

  /**
   * Fetch content from GitHub with version support
   */
  async fetchContent(pathInfo) {
    try {
      // If version is a commit SHA or branch/tag
      const { data } = await this.octokit.repos.getContent({
        owner: pathInfo.owner,
        repo: pathInfo.repo,
        path: pathInfo.filePath,
        ref: pathInfo.version
      });

      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      return {
        content,
        sha: data.sha,
        size: data.size,
        path: pathInfo.filePath,
        version: pathInfo.version
      };
    } catch (error) {
      throw new Error(`Failed to fetch ${pathInfo.fullPath}: ${error.message}`);
    }
  }

  /**
   * Run 3-thread evaluation for a prompt
   */
  async runThreeThreadEvaluation(expertPrompt, promptContent, promptInfo, testContext = null) {
    // Simulate evaluation with three different approaches
    const threads = [];

    // Thread 1: Structural analysis
    threads.push(await this.evaluateStructure(expertPrompt, promptContent, testContext));

    // Thread 2: Domain expertise analysis
    threads.push(await this.evaluateDomainExpertise(expertPrompt, promptContent, testContext));

    // Thread 3: Effectiveness analysis with test context
    threads.push(await this.evaluateEffectiveness(expertPrompt, promptContent, testContext));

    // Aggregate scores
    const aggregateScore = threads.reduce((sum, t) => sum + t.score, 0) / threads.length;

    return {
      promptInfo,
      threads,
      aggregateScore,
      strengths: this.extractStrengths(threads),
      weaknesses: this.extractWeaknesses(threads),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Evaluate structural aspects of the prompt
   */
  async evaluateStructure(expertPrompt, promptContent, testContext) {
    const contextInfo = testContext ? `\n\nTest context available: ${testContext.files.length} files, ${testContext.directories.length} directories` : '';
    
    const systemMessage = `You are an expert evaluator analyzing prompt structure.
Expert perspective: ${expertPrompt.content.substring(0, 500)}...
${contextInfo}

Evaluate the prompt for:
1. Clarity and organization
2. Completeness of instructions
3. Logical flow
4. Appropriate level of detail
5. Alignment with provided test context`;

    const userContent = testContext 
      ? `Evaluate this prompt's structure with the following test context:\n\n${promptContent.content}\n\nTest Context Summary:\n${testContext.summary.join('\n')}`
      : `Evaluate this prompt's structure:\n\n${promptContent.content}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: userContent
      }],
      system: systemMessage
    });

    const evaluation = response.content[0].text;
    const score = this.extractScore(evaluation);

    return {
      type: 'structural',
      evaluation,
      score,
      aspects: {
        clarity: score >= 7,
        organization: score >= 7,
        completeness: score >= 8
      }
    };
  }

  /**
   * Evaluate domain expertise aspects
   */
  async evaluateDomainExpertise(expertPrompt, promptContent, testContext) {
    const contextInfo = testContext ? `\n\nTest materials provided for evaluation context` : '';
    
    const systemMessage = `You are a domain expert evaluator.
Expert perspective: ${expertPrompt.content.substring(0, 500)}...
${contextInfo}

Evaluate the prompt for:
1. Domain accuracy
2. Technical depth
3. Best practices adherence
4. Industry standards alignment
5. Practical applicability to test scenarios`;

    let userContent = `Evaluate this prompt's domain expertise:\n\n${promptContent.content}`;
    
    if (testContext && testContext.files.length > 0) {
      // Include sample test file for context
      const sampleFile = testContext.files[0];
      userContent += `\n\nSample test context (${sampleFile.name}):\n${sampleFile.content.substring(0, 500)}...`;
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: userContent
      }],
      system: systemMessage
    });

    const evaluation = response.content[0].text;
    const score = this.extractScore(evaluation);

    return {
      type: 'domain',
      evaluation,
      score,
      aspects: {
        accuracy: score >= 8,
        depth: score >= 7,
        bestPractices: score >= 8
      }
    };
  }

  /**
   * Evaluate effectiveness of the prompt
   */
  async evaluateEffectiveness(expertPrompt, promptContent, testContext) {
    const contextInfo = testContext ? `\n\nTest scenarios available for practical evaluation` : '';
    
    const systemMessage = `You are evaluating prompt effectiveness.
Expert perspective: ${expertPrompt.content.substring(0, 500)}...
${contextInfo}

Evaluate the prompt for:
1. Likely output quality
2. Task completion capability
3. Edge case handling
4. Practical usability
5. Performance on test scenarios`;

    let userContent = `Evaluate this prompt's effectiveness:\n\n${promptContent.content}`;
    
    if (testContext) {
      userContent += `\n\nTest Context Overview:\n- Files: ${testContext.files.length}\n- Directories: ${testContext.directories.length}\n- Total size: ${(testContext.totalSize / 1024).toFixed(2)} KB`;
      
      if (testContext.directories.length > 0) {
        const dir = testContext.directories[0];
        userContent += `\n- Sample directory: ${dir.path} (${dir.fileCount} files)`;
      }
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: userContent
      }],
      system: systemMessage
    });

    const evaluation = response.content[0].text;
    const score = this.extractScore(evaluation);

    return {
      type: 'effectiveness',
      evaluation,
      score,
      aspects: {
        outputQuality: score >= 7,
        taskCompletion: score >= 8,
        edgeCases: score >= 6
      }
    };
  }

  /**
   * Compare two evaluations
   */
  async compareEvaluations(expertPrompt, evalA, evalB, infoA, infoB) {
    const comparison = {
      scoreDifference: evalB.aggregateScore - evalA.aggregateScore,
      improvements: [],
      regressions: [],
      unchanged: []
    };

    // Compare thread scores
    for (let i = 0; i < evalA.threads.length; i++) {
      const threadA = evalA.threads[i];
      const threadB = evalB.threads[i];
      const diff = threadB.score - threadA.score;

      if (diff > 0.5) {
        comparison.improvements.push({
          aspect: threadA.type,
          improvement: diff,
          fromScore: threadA.score,
          toScore: threadB.score
        });
      } else if (diff < -0.5) {
        comparison.regressions.push({
          aspect: threadA.type,
          regression: Math.abs(diff),
          fromScore: threadA.score,
          toScore: threadB.score
        });
      } else {
        comparison.unchanged.push(threadA.type);
      }
    }

    // Detailed comparison using expert perspective
    const detailedComparison = await this.getDetailedComparison(
      expertPrompt,
      evalA,
      evalB,
      infoA,
      infoB
    );

    comparison.detailed = detailedComparison;

    return comparison;
  }

  /**
   * Get detailed comparison from expert perspective
   */
  async getDetailedComparison(expertPrompt, evalA, evalB, infoA, infoB) {
    const systemMessage = `You are the expert defined by this prompt:
${expertPrompt.content}

Provide a detailed comparison of two prompt evaluations.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Compare these two prompt evaluations:

PROMPT A (${infoA.version}):
Score: ${evalA.aggregateScore}
Strengths: ${evalA.strengths.join(', ')}
Weaknesses: ${evalA.weaknesses.join(', ')}

PROMPT B (${infoB.version}):
Score: ${evalB.aggregateScore}
Strengths: ${evalB.strengths.join(', ')}
Weaknesses: ${evalB.weaknesses.join(', ')}

Provide detailed comparison focusing on:
1. Key differences
2. Trade-offs
3. Use case suitability
4. Overall improvement or regression`
      }],
      system: systemMessage
    });

    return response.content[0].text;
  }

  /**
   * Generate expert verdict
   */
  async generateExpertVerdict(expertPrompt, comparison, infoA, infoB) {
    const systemMessage = `You are the expert defined by this prompt:
${expertPrompt.content}

You must provide a clear verdict on which prompt version is better.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Based on this comparison, provide your expert verdict:

${comparison.detailed}

Score difference: ${comparison.scoreDifference}
Improvements: ${comparison.improvements.length}
Regressions: ${comparison.regressions.length}

PROVIDE CLEAR VERDICT:
1. Which version is better: A (${infoA.version}) or B (${infoB.version})?
2. Why is it better?
3. Confidence level (high/medium/low)
4. Recommendation for production use`
      }],
      system: systemMessage
    });

    const verdictText = response.content[0].text;
    
    // Parse verdict
    const winner = verdictText.toLowerCase().includes('version b') || 
                   verdictText.toLowerCase().includes('prompt b') ? 'B' : 'A';
    
    const confidence = verdictText.toLowerCase().includes('high') ? 'high' :
                      verdictText.toLowerCase().includes('low') ? 'low' : 'medium';

    return {
      winner,
      winnerVersion: winner === 'A' ? infoA.version : infoB.version,
      confidence,
      reasoning: verdictText,
      scoreDifference: comparison.scoreDifference,
      recommendProduction: verdictText.toLowerCase().includes('recommend') && 
                          verdictText.toLowerCase().includes('production')
    };
  }

  /**
   * Extract score from evaluation text
   */
  extractScore(evaluation) {
    // Look for score patterns like "8/10", "Score: 8", "8 out of 10"
    const patterns = [
      /(\d+(?:\.\d+)?)\s*\/\s*10/i,
      /score[:\s]+(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*out\s*of\s*10/i
    ];

    for (const pattern of patterns) {
      const match = evaluation.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    // Default score based on sentiment
    if (evaluation.toLowerCase().includes('excellent')) return 9;
    if (evaluation.toLowerCase().includes('good')) return 7;
    if (evaluation.toLowerCase().includes('adequate')) return 5;
    if (evaluation.toLowerCase().includes('poor')) return 3;
    
    return 5; // Default middle score
  }

  /**
   * Extract strengths from threads
   */
  extractStrengths(threads) {
    const strengths = [];
    threads.forEach(thread => {
      if (thread.score >= 7) {
        Object.entries(thread.aspects).forEach(([aspect, isStrong]) => {
          if (isStrong) {
            strengths.push(`${thread.type}: ${aspect}`);
          }
        });
      }
    });
    return strengths;
  }

  /**
   * Extract weaknesses from threads
   */
  extractWeaknesses(threads) {
    const weaknesses = [];
    threads.forEach(thread => {
      if (thread.score < 7) {
        Object.entries(thread.aspects).forEach(([aspect, isStrong]) => {
          if (!isStrong) {
            weaknesses.push(`${thread.type}: ${aspect}`);
          }
        });
      }
    });
    return weaknesses;
  }

  /**
   * Generate summary of the AB test
   */
  generateSummary(verdict) {
    return `AB Test Complete: Version ${verdict.winnerVersion} is ${verdict.winner === 'B' ? 'BETTER' : 'WORSE'} than the baseline.
Confidence: ${verdict.confidence}
Score Difference: ${verdict.scoreDifference > 0 ? '+' : ''}${verdict.scoreDifference.toFixed(1)}
Production Ready: ${verdict.recommendProduction ? 'YES' : 'NO'}`;
  }

  /**
   * Get tool definition for Claude
   */
  static getToolDefinition() {
    return {
      name: 'ab_test',
      description: `Run A/B test comparing two prompt versions using expert evaluation with optional test context.
      
CAPABILITIES:
- Compare any two versions of a prompt (different files or same file at different versions)
- Use expert definitions to evaluate from domain perspective
- Include test context files/folders for realistic evaluation scenarios
- Run 3-thread evaluation for comprehensive analysis
- Provide clear verdict on which version is better

VERSION FORMATS:
- "path/to/prompt.md" - Latest version
- "path/to/prompt.md@v1.0" - Specific tag
- "path/to/prompt.md@main" - Specific branch
- "path/to/prompt.md@3a5f8e2" - Specific commit
- "owner/repo:path/to/prompt.md@version" - Cross-repository

TEST CONTEXT FORMATS:
- "test-scenarios/" - Directory of test files
- "examples/code-sample.js" - Single test file
- "test-data/*.json" - Pattern matching
- "other-repo/tests:security-tests/" - Cross-repo test data
- "examples/legacy.js@v1.0" - Specific version of test file

EXAMPLE USE CASES:
1. Compare old vs new version with test data: 
   - expertDef: "expert-definitions/security.md"
   - promptA: "prompts/code-reviewer.md@3a5f8e2" (old)
   - promptB: "prompts/code-reviewer.md" (current)
   - testContext: ["test-scenarios/", "examples/vulnerable-code.js"]

2. Compare approaches with real code samples:
   - expertDef: "expert-definitions/programming.md"
   - promptA: "prompts/approach-1.md"
   - promptB: "prompts/approach-2.md"
   - testContext: ["src/", "tests/"]

3. Cross-repository comparison with shared test suite:
   - expertDef: "expert-definitions/data-analysis.md"
   - promptA: "original-repo:prompts/analyzer.md"
   - promptB: "prompts/analyzer-enhanced.md"
   - testContext: ["shared-tests:data-samples/", "benchmarks/"]`,
      input_schema: {
        type: 'object',
        properties: {
          pathToExpertPromptDefinition: {
            type: 'string',
            description: 'Path to expert definition file (e.g., "expert-definitions/security.md")'
          },
          pathToPromptA: {
            type: 'string',
            description: 'Path to first prompt version (baseline). Can include @version for specific version.'
          },
          pathToPromptB: {
            type: 'string',
            description: 'Path to second prompt version (variant). Can include @version for specific version.'
          },
          testContextPaths: {
            type: 'array',
            description: 'Optional array of paths to test files/directories used during evaluation. Supports versioning and cross-repo references.',
            items: {
              type: 'string'
            }
          }
        },
        required: ['pathToExpertPromptDefinition', 'pathToPromptA', 'pathToPromptB']
      }
    };
  }
}

module.exports = { ABTestTool };