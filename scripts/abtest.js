/**
 * Simple A/B Test Tool
 * Clean implementation without overcomplication
 */

const { Octokit } = require('@octokit/rest');

class ABTest {
  constructor(options) {
    this.octokit = options.octokit;
    this.anthropic = options.anthropic;
    this.owner = options.owner || 'whichguy';
    this.repo = options.repo || 'prompt-expert-bank';
    this.cache = new Map();
  }

  async run(config) {
    const { expert, promptA, promptB, context = [] } = config;
    
    try {
      // Load files
      const [expertDef, baselinePrompt, variantPrompt] = await Promise.all([
        this.loadFile(expert),
        this.loadFile(promptA),
        this.loadFile(promptB)
      ]);
      
      // Load context if provided
      const contextData = await this.loadContext(context);
      
      // Evaluate
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
    // Load the template
    const template = await this.loadTemplate('templates/abtest-prompt.md');
    
    // Build context names if available
    const contextNames = context && context.length > 0 ? 
      context.map(f => f.name).join(', ') : '';
    
    // Replace template variables
    const prompt = template
      .replace(/{{EXPERT_CONTENT}}/g, expert.content || '')
      .replace(/{{CONTEXT_NAMES}}/g, contextNames)
      .replace(/{{BASELINE_CONTENT}}/g, baseline.content || '')
      .replace(/{{VARIANT_CONTENT}}/g, variant.content || '')
      .replace(/{{#if CONTEXT_FILES}}[\s\S]*?{{else}}([\s\S]*?){{\/if}}/g, 
        context && context.length > 0 ? 
          `Context files provided: ${contextNames}` : 
          'No additional context files provided.');

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

  async loadTemplate(templatePath) {
    try {
      // Try to load from GitHub first
      const templateFile = await this.loadFile(templatePath);
      return templateFile.content;
    } catch (error) {
      // Fallback to basic template if file not found
      return `You are: {{EXPERT_CONTENT}}

Context: {{CONTEXT_NAMES}}

Compare:
BASELINE: {{BASELINE_CONTENT}}
VARIANT: {{VARIANT_CONTENT}}

Which is better? Respond with:
- Winner: baseline or variant
- Confidence: high/medium/low
- Reason: brief explanation`;
    }
  }
}

module.exports = { ABTest };