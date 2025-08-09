/**
 * Simple A/B Test Tool
 * Clean implementation without overcomplication
 */

const { Octokit } = require('@octokit/rest');
const { TemplateHelper } = require('./template-helper');

class ABTest {
  constructor(options) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.owner = options.owner || 'whichguy';
    this.repo = options.repo || 'prompt-expert-bank';
    this.cache = new Map();
    this.templateHelper = new TemplateHelper({
      octokit: this.octokit,
      owner: this.owner,
      repo: this.repo
    });
  }

  async run(config) {
    const { expert, promptA, promptB, context = [], testScenario } = config;
    
    try {
      // Load files
      const [expertDef, baselinePrompt, variantPrompt] = await Promise.all([
        this.loadFile(expert),
        this.loadFile(promptA),
        this.loadFile(promptB)
      ]);
      
      // Load context if provided
      const contextData = await this.loadContext(context);
      
      // If test scenario provided, run thread-based evaluation
      if (testScenario) {
        return await this.runThreadEvaluation({
          expert: expertDef,
          baseline: baselinePrompt,
          variant: variantPrompt,
          context: contextData,
          testScenario
        });
      }
      
      // Otherwise run simple comparison
      const result = await this.evaluate({
        expert: expertDef,
        baseline: baselinePrompt,
        variant: variantPrompt,
        context: contextData
      });
      
      return {
        success: true,
        winner: result.winner,
        confidence: result.confidence
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  parsePath(input) {
    const [pathPart, ref = 'main'] = input.split('@');
    
    if (pathPart.includes(':')) {
      const [repoPart, filePath] = pathPart.split(':');
      const [owner, repo] = repoPart.split('/');
      return { owner, repo, path: filePath, ref };
    }
    
    return {
      owner: this.owner,
      repo: this.repo,
      path: pathPart,
      ref
    };
  }

  async loadFile(pathStr) {
    const parsed = this.parsePath(pathStr);
    const cacheKey = `${parsed.owner}/${parsed.repo}/${parsed.path}@${parsed.ref}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const { data } = await this.octokit.repos.getContent(parsed);
      
      if (Array.isArray(data)) {
        return { type: 'directory', files: data.map(f => f.name) };
      }
      
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const result = { name: data.name, content };
      
      this.cache.set(cacheKey, result);
      return result;
      
    } catch (error) {
      throw new Error(`Failed to load ${parsed.path}: ${error.message}`);
    }
  }

  async loadContext(paths) {
    if (!paths || paths.length === 0) return [];
    
    const results = await Promise.allSettled(
      paths.slice(0, 50).map(p => this.loadFile(p))
    );
    
    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async evaluate({ expert, baseline, variant, context }) {
    // Build context names if available
    const contextNames = context && context.length > 0 ? 
      context.map(f => f.name).join(', ') : '';
    
    // Prepare template variables
    const variables = {
      EXPERT_CONTENT: expert.content || '',
      CONTEXT_FILES: context && context.length > 0,
      CONTEXT_NAMES: contextNames,
      BASELINE_CONTENT: baseline.content || '',
      VARIANT_CONTENT: variant.content || ''
    };

    // Load and process template
    const prompt = await this.templateHelper.processTemplate(
      'templates/abtest-prompt.md',
      variables
    );

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const text = response.content[0].text.toLowerCase();
    
    return {
      winner: text.includes('variant') ? 'variant' : 'baseline',
      confidence: text.includes('high') ? 'high' : 
                  text.includes('low') ? 'low' : 'medium'
    };
  }

  /**
   * Run thread-based evaluation where each prompt gets the same GitHub repo context
   */
  async runThreadEvaluation({ expert, baseline, variant, context, testScenario }) {
    // Prepare context content for threads
    const contextContent = this.formatContextForThreads(context);
    
    // Thread A: Evaluate baseline prompt with repository context
    const threadAVariables = TemplateHelper.createThreadVariables(
      baseline.content,
      testScenario,
      contextContent
    );
    
    const threadAPrompt = await this.templateHelper.processTemplate(
      'templates/thread-evaluation.md',
      threadAVariables
    );
    
    const threadA = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: threadAPrompt }]
    });
    
    // Thread B: Evaluate variant prompt with same repository context  
    const threadBVariables = TemplateHelper.createThreadVariables(
      variant.content,
      testScenario,
      contextContent
    );
    
    const threadBPrompt = await this.templateHelper.processTemplate(
      'templates/thread-evaluation.md',
      threadBVariables
    );
    
    const threadB = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: threadBPrompt }]
    });
    
    // Thread C: Expert comparison
    const comparisonVariables = TemplateHelper.createComparisonVariables({
      expertContent: expert.content,
      testScenario,
      responseA: threadA.content[0].text,
      responseB: threadB.content[0].text,
      labelA: 'Baseline',
      labelB: 'Variant',
      contextNote: context.length > 0 ? 
        `Both responses had access to ${context.length} repository files for context.` : null
    });
    
    const comparisonPrompt = await this.templateHelper.processTemplate(
      'templates/expert-comparison.md',
      comparisonVariables
    );
    
    const comparison = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: comparisonPrompt }]
    });
    
    const comparisonText = comparison.content[0].text.toLowerCase();
    
    return {
      success: true,
      winner: comparisonText.includes('response b') ? 'variant' : 'baseline',
      confidence: comparisonText.includes('high') ? 'high' : 
                  comparisonText.includes('low') ? 'low' : 'medium',
      threads: {
        baseline: threadA.content[0].text,
        variant: threadB.content[0].text,
        comparison: comparison.content[0].text
      },
      context: {
        filesUsed: context.length,
        contextProvided: contextContent ? contextContent.length : 0
      }
    };
  }

  /**
   * Format context files for thread consumption
   */
  formatContextForThreads(context) {
    if (!context || context.length === 0) return null;
    
    return context.map(file => {
      return `### ${file.name}\n\`\`\`\n${file.content}\n\`\`\``;
    }).join('\n\n');
  }
}

module.exports = { ABTest };