/**
 * Tool Definitions for Claude Code
 * Defines all available tools that Claude can use
 */

// Base tools available in all contexts
const BASE_TOOLS = [
  // === Prompt Evaluation Tools ===
  {
    name: 'evaluate_prompt',
    description: 'Evaluate a prompt with an expert and test scenarios',
    input_schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to evaluate'
        },
        expert: {
          type: 'string',
          description: 'Expert to use for evaluation (e.g., programming, security)',
          default: 'programming'
        },
        testScenarios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              input: { type: 'string' },
              expectedBehavior: { type: 'string' }
            }
          },
          description: 'Test scenarios to run'
        },
        compareWith: {
          type: 'string',
          enum: ['none', 'baseline', 'custom'],
          default: 'none'
        },
        customBaseline: {
          type: 'string',
          description: 'Custom baseline prompt for comparison'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'run_prompt_ab_test',
    description: 'Run A/B test between two prompts',
    input_schema: {
      type: 'object',
      properties: {
        promptA: {
          type: 'string',
          description: 'First prompt variant'
        },
        promptB: {
          type: 'string',
          description: 'Second prompt variant'
        },
        testCases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Test cases to run against both prompts'
        },
        evaluationCriteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'Criteria for evaluation'
        }
      },
      required: ['promptA', 'promptB']
    }
  },
  {
    name: 'analyze_prompt_performance',
    description: 'Analyze performance metrics of a prompt',
    input_schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Prompt to analyze'
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['clarity', 'specificity', 'efficiency', 'robustness']
          },
          description: 'Metrics to evaluate'
        }
      },
      required: ['prompt']
    }
  },
  
  // === File Operations ===
  {
    name: 'read_file',
    description: 'Read file contents from the repository',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to repository root'
        },
        ref: {
          type: 'string',
          enum: ['head', 'base', 'main'],
          default: 'head',
          description: 'Git reference to read from'
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'base64'],
          default: 'utf8',
          description: 'Encoding for file content'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write or update file in the repository',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to repository root'
        },
        content: {
          type: 'string',
          description: 'File content to write'
        },
        mode: {
          type: 'string',
          enum: ['create', 'update', 'overwrite'],
          default: 'update',
          description: 'Write mode'
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'base64'],
          default: 'utf8',
          description: 'Content encoding'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the repository',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to delete'
        }
      },
      required: ['path']
    }
  },
  
  // === Search Operations ===
  {
    name: 'search_repository',
    description: 'Search for code patterns in the repository',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (regex or text)'
        },
        type: {
          type: 'string',
          enum: ['regex', 'text'],
          default: 'text',
          description: 'Search type'
        },
        fileExtension: {
          type: 'string',
          description: 'Filter by file extension (e.g., .js, .py)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_directory',
    description: 'List files in a directory',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          default: '.',
          description: 'Directory path'
        },
        recursive: {
          type: 'boolean',
          default: false,
          description: 'List recursively'
        }
      }
    }
  },
  
  // === Git Operations ===
  {
    name: 'git_diff',
    description: 'Get git diff for files',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or directory path'
        },
        base: {
          type: 'string',
          default: 'HEAD',
          description: 'Base reference for diff'
        }
      }
    }
  },
  {
    name: 'git_commit',
    description: 'Create a git commit',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message'
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files to commit (empty for all staged)'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'git_command',
    description: 'Execute a git command',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Git command (e.g., status, log, branch)'
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          default: [],
          description: 'Command arguments'
        }
      },
      required: ['command']
    }
  },
  
  // === Command Execution ===
  {
    name: 'run_command',
    description: 'Execute a shell command (restricted in safe mode)',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Command to execute'
        },
        workingDir: {
          type: 'string',
          default: '.',
          description: 'Working directory'
        },
        safe: {
          type: 'boolean',
          default: true,
          description: 'Run in safe mode (restricts dangerous commands)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'run_tests',
    description: 'Run test suite',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Test file pattern (e.g., **/*.test.js)'
        },
        framework: {
          type: 'string',
          enum: ['jest', 'mocha', 'pytest', 'auto'],
          default: 'auto',
          description: 'Test framework'
        }
      }
    }
  },
  
  // === Environment ===
  {
    name: 'get_env_variable',
    description: 'Get environment variable value',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Environment variable name'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'access_secret',
    description: 'Request access to a GitHub secret (requires justification)',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Secret name'
        },
        reason: {
          type: 'string',
          description: 'Reason for accessing the secret'
        }
      },
      required: ['name', 'reason']
    }
  }
];

// PR-specific tools (only available in PR context)
const PR_TOOLS = [
  {
    name: 'pr_comment',
    description: 'Add a comment to the PR',
    input_schema: {
      type: 'object',
      properties: {
        body: {
          type: 'string',
          description: 'Comment body (supports markdown)'
        },
        replyTo: {
          type: 'number',
          description: 'Comment ID to reply to'
        }
      },
      required: ['body']
    }
  },
  {
    name: 'pr_review',
    description: 'Submit a PR review',
    input_schema: {
      type: 'object',
      properties: {
        body: {
          type: 'string',
          description: 'Review body'
        },
        event: {
          type: 'string',
          enum: ['COMMENT', 'APPROVE', 'REQUEST_CHANGES'],
          default: 'COMMENT'
        },
        comments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              line: { type: 'number' },
              body: { type: 'string' }
            }
          },
          description: 'Inline review comments'
        }
      },
      required: ['body']
    }
  },
  {
    name: 'pr_request_reviewers',
    description: 'Request reviewers for the PR',
    input_schema: {
      type: 'object',
      properties: {
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'GitHub usernames to request review from'
        },
        teams: {
          type: 'array',
          items: { type: 'string' },
          description: 'Team slugs to request review from'
        }
      }
    }
  },
  {
    name: 'pr_add_labels',
    description: 'Add labels to the PR',
    input_schema: {
      type: 'object',
      properties: {
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Label names to add'
        }
      },
      required: ['labels']
    }
  },
  {
    name: 'pr_remove_labels',
    description: 'Remove labels from the PR',
    input_schema: {
      type: 'object',
      properties: {
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Label names to remove'
        }
      },
      required: ['labels']
    }
  },
  {
    name: 'pr_update_title',
    description: 'Update PR title',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'New PR title'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'pr_update_description',
    description: 'Update PR description',
    input_schema: {
      type: 'object',
      properties: {
        body: {
          type: 'string',
          description: 'New PR description (supports markdown)'
        }
      },
      required: ['body']
    }
  },
  {
    name: 'pr_merge',
    description: 'Merge the PR',
    input_schema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['merge', 'squash', 'rebase'],
          default: 'squash'
        },
        message: {
          type: 'string',
          description: 'Merge commit message'
        }
      }
    }
  },
  {
    name: 'pr_close',
    description: 'Close the PR without merging',
    input_schema: {
      type: 'object',
      properties: {
        comment: {
          type: 'string',
          description: 'Closing comment'
        }
      }
    }
  }
];

// Issue-specific tools (only available in Issue context)
const ISSUE_TOOLS = [
  {
    name: 'issue_comment',
    description: 'Add a comment to the issue',
    input_schema: {
      type: 'object',
      properties: {
        body: {
          type: 'string',
          description: 'Comment body (supports markdown)'
        }
      },
      required: ['body']
    }
  },
  {
    name: 'issue_add_labels',
    description: 'Add labels to the issue',
    input_schema: {
      type: 'object',
      properties: {
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Label names to add'
        }
      },
      required: ['labels']
    }
  },
  {
    name: 'issue_remove_labels',
    description: 'Remove labels from the issue',
    input_schema: {
      type: 'object',
      properties: {
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Label names to remove'
        }
      },
      required: ['labels']
    }
  },
  {
    name: 'issue_assign',
    description: 'Assign users to the issue',
    input_schema: {
      type: 'object',
      properties: {
        assignees: {
          type: 'array',
          items: { type: 'string' },
          description: 'GitHub usernames to assign'
        }
      },
      required: ['assignees']
    }
  },
  {
    name: 'issue_unassign',
    description: 'Unassign users from the issue',
    input_schema: {
      type: 'object',
      properties: {
        assignees: {
          type: 'array',
          items: { type: 'string' },
          description: 'GitHub usernames to unassign'
        }
      },
      required: ['assignees']
    }
  },
  {
    name: 'issue_update_title',
    description: 'Update issue title',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'New issue title'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'issue_update_body',
    description: 'Update issue body',
    input_schema: {
      type: 'object',
      properties: {
        body: {
          type: 'string',
          description: 'New issue body (supports markdown)'
        }
      },
      required: ['body']
    }
  },
  {
    name: 'issue_close',
    description: 'Close the issue',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['completed', 'not_planned'],
          default: 'completed'
        },
        comment: {
          type: 'string',
          description: 'Closing comment'
        }
      }
    }
  },
  {
    name: 'issue_reopen',
    description: 'Reopen a closed issue',
    input_schema: {
      type: 'object',
      properties: {
        comment: {
          type: 'string',
          description: 'Reopening comment'
        }
      }
    }
  }
];

/**
 * Get tools based on context
 * @param {string} contextType - 'pr' or 'issue'
 * @returns {Array} Array of tool definitions
 */
function getToolsForContext(contextType) {
  if (contextType === 'pr') {
    return [...BASE_TOOLS, ...PR_TOOLS];
  } else if (contextType === 'issue') {
    return [...BASE_TOOLS, ...ISSUE_TOOLS];
  } else {
    return BASE_TOOLS;
  }
}

/**
 * Format tools for Claude API
 * @param {Array} tools - Array of tool definitions
 * @returns {Array} Formatted tools for Claude
 */
function formatToolsForClaude(tools) {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema
  }));
}

/**
 * Validate tool call against schema
 * @param {Object} toolCall - Tool call from Claude
 * @param {Object} toolDef - Tool definition
 * @returns {Object} Validation result
 */
function validateToolCall(toolCall, toolDef) {
  const errors = [];
  const warnings = [];
  
  // Check required parameters
  const required = toolDef.input_schema.required || [];
  for (const param of required) {
    if (!(param in toolCall.arguments)) {
      errors.push(`Missing required parameter: ${param}`);
    }
  }
  
  // Check parameter types
  const properties = toolDef.input_schema.properties || {};
  for (const [key, value] of Object.entries(toolCall.arguments || {})) {
    if (!(key in properties)) {
      warnings.push(`Unknown parameter: ${key}`);
      continue;
    }
    
    const schema = properties[key];
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (schema.type && schema.type !== actualType) {
      errors.push(`Parameter ${key} should be ${schema.type}, got ${actualType}`);
    }
    
    // Check enum values
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Parameter ${key} must be one of: ${schema.enum.join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get tool definition by name
 * @param {string} name - Tool name
 * @param {string} contextType - Context type ('pr' or 'issue')
 * @returns {Object|null} Tool definition or null
 */
function getToolByName(name, contextType) {
  const tools = getToolsForContext(contextType);
  return tools.find(t => t.name === name) || null;
}

module.exports = {
  BASE_TOOLS,
  PR_TOOLS,
  ISSUE_TOOLS,
  getToolsForContext,
  formatToolsForClaude,
  validateToolCall,
  getToolByName,
  CLAUDE_TOOLS: getToolsForContext  // Alias for backward compatibility
};