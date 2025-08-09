/**
 * Command Parser for @prompt-expert commands
 * Parses commands from GitHub comments
 */

class CommandParser {
  constructor() {
    // Pattern: @prompt-expert <expert> [--options] <prompt>
    this.commandPattern = /^@prompt-expert\s+(\S+)(?:\s+(--[\s\S]*?))?\s+([\s\S]+)$/;
    this.optionPattern = /--([\w-]+)(?:=([^\s]+))?/g;
  }

  /**
   * Parse a comment body for @prompt-expert commands
   * @param {string} commentBody - The full comment text
   * @returns {Object|null} Parsed command or null if not found
   */
  parse(commentBody) {
    if (!commentBody) return null;
    
    // Find @prompt-expert command in the comment
    const lines = commentBody.split('\n');
    let commandLine = '';
    let inCommand = false;
    
    for (const line of lines) {
      if (line.trim().startsWith('@prompt-expert')) {
        inCommand = true;
        commandLine = line.trim();
        break;
      }
    }
    
    if (!inCommand) {
      // Try multiline command
      const fullText = commentBody.trim();
      if (fullText.startsWith('@prompt-expert')) {
        commandLine = fullText;
      } else {
        return null;
      }
    }
    
    // Parse the command
    const match = commandLine.match(this.commandPattern);
    if (!match) {
      // Try simpler pattern without required prompt
      const simpleMatch = commandLine.match(/^@prompt-expert\s+(\S+)(?:\s+(.*))?$/);
      if (simpleMatch) {
        const [, expert, rest = ''] = simpleMatch;
        const { options, prompt } = this.parseOptionsAndPrompt(rest);
        
        return {
          expert: expert,
          options: options,
          prompt: prompt || 'Please help with this task',
          raw: commandLine
        };
      }
      return null;
    }
    
    const [, expert, optionsStr = '', prompt] = match;
    
    // Parse options
    const options = this.parseOptions(optionsStr);
    
    return {
      expert: expert,
      options: options,
      prompt: prompt.trim(),
      raw: commandLine
    };
  }

  /**
   * Parse options and prompt from a mixed string
   * @param {string} text - Text containing options and prompt
   * @returns {Object} Object with options and prompt
   */
  parseOptionsAndPrompt(text) {
    const options = {};
    let prompt = text;
    
    // Extract all options first
    const optionMatches = [...text.matchAll(this.optionPattern)];
    
    if (optionMatches.length > 0) {
      // Find where options end and prompt begins
      let lastOptionEnd = 0;
      
      for (const match of optionMatches) {
        const [fullMatch, key, value] = match;
        options[key] = value || true;
        lastOptionEnd = Math.max(lastOptionEnd, match.index + fullMatch.length);
      }
      
      // Everything after the last option is the prompt
      prompt = text.substring(lastOptionEnd).trim();
    }
    
    return { options, prompt };
  }

  /**
   * Parse option string into object
   * @param {string} optionsStr - String containing --key=value pairs
   * @returns {Object} Parsed options
   */
  parseOptions(optionsStr) {
    const options = {};
    
    if (!optionsStr) return options;
    
    let match;
    while ((match = this.optionPattern.exec(optionsStr)) !== null) {
      const [, key, value] = match;
      
      // Handle boolean flags and values
      if (value === undefined) {
        options[key] = true;
      } else if (value === 'true') {
        options[key] = true;
      } else if (value === 'false') {
        options[key] = false;
      } else if (!isNaN(value)) {
        options[key] = Number(value);
      } else {
        options[key] = value;
      }
    }
    
    return options;
  }

  /**
   * Validate a parsed command
   * @param {Object} command - Parsed command object
   * @returns {Object} Validation result
   */
  validate(command) {
    const errors = [];
    const warnings = [];
    
    if (!command) {
      errors.push('No command found');
      return { valid: false, errors, warnings };
    }
    
    // Check expert
    const validExperts = [
      'programming', 'security', 'code-reviewer', 'data-analysis',
      'financial', 'general', 'custom'
    ];
    
    if (!validExperts.includes(command.expert) && !command.expert.includes('/')) {
      warnings.push(`Unknown expert: ${command.expert}. Will attempt to load as custom expert.`);
    }
    
    // Check for dangerous options
    if (command.options.force && command.options.autoMerge) {
      warnings.push('Both --force and --auto-merge specified. Use with caution.');
    }
    
    // Check prompt length
    if (command.prompt && command.prompt.length > 10000) {
      errors.push('Prompt too long (max 10000 characters)');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = { CommandParser };