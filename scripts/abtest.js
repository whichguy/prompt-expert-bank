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
    // Calculate context metrics
    const contextMetrics = this.calculateContextMetrics(context);
    
    // Prepare template variables with enhanced metrics
    const variables = {
      EXPERT_NAME: this.extractExpertName(expert),
      TIMESTAMP: new Date().toISOString(),
      BASELINE_CONTENT: baseline.content || '',
      VARIANT_CONTENT: variant.content || '',
      CONTEXT_FILES: context || [],
      CONTEXT_FILE_COUNT: context ? context.length : 0,
      CONTEXT_SIZE: contextMetrics.totalSize,
      // Placeholder metrics - will be populated after API calls
      BASELINE_LATENCY: 0,
      VARIANT_LATENCY: 0,
      BASELINE_TOKENS: 0,
      BASELINE_INPUT_TOKENS: 0,
      BASELINE_OUTPUT_TOKENS: 0,
      VARIANT_TOKENS: 0,
      VARIANT_INPUT_TOKENS: 0,
      VARIANT_OUTPUT_TOKENS: 0
    };

    // Load and process template
    const prompt = await this.templateHelper.processTemplate(
      'templates/abtest-evaluation.md',
      variables
    );

    // Time the API call
    const startTime = performance.now();
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });
    const endTime = performance.now();
    
    // Extract metrics from response
    const responseMetrics = {
      latency: Math.round(endTime - startTime),
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
    };
    
    const text = response.content[0].text.toLowerCase();
    
    return {
      winner: text.includes('variant') ? 'variant' : 'baseline',
      confidence: text.includes('high') ? 'high' : 
                  text.includes('low') ? 'low' : 'medium',
      metrics: responseMetrics,
      fullResponse: response.content[0].text
    };
  }

  /**
   * Run thread-based evaluation where each prompt gets the same GitHub repo context
   */
  async runThreadEvaluation({ expert, baseline, variant, context, testScenario }) {
    // Calculate context metrics
    const contextMetrics = this.calculateContextMetrics(context);
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
    
    // Time Thread A execution
    const threadAStartTime = performance.now();
    const threadA = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: threadAPrompt }]
    });
    const threadAEndTime = performance.now();
    
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
    
    // Time Thread B execution
    const threadBStartTime = performance.now();
    const threadB = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{ role: 'user', content: threadBPrompt }]
    });
    const threadBEndTime = performance.now();
    
    // Prepare enhanced template variables with actual metrics
    const evaluationVariables = {
      EXPERT_NAME: this.extractExpertName(expert),
      TIMESTAMP: new Date().toISOString(),
      BASELINE_CONTENT: threadA.content[0].text,
      VARIANT_CONTENT: threadB.content[0].text,
      CONTEXT_FILES: context || [],
      CONTEXT_FILE_COUNT: context ? context.length : 0,
      CONTEXT_SIZE: contextMetrics.totalSize,
      BASELINE_LATENCY: Math.round(threadAEndTime - threadAStartTime),
      VARIANT_LATENCY: Math.round(threadBEndTime - threadBStartTime),
      BASELINE_TOKENS: (threadA.usage?.input_tokens || 0) + (threadA.usage?.output_tokens || 0),
      BASELINE_INPUT_TOKENS: threadA.usage?.input_tokens || 0,
      BASELINE_OUTPUT_TOKENS: threadA.usage?.output_tokens || 0,
      VARIANT_TOKENS: (threadB.usage?.input_tokens || 0) + (threadB.usage?.output_tokens || 0),
      VARIANT_INPUT_TOKENS: threadB.usage?.input_tokens || 0,
      VARIANT_OUTPUT_TOKENS: threadB.usage?.output_tokens || 0
    };
    
    // Generate evaluation using main template
    const evaluationPrompt = await this.templateHelper.processTemplate(
      'templates/abtest-evaluation.md',
      evaluationVariables
    );
    
    const evaluation = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: evaluationPrompt }]
    });
    
    const evaluationText = evaluation.content[0].text.toLowerCase();
    
    return {
      success: true,
      winner: evaluationText.includes('response b') || evaluationText.includes('variant') ? 'variant' : 'baseline',
      confidence: evaluationText.includes('high') ? 'high' : 
                  evaluationText.includes('low') ? 'low' : 'medium',
      threads: {
        baseline: threadA.content[0].text,
        variant: threadB.content[0].text,
        evaluation: evaluation.content[0].text
      },
      metrics: {
        baseline: {
          latency: Math.round(threadAEndTime - threadAStartTime),
          inputTokens: threadA.usage?.input_tokens || 0,
          outputTokens: threadA.usage?.output_tokens || 0,
          totalTokens: (threadA.usage?.input_tokens || 0) + (threadA.usage?.output_tokens || 0)
        },
        variant: {
          latency: Math.round(threadBEndTime - threadBStartTime),
          inputTokens: threadB.usage?.input_tokens || 0,
          outputTokens: threadB.usage?.output_tokens || 0,
          totalTokens: (threadB.usage?.input_tokens || 0) + (threadB.usage?.output_tokens || 0)
        },
        context: {
          filesUsed: context ? context.length : 0,
          totalSize: contextMetrics.totalSize,
          types: contextMetrics.types
        }
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

  /**
   * Calculate context metrics from files
   */
  calculateContextMetrics(context) {
    if (!context || context.length === 0) {
      return { totalSize: 0, types: [] };
    }

    let totalSize = 0;
    const typeMap = new Map();

    context.forEach(file => {
      const size = file.content ? file.content.length : 0;
      totalSize += size;
      
      // Detect file type from name/extension
      const ext = file.name.split('.').pop().toLowerCase();
      const type = this.detectFileType(ext);
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
      
      // Add size and type metadata to file object
      file.size = size;
      file.type = type;
    });

    return {
      totalSize,
      types: Array.from(typeMap.entries()).map(([type, count]) => `${type}(${count})`)
    };
  }

  /**
   * Detect file type from extension
   */
  detectFileType(extension) {
    const typeMap = {
      'js': 'JavaScript',
      'ts': 'TypeScript', 
      'jsx': 'React',
      'tsx': 'React TypeScript',
      'py': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'php': 'PHP',
      'rb': 'Ruby',
      'go': 'Go',
      'rs': 'Rust',
      'kt': 'Kotlin',
      'swift': 'Swift',
      'md': 'Markdown',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'xml': 'XML',
      'yaml': 'YAML',
      'yml': 'YAML',
      'toml': 'TOML',
      'sql': 'SQL',
      'sh': 'Shell',
      'bash': 'Bash',
      'dockerfile': 'Docker',
      'makefile': 'Makefile'
    };

    return typeMap[extension] || 'Text';
  }

  /**
   * Extract expert name from file path or content
   */
  extractExpertName(expert) {
    if (expert.name) return expert.name;
    
    // Try to extract from file path
    const pathParts = expert.path?.split('/') || [];
    const filename = pathParts[pathParts.length - 1];
    if (filename) {
      return filename.replace('.md', '').replace('-expert', '');
    }

    // Try to extract from content (look for title or role)
    const content = expert.content || '';
    const titleMatch = content.match(/^#\s*(.+)$/m);
    if (titleMatch) return titleMatch[1];

    const roleMatch = content.match(/role[:\s]+([^\n\r.]+)/i);
    if (roleMatch) return roleMatch[1];

    return 'Expert';
  }
}

module.exports = { ABTest };