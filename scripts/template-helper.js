/**
 * Template Helper - Utility for loading and processing MD templates
 * Handles variable replacement and conditional content
 */

class TemplateHelper {
  constructor(options = {}) {
    this.octokit = options.octokit;
    this.owner = options.owner || 'whichguy';
    this.repo = options.repo || 'prompt-expert-bank';
    this.cache = new Map();
  }

  /**
   * Load and process a template with variable substitution
   */
  async processTemplate(templatePath, variables = {}) {
    // Load template content
    const template = await this.loadTemplate(templatePath);
    
    // Replace variables
    let processed = this.replaceVariables(template, variables);
    
    // Handle conditional blocks
    processed = this.handleConditionals(processed, variables);
    
    return processed.trim();
  }

  /**
   * Load template from GitHub or cache
   */
  async loadTemplate(templatePath) {
    if (this.cache.has(templatePath)) {
      return this.cache.get(templatePath);
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: templatePath,
        ref: 'main'
      });

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      this.cache.set(templatePath, content);
      return content;
      
    } catch (error) {
      throw new Error(`Failed to load template ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Replace template variables {{VARIABLE_NAME}}
   */
  replaceVariables(template, variables) {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }
    
    return result;
  }

  /**
   * Handle conditional blocks {{#if VARIABLE}}...{{else}}...{{/if}}
   */
  handleConditionals(template, variables) {
    // Handle if/else/endif blocks
    const conditionalRegex = /{{#if\s+(\w+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
    
    return template.replace(conditionalRegex, (match, varName, ifContent, elseContent = '') => {
      const hasValue = variables[varName] && 
        (typeof variables[varName] === 'string' ? variables[varName].trim() : true);
      
      return hasValue ? ifContent : elseContent;
    });
  }

  /**
   * Get available templates
   */
  static getAvailableTemplates() {
    return {
      'abtest-prompt': 'templates/abtest-prompt.md',
      'abtest-evaluation': 'templates/abtest-evaluation.md', 
      'thread-evaluation': 'templates/thread-evaluation.md',
      'expert-comparison': 'templates/expert-comparison.md'
    };
  }

  /**
   * Create template variables for thread evaluation
   */
  static createThreadVariables(promptContent, testScenario, contextContent = null) {
    return {
      PROMPT_CONTENT: promptContent,
      TEST_SCENARIO: testScenario,
      CONTEXT_AVAILABLE: !!contextContent,
      CONTEXT_CONTENT: contextContent || ''
    };
  }

  /**
   * Create template variables for expert comparison
   */
  static createComparisonVariables(config) {
    const {
      expertContent,
      testScenario,
      responseA,
      responseB,
      labelA = 'Baseline',
      labelB = 'Variant',
      domain = 'technical',
      iterationContext = null,
      contextNote = null
    } = config;

    return {
      EXPERT_CONTENT: expertContent,
      TEST_SCENARIO: testScenario,
      RESPONSE_A_CONTENT: responseA,
      RESPONSE_B_CONTENT: responseB,
      RESPONSE_A_LABEL: labelA,
      RESPONSE_B_LABEL: labelB,
      DOMAIN: domain,
      ITERATION_CONTEXT: iterationContext,
      CONTEXT_NOTE: contextNote
    };
  }
}

module.exports = { TemplateHelper };