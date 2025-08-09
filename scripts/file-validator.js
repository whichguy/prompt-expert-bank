/**
 * File Validator for Claude Code Session
 * Validates file paths mentioned in comments exist and are accessible
 */

const fs = require('fs');
const path = require('path');

class FileValidator {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot || process.env.GITHUB_WORKSPACE || process.cwd();
  }

  /**
   * Extract file paths from comment text
   */
  extractFilePaths(text) {
    const patterns = [
      // Markdown file references
      /\[([^\]]+)\]\(([^)]+\.(md|js|json|txt|yml|yaml))\)/gi,
      // Direct file paths
      /(?:^|\s)((?:[\w-]+\/)*[\w-]+\.\w+)(?:\s|$)/gm,
      // Quoted paths
      /["']([^"']+\.(md|js|json|txt|yml|yaml))["']/gi,
      // Backtick paths
      /`([^`]+\.(md|js|json|txt|yml|yaml))`/gi,
      // Common patterns
      /(?:prompts|experts|templates|scripts)\/[\w-]+\.(?:md|js|json)/gi
    ];

    const paths = new Set();
    
    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        // Get the file path from capture groups
        const filePath = match[2] || match[1] || match[0];
        if (filePath && !filePath.startsWith('http')) {
          paths.add(filePath);
        }
      }
    });

    return Array.from(paths);
  }

  /**
   * Validate if file exists and is readable
   */
  validateFile(filePath) {
    try {
      const fullPath = path.join(this.workspaceRoot, filePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return {
          path: filePath,
          valid: false,
          error: 'File not found',
          suggestion: this.suggestAlternative(filePath)
        };
      }

      // Check if readable
      fs.accessSync(fullPath, fs.constants.R_OK);
      
      // Get file info
      const stats = fs.statSync(fullPath);
      
      return {
        path: filePath,
        valid: true,
        size: stats.size,
        exists: true
      };
    } catch (error) {
      return {
        path: filePath,
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Suggest alternative paths if file not found
   */
  suggestAlternative(filePath) {
    const suggestions = [];
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath);

    // Common directory mappings
    const mappings = {
      'expert-definitions': 'experts',
      'expert_definitions': 'experts',
      'prompt': 'prompts',
      'template': 'templates',
      'script': 'scripts'
    };

    // Check if directory name needs correction
    Object.entries(mappings).forEach(([wrong, correct]) => {
      if (dirName.includes(wrong)) {
        const corrected = filePath.replace(wrong, correct);
        if (fs.existsSync(path.join(this.workspaceRoot, corrected))) {
          suggestions.push(corrected);
        }
      }
    });

    // Search for file in common directories
    const commonDirs = ['prompts', 'experts', 'templates', 'scripts'];
    commonDirs.forEach(dir => {
      const testPath = path.join(dir, fileName);
      if (fs.existsSync(path.join(this.workspaceRoot, testPath))) {
        suggestions.push(testPath);
      }
    });

    return suggestions.length > 0 ? suggestions[0] : null;
  }

  /**
   * Validate all files mentioned in comment
   */
  validateComment(comment) {
    const files = this.extractFilePaths(comment);
    const results = {
      valid: [],
      invalid: [],
      suggestions: {}
    };

    files.forEach(file => {
      const validation = this.validateFile(file);
      if (validation.valid) {
        results.valid.push(file);
      } else {
        results.invalid.push(file);
        if (validation.suggestion) {
          results.suggestions[file] = validation.suggestion;
        }
      }
    });

    return results;
  }

  /**
   * Generate validation report
   */
  generateReport(validation) {
    const lines = [];
    
    if (validation.invalid.length > 0) {
      lines.push('⚠️ **File Access Issues Detected**\n');
      lines.push('The following files mentioned could not be accessed:');
      
      validation.invalid.forEach(file => {
        lines.push(`- ❌ \`${file}\``);
        if (validation.suggestions[file]) {
          lines.push(`  → Did you mean: \`${validation.suggestions[file]}\`?`);
        }
      });
      
      lines.push('\n**Note**: Please verify file paths. The workflow has access to:');
      lines.push('- `prompts/` - Prompt templates');
      lines.push('- `experts/` - Expert definitions');
      lines.push('- `templates/` - Evaluation templates');
      lines.push('- `scripts/` - Utility scripts');
    }
    
    if (validation.valid.length > 0) {
      lines.push('\n✅ **Accessible Files**:');
      validation.valid.forEach(file => {
        lines.push(`- \`${file}\``);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Load file contents for valid files
   */
  loadFiles(validation) {
    const contents = {};
    
    validation.valid.forEach(file => {
      try {
        const fullPath = path.join(this.workspaceRoot, file);
        contents[file] = fs.readFileSync(fullPath, 'utf8');
      } catch (error) {
        console.error(`Error loading ${file}: ${error.message}`);
      }
    });
    
    // Also load suggested alternatives
    Object.entries(validation.suggestions).forEach(([original, suggested]) => {
      try {
        const fullPath = path.join(this.workspaceRoot, suggested);
        contents[suggested] = fs.readFileSync(fullPath, 'utf8');
        contents[`${original} (corrected to ${suggested})`] = contents[suggested];
      } catch (error) {
        console.error(`Error loading suggested ${suggested}: ${error.message}`);
      }
    });
    
    return contents;
  }
}

module.exports = { FileValidator };