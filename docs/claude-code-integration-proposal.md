# Claude Code Integration Proposal for Prompt Expert System

## Executive Summary
This proposal outlines a comprehensive system for integrating Claude Code into the prompt-expert workflow, enabling Claude to analyze PRs, modify files, and execute actions through a structured tool-based interface with full environmental context and PR operations.

## System Architecture

### 1. Command Interface
```yaml
# PR comment syntax
@prompt-expert <expert> [--options] <free-form-prompt>

# Examples:
@prompt-expert security --aggressive "Review this SQL implementation for injection vulnerabilities"
@prompt-expert programming --context=full --fix "Optimize the performance of this React component"
@prompt-expert code-reviewer --auto-fix --test "Add comprehensive error handling to all API endpoints"
```

### 2. Environmental Context System

#### 2.1 PR Context Injection
```javascript
const PR_CONTEXT = {
  // Pull Request Details
  pr: {
    number: process.env.PR_NUMBER,
    title: prData.title,
    description: prData.body,
    author: prData.user.login,
    branch: {
      head: prData.head.ref,
      base: prData.base.ref
    },
    labels: prData.labels.map(l => l.name),
    reviewers: prData.requested_reviewers,
    reviews: await getPRReviews(),
    status: {
      mergeable: prData.mergeable,
      state: prData.state,
      checks: await getCheckRuns()
    }
  },
  
  // Files Changed
  files: {
    changed: filesChanged.map(f => ({
      filename: f.filename,
      status: f.status, // added, modified, deleted
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
      previousFilename: f.previous_filename
    })),
    total: filesChanged.length
  },
  
  // Repository Information
  repository: {
    owner: process.env.GITHUB_REPOSITORY_OWNER,
    name: process.env.GITHUB_REPOSITORY_NAME,
    fullName: process.env.GITHUB_REPOSITORY,
    defaultBranch: repoData.default_branch,
    visibility: repoData.visibility,
    topics: repoData.topics
  },
  
  // GitHub Actions Context
  workflow: {
    runId: process.env.GITHUB_RUN_ID,
    runNumber: process.env.GITHUB_RUN_NUMBER,
    workflow: process.env.GITHUB_WORKFLOW,
    action: process.env.GITHUB_ACTION,
    actor: process.env.GITHUB_ACTOR,
    triggeredBy: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA
  },
  
  // Comments History
  comments: await getPRComments(),
  
  // Related Issues
  linkedIssues: await getLinkedIssues()
};
```

#### 2.2 Environment Variables Access
```javascript
const ENV_CONTEXT = {
  // Safe environment variables (non-sensitive)
  safe: {
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
    GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
    GITHUB_WORKSPACE: process.env.GITHUB_WORKSPACE,
    RUNNER_OS: process.env.RUNNER_OS,
    RUNNER_ARCH: process.env.RUNNER_ARCH,
    // ... other safe vars
  },
  
  // Masked sensitive variables (existence only)
  masked: {
    ANTHROPIC_API_KEY: '***exists***',
    GITHUB_TOKEN: '***exists***',
    OPENAI_API_KEY: '***exists***',
    // ... other secrets
  }
};
```

### 3. Tool Definitions for Claude

```javascript
// Determine context type (Issue vs PR)
const IS_PULL_REQUEST = !!context.pullRequest;
const IS_ISSUE = !IS_PULL_REQUEST && !!context.issue;

// Base tools available for both Issues and PRs
const BASE_TOOLS = [
  // === PROMPT EVALUATION ===
  {
    name: "evaluate_prompt",
    description: "Execute the prompt with an expert and analyze the results",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt to evaluate"
        },
        expert: {
          type: "string",
          description: "Expert to use (e.g., 'security', 'programming', 'code-reviewer')",
          default: "programming"
        },
        testScenarios: {
          type: "array",
          items: {
            type: "object",
            properties: {
              input: { type: "string" },
              expectedBehavior: { type: "string" }
            }
          },
          description: "Test scenarios to run against the prompt"
        },
        compareWith: {
          type: "string",
          description: "Compare with baseline/current prompt (optional)",
          enum: ["baseline", "none", "custom"]
        },
        customBaseline: {
          type: "string",
          description: "Custom baseline prompt for comparison (if compareWith='custom')"
        }
      },
      required: ["prompt"]
    }
  },
  
  {
    name: "run_prompt_ab_test",
    description: "Run A/B test comparing two prompts with expert evaluation",
    input_schema: {
      type: "object",
      properties: {
        promptA: {
          type: "string",
          description: "First prompt (usually current/baseline)"
        },
        promptB: {
          type: "string",
          description: "Second prompt (usually proposed/new)"
        },
        expert: {
          type: "string",
          description: "Expert to use for evaluation"
        },
        testCount: {
          type: "number",
          description: "Number of test scenarios to run",
          default: 3
        },
        criteria: {
          type: "array",
          items: { type: "string" },
          description: "Specific evaluation criteria to focus on"
        }
      },
      required: ["promptA", "promptB"]
    }
  },
  
  {
    name: "analyze_prompt_performance",
    description: "Analyze how well a prompt performs against specific criteria",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Prompt to analyze"
        },
        analysisType: {
          type: "string",
          description: "Type of analysis",
          enum: ["security", "performance", "accuracy", "clarity", "comprehensive"]
        },
        context: {
          type: "object",
          properties: {
            domain: { type: "string" },
            useCase: { type: "string" },
            targetAudience: { type: "string" }
          },
          description: "Additional context for analysis"
        }
      },
      required: ["prompt"]
    }
  },
  
  // === FILE OPERATIONS ===
  {
    name: "read_file",
    description: "Read the contents of a file from the repository",
    input_schema: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "Path to the file relative to repository root" 
        },
        ref: {
          type: "string",
          description: "Git ref to read from (default: PR head)",
          enum: ["head", "base", "main"]
        },
        encoding: {
          type: "string",
          description: "Encoding format (utf8 for text, base64 for binary)",
          enum: ["utf8", "base64"],
          default: "utf8"
        }
      },
      required: ["path"]
    }
  },
  
  {
    name: "write_file",
    description: "Write or modify a file in the PR branch",
    input_schema: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "Path to the file relative to repository root" 
        },
        content: { 
          type: "string", 
          description: "File content (text or base64 encoded binary)" 
        },
        mode: {
          type: "string",
          description: "Write mode",
          enum: ["create", "update", "append"]
        },
        encoding: {
          type: "string",
          description: "Content encoding (utf8 for text, base64 for binary data)",
          enum: ["utf8", "base64"],
          default: "utf8"
        }
      },
      required: ["path", "content"]
    }
  },
  
  {
    name: "delete_file",
    description: "Delete a file from the PR branch",
    input_schema: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "Path to the file to delete" 
        }
      },
      required: ["path"]
    }
  },
  
  // === SEARCH & NAVIGATION ===
  {
    name: "search_repository",
    description: "Search for files or content in the repository",
    input_schema: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Search query" 
        },
        type: {
          type: "string",
          description: "Search type",
          enum: ["content", "filename", "path"]
        },
        fileExtension: {
          type: "string",
          description: "Filter by file extension (e.g., 'js', 'py')"
        }
      },
      required: ["query"]
    }
  },
  
  {
    name: "list_directory",
    description: "List contents of a directory",
    input_schema: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "Directory path (default: root)" 
        },
        recursive: {
          type: "boolean",
          description: "List recursively"
        }
      }
    }
  },
  
  // === GIT OPERATIONS ===
  {
    name: "git_diff",
    description: "Get git diff for files",
    input_schema: {
      type: "object",
      properties: {
        path: { 
          type: "string", 
          description: "File path or directory (optional for all changes)" 
        },
        base: {
          type: "string",
          description: "Base ref for comparison (default: PR base)"
        }
      }
    }
  },
  
  {
    name: "git_commit",
    description: "Create a commit with changes",
    input_schema: {
      type: "object",
      properties: {
        message: { 
          type: "string", 
          description: "Commit message" 
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Specific files to commit (default: all staged)"
        }
      },
      required: ["message"]
    }
  },
  
  // === ANALYSIS ===
  {
    name: "analyze_code",
    description: "Run static code analysis",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to analyze"
        },
        tools: {
          type: "array",
          items: {
            type: "string",
            enum: ["eslint", "pylint", "security", "complexity"]
          },
          description: "Analysis tools to run"
        }
      }
    }
  },
  
  // === DOCUMENTATION ===
  {
    name: "generate_docs",
    description: "Generate documentation for code",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to document"
        },
        format: {
          type: "string",
          enum: ["markdown", "jsdoc", "sphinx"],
          description: "Documentation format"
        }
      },
      required: ["path"]
    }
  }
];

// Issue-specific tools (only available when triggered from an Issue)
const ISSUE_TOOLS = [
  {
    name: "issue_comment",
    description: "Add a comment to the issue",
    input_schema: {
      type: "object",
      properties: {
        body: { 
          type: "string", 
          description: "Comment body (markdown supported)" 
        }
      },
      required: ["body"]
    }
  },
  
  {
    name: "issue_add_labels",
    description: "Add labels to the issue",
    input_schema: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to add"
        }
      },
      required: ["labels"]
    }
  },
  
  {
    name: "issue_remove_labels",
    description: "Remove labels from the issue",
    input_schema: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to remove"
        }
      },
      required: ["labels"]
    }
  },
  
  {
    name: "issue_assign",
    description: "Assign users to the issue",
    input_schema: {
      type: "object",
      properties: {
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "GitHub usernames to assign"
        }
      },
      required: ["assignees"]
    }
  },
  
  {
    name: "issue_unassign",
    description: "Remove assignees from the issue",
    input_schema: {
      type: "object",
      properties: {
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "GitHub usernames to unassign"
        }
      },
      required: ["assignees"]
    }
  },
  
  {
    name: "issue_update_title",
    description: "Update the issue title",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "New issue title"
        }
      },
      required: ["title"]
    }
  },
  
  {
    name: "issue_update_body",
    description: "Update the issue description",
    input_schema: {
      type: "object",
      properties: {
        body: {
          type: "string",
          description: "New issue body (markdown supported)"
        }
      },
      required: ["body"]
    }
  },
  
  {
    name: "issue_close",
    description: "Close the issue",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["completed", "not_planned"],
          description: "Reason for closing"
        },
        comment: {
          type: "string",
          description: "Optional closing comment"
        }
      }
    }
  },
  
  {
    name: "issue_reopen",
    description: "Reopen a closed issue",
    input_schema: {
      type: "object",
      properties: {
        comment: {
          type: "string",
          description: "Optional reopening comment"
        }
      }
    }
  },
  
  {
    name: "issue_lock",
    description: "Lock the issue to prevent further comments",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["off-topic", "too heated", "resolved", "spam"],
          description: "Reason for locking"
        }
      }
    }
  },
  
  {
    name: "issue_unlock",
    description: "Unlock the issue to allow comments",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  
  {
    name: "issue_create_branch",
    description: "Create a new branch from this issue",
    input_schema: {
      type: "object",
      properties: {
        branchName: {
          type: "string",
          description: "Name for the new branch (defaults to issue-{number})"
        },
        baseBranch: {
          type: "string",
          description: "Base branch to create from (defaults to main)"
        }
      }
    }
  },
  
  {
    name: "issue_convert_to_pr",
    description: "Convert issue to a pull request (if branch exists)",
    input_schema: {
      type: "object",
      properties: {
        branch: {
          type: "string",
          description: "Branch to create PR from"
        },
        draft: {
          type: "boolean",
          description: "Create as draft PR",
          default: false
        }
      },
      required: ["branch"]
    }
  }
];

// PR-specific tools (only available when triggered from a Pull Request)
const PR_TOOLS = [
  {
    name: "pr_comment",
    description: "Add a comment to the PR",
    input_schema: {
      type: "object",
      properties: {
        body: { 
          type: "string", 
          description: "Comment body (markdown supported)" 
        },
        replyTo: {
          type: "number",
          description: "Comment ID to reply to (optional)"
        }
      },
      required: ["body"]
    }
  },
  
  {
    name: "pr_review",
    description: "Submit a PR review",
    input_schema: {
      type: "object",
      properties: {
        body: { 
          type: "string", 
          description: "Review body" 
        },
        event: {
          type: "string",
          description: "Review action",
          enum: ["COMMENT", "APPROVE", "REQUEST_CHANGES"]
        },
        comments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              line: { type: "number" },
              body: { type: "string" }
            }
          },
          description: "Inline review comments"
        }
      },
      required: ["body", "event"]
    }
  },
  
  {
    name: "pr_request_reviewers",
    description: "Request reviewers for the PR",
    input_schema: {
      type: "object",
      properties: {
        reviewers: {
          type: "array",
          items: { type: "string" },
          description: "GitHub usernames to request review from"
        },
        teams: {
          type: "array",
          items: { type: "string" },
          description: "Team slugs to request review from"
        }
      }
    }
  },
  
  {
    name: "pr_add_labels",
    description: "Add labels to the PR",
    input_schema: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to add"
        }
      },
      required: ["labels"]
    }
  },
  
  {
    name: "pr_remove_labels",
    description: "Remove labels from the PR",
    input_schema: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Label names to remove"
        }
      },
      required: ["labels"]
    }
  },
  
  {
    name: "pr_update_title",
    description: "Update the PR title",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "New PR title"
        }
      },
      required: ["title"]
    }
  },
  
  {
    name: "pr_update_description",
    description: "Update the PR description",
    input_schema: {
      type: "object",
      properties: {
        body: {
          type: "string",
          description: "New PR description (markdown supported)"
        }
      },
      required: ["body"]
    }
  },
  
  {
    name: "pr_merge",
    description: "Merge the PR (requires approval)",
    input_schema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          description: "Merge method",
          enum: ["merge", "squash", "rebase"]
        },
        message: {
          type: "string",
          description: "Merge commit message"
        }
      }
    }
  },
  
  {
    name: "pr_close",
    description: "Close the PR without merging",
    input_schema: {
      type: "object",
      properties: {
        comment: {
          type: "string",
          description: "Optional closing comment"
        }
      }
    }
  },
  
  // === COMMAND EXECUTION ===
  {
    name: "run_command",
    description: "Execute a shell command in the repository context",
    input_schema: {
      type: "object",
      properties: {
        command: { 
          type: "string", 
          description: "Command to execute" 
        },
        workingDir: {
          type: "string",
          description: "Working directory (default: repo root)"
        },
        safe: {
          type: "boolean",
          description: "Run in safe mode (limited commands)",
          default: true
        }
      },
      required: ["command"]
    }
  },
  
  {
    name: "git_command",
    description: "Execute git commands in the repository",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Git command (without 'git' prefix)",
          examples: ["status", "add .", "commit -m 'message'", "push origin branch"]
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Additional arguments for the git command"
        }
      },
      required: ["command"]
    }
  },
  
  // === TESTING ===
  {
    name: "run_tests",
    description: "Run test suite",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Test file pattern (e.g., '*.test.js')"
        },
        framework: {
          type: "string",
          description: "Test framework",
          enum: ["jest", "mocha", "pytest", "auto"]
        }
      }
    }
  },
  
  // === ENVIRONMENT ACCESS ===
  {
    name: "get_env_variable",
    description: "Get value of an environment variable (safe vars only)",
    input_schema: {
      type: "object",
      properties: {
        name: { 
          type: "string", 
          description: "Environment variable name" 
        }
      },
      required: ["name"]
    }
  },
  
  {
    name: "access_secret",
    description: "Request access to a secret (requires approval)",
    input_schema: {
      type: "object",
      properties: {
        name: { 
          type: "string", 
          description: "Secret name" 
        },
        reason: {
          type: "string",
          description: "Reason for accessing the secret"
        }
      },
      required: ["name", "reason"]
    }
  },
  
];

// Combine tools based on context
const CLAUDE_TOOLS = IS_PULL_REQUEST 
  ? [...BASE_TOOLS, ...PR_TOOLS]
  : IS_ISSUE 
    ? [...BASE_TOOLS, ...ISSUE_TOOLS]
    : BASE_TOOLS;
```

### 3.1 Context-Specific Tool Sets

#### **Issue Management Tools** (When triggered from an Issue)

##### Comment & Discussion
- `issue_comment` - Add comments with markdown support
- `issue_lock/unlock` - Control comment permissions

##### Labels & Assignment
- `issue_add_labels` - Add categorization labels
- `issue_remove_labels` - Remove labels
- `issue_assign` - Assign users to the issue
- `issue_unassign` - Remove assignees

##### Issue Modifications
- `issue_update_title` - Change issue title
- `issue_update_body` - Update issue description
- `issue_close` - Close with reason (completed/not_planned)
- `issue_reopen` - Reopen closed issues

##### Development Actions
- `issue_create_branch` - Create branch from issue
- `issue_convert_to_pr` - Convert to pull request

#### **PR Management Tools** (When triggered from a Pull Request)

##### Comment Operations
- `pr_comment` - Add comments to the PR with markdown support
- `pr_review` - Submit full PR reviews (COMMENT, APPROVE, REQUEST_CHANGES)
- Line-level review comments through the review system

##### Label/Tag Operations  
- `pr_add_labels` - Add labels to categorize the PR
- `pr_remove_labels` - Remove existing labels
- Dynamic label creation based on evaluation results

##### PR Modification Operations
- `pr_update_title` - Change the PR title
- `pr_update_description` - Update PR description with markdown
- `pr_request_reviewers` - Request specific users or teams for review
- `pr_merge` - Merge the PR (with approval requirements)
- `pr_close` - Close PR without merging

##### File Modification in PR
- `write_file` - Modify files directly in the PR branch
- `delete_file` - Remove files from the PR
- `git_commit` - Commit changes with messages
- `git_command` - Execute any git operation
- Automatic push to PR branch after modifications

#### **Base Tools** (Available in both contexts)
- Prompt evaluation and A/B testing
- File operations (read, search, list)
- Command execution (safe mode)
- Code analysis and documentation generation
- Environment variable access

### 4. Initial Context Message for Claude

```javascript
const CLAUDE_INITIAL_CONTEXT = `
# Claude Code Integration Session

You are Claude Code, integrated into a GitHub Actions workflow for the prompt-expert system. You have been invoked to help with a pull request.

## Your Capabilities

You have access to a comprehensive set of tools for:

### Core Evaluation Tools
- **Prompt Evaluation**: Execute prompts with experts and analyze results
- **A/B Testing**: Compare prompt implementations with expert judgment
- **Performance Analysis**: Analyze prompts for specific quality criteria

### PR Management Tools
- **Comments**: Add comments, submit reviews with inline feedback
- **Labels/Tags**: Add or remove labels to categorize and track PR status
- **PR Modifications**: Update title, description, request reviewers
- **PR Actions**: Merge (with approval) or close PRs
- **File Changes**: Modify, create, or delete files directly in the PR

### Development Tools
- **Git Operations**: Commit, push, view diffs, manage branches
- **Code Execution**: Run tests, linting, security scans
- **File Operations**: Read, write, search repository files
- **Environment Access**: Access safe env vars, request secrets with approval

## Current Context

### Pull Request Information
- PR #${PR_CONTEXT.pr.number}: ${PR_CONTEXT.pr.title}
- Author: ${PR_CONTEXT.pr.author}
- Branch: ${PR_CONTEXT.pr.branch.head} → ${PR_CONTEXT.pr.branch.base}
- Files Changed: ${PR_CONTEXT.files.total}
- Status: ${PR_CONTEXT.pr.status.state}

### Changed Files
${PR_CONTEXT.files.changed.map(f => `- ${f.filename} (${f.status}): +${f.additions}/-${f.deletions}`).join('\n')}

### Repository
- Repository: ${PR_CONTEXT.repository.fullName}
- Default Branch: ${PR_CONTEXT.repository.defaultBranch}
- Visibility: ${PR_CONTEXT.repository.visibility}

### Workflow Execution
- Triggered by: ${PR_CONTEXT.workflow.triggeredBy}
- Actor: ${PR_CONTEXT.workflow.actor}
- Run: #${PR_CONTEXT.workflow.runNumber}

### Available Tools
${CLAUDE_TOOLS.map(t => `- **${t.name}**: ${t.description}`).join('\n')}

## Important Guidelines

1. **Always use tools to perform actions** - Don't just describe what should be done
2. **Request approval for destructive operations** - Merging, closing, or major changes
3. **Maintain code quality** - Run tests and linting after modifications
4. **Be explicit about actions** - Clearly state what you're doing and why
5. **Handle errors gracefully** - Provide fallback options if operations fail
6. **Respect security boundaries** - Don't expose secrets or sensitive data

## User Request

${userPrompt}

## Your Task

Analyze the context and user request, then use the available tools to accomplish the requested task. Be proactive but careful, and always explain your actions.
`;
```

### 5. Tool Execution Handler

```javascript
class ClaudeToolExecutor {
  constructor(octokit, context, anthropic, logger) {
    this.octokit = octokit;
    this.context = context;
    this.anthropic = anthropic;
    this.logger = logger || console;
    this.executionLog = [];
    this.gitConfigured = false;
    this.retryAttempts = {};
    this.maxRetries = 3;
    this.safeCommands = [
      'ls', 'cat', 'grep', 'find', 'npm test', 'npm run lint',
      'jest', 'mocha', 'pytest', 'eslint', 'prettier', 'npm audit',
      'yarn test', 'yarn lint', 'pnpm test', 'pnpm lint'
    ];
    
    // Initialize structured logging
    this.initializeLogging();
  }
  
  initializeLogging() {
    this.logLevels = {
      ERROR: 'error',
      WARN: 'warn',
      INFO: 'info',
      DEBUG: 'debug'
    };
    
    // Create log entry with context
    this.log = (level, message, data = {}) => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        context: {
          pr: this.context.pr?.number,
          issue: this.context.issue?.number,
          repository: this.context.repository?.fullName,
          actor: this.context.workflow?.actor
        },
        ...data
      };
      
      // Log to console and store
      this.logger[level](JSON.stringify(entry));
      this.executionLog.push(entry);
      
      // Send critical errors to PR comment
      if (level === 'error' && data.critical) {
        this.reportCriticalError(message, data);
      }
    };
  }
  
  async reportCriticalError(message, data) {
    try {
      const errorReport = `
⚠️ **Critical Error in Claude Code Execution**

**Error**: ${message}
**Details**: \`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
**Time**: ${new Date().toISOString()}

Please review the workflow logs for more information.`;
      
      if (this.context.pr) {
        await this.octokit.issues.createComment({
          owner: this.context.repository.owner,
          repo: this.context.repository.name,
          issue_number: this.context.pr.number,
          body: errorReport
        });
      }
    } catch (e) {
      this.logger.error('Failed to report critical error:', e);
    }
  }
  
  async ensureGitConfig() {
    if (!this.gitConfigured) {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        this.log('info', 'Configuring git environment');
        
        // Check if we're in a git repository
        try {
          await execAsync('git rev-parse --git-dir');
        } catch (e) {
          throw new Error('Not in a git repository. Workflow may not have checked out the code.');
        }
        
        // Configure git user for commits
        await execAsync('git config user.name "Claude Code"');
        await execAsync('git config user.email "claude@anthropic.com"');
        
        // Check current branch
        const { stdout: currentBranch } = await execAsync('git branch --show-current');
        const prBranch = this.context.pr?.branch?.head;
        
        if (!prBranch) {
          this.log('warn', 'No PR branch specified, using current branch', { 
            currentBranch: currentBranch.trim() 
          });
        } else if (currentBranch.trim() !== prBranch) {
          // Ensure we're on the PR branch
          this.log('info', `Switching to PR branch: ${prBranch}`);
          
          // Fetch the branch first
          await execAsync(`git fetch origin ${prBranch}:${prBranch}`, { timeout: 30000 })
            .catch(() => this.log('warn', 'Branch fetch failed, may already exist locally'));
          
          // Checkout the branch
          await execAsync(`git checkout ${prBranch}`);
        }
        
        this.gitConfigured = true;
        this.log('info', 'Git configuration complete');
        
      } catch (error) {
        this.log('error', 'Failed to configure git environment', { 
          error: error.message,
          critical: true 
        });
        throw error;
      }
    }
  }
  
  async withRetry(operation, operationName) {
    const key = operationName || operation.name || 'unknown';
    this.retryAttempts[key] = this.retryAttempts[key] || 0;
    
    while (this.retryAttempts[key] < this.maxRetries) {
      try {
        this.log('debug', `Executing operation: ${key}`, { 
          attempt: this.retryAttempts[key] + 1 
        });
        
        const result = await operation();
        
        // Reset retry count on success
        this.retryAttempts[key] = 0;
        return result;
        
      } catch (error) {
        this.retryAttempts[key]++;
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || this.retryAttempts[key] >= this.maxRetries) {
          this.log('error', `Operation failed: ${key}`, {
            error: error.message,
            attempts: this.retryAttempts[key],
            retryable: isRetryable
          });
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, this.retryAttempts[key] - 1), 10000);
        this.log('warn', `Retrying operation: ${key}`, { 
          attempt: this.retryAttempts[key],
          delay: delay,
          error: error.message 
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
    
    // GitHub API rate limiting
    if (error.status === 429 || error.status === 403) return true;
    
    // Server errors
    if (error.status >= 500 && error.status < 600) return true;
    
    // Git lock errors
    if (error.message?.includes('index.lock')) return true;
    
    return false;
  }
  
  async executeTool(toolCall) {
    const { name, arguments: args } = toolCall;
    const startTime = Date.now();
    
    // Validate tool exists
    if (!this.isValidTool(name)) {
      this.log('error', `Unknown tool requested: ${name}`, { toolCall });
      return {
        success: false,
        error: `Unknown tool: ${name}`,
        availableTools: this.getAvailableTools()
      };
    }
    
    // Check permissions
    if (!this.hasPermission(name)) {
      this.log('warn', `Permission denied for tool: ${name}`, { 
        toolCall,
        requiredPermission: this.getRequiredPermission(name) 
      });
      return {
        success: false,
        error: `Permission denied for tool: ${name}`,
        requiredPermission: this.getRequiredPermission(name)
      };
    }
    
    this.log('info', `Executing tool: ${name}`, { args });
    
    try {
      let result;
      
      // Wrap operations that might need retry
      const retryableTools = ['pr_merge', 'git_commit', 'git_push', 'run_command'];
      
      if (retryableTools.includes(name)) {
        result = await this.withRetry(
          () => this.executeToolInternal(name, args),
          name
        );
      } else {
        result = await this.executeToolInternal(name, args);
      }
      
      const duration = Date.now() - startTime;
      this.log('info', `Tool execution completed: ${name}`, { 
        duration,
        success: result.success 
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('error', `Tool execution failed: ${name}`, {
        error: error.message,
        stack: error.stack,
        duration,
        args
      });
      
      return {
        success: false,
        error: error.message,
        tool: name,
        duration
      };
    }
  }
  
  async executeToolInternal(name, args) {
    switch(name) {
        // Prompt Evaluation Tools
        case 'evaluate_prompt':
          return await this.evaluatePrompt(args);
          
        case 'run_prompt_ab_test':
          return await this.runPromptABTest(args);
          
        case 'analyze_prompt_performance':
          return await this.analyzePromptPerformance(args);
        // File Operations
        case 'read_file':
          return await this.readFile(args.path, args.ref);
          
        case 'write_file':
          return await this.writeFile(args.path, args.content, args.mode);
          
        case 'delete_file':
          return await this.deleteFile(args.path);
          
        // Search Operations
        case 'search_repository':
          return await this.searchRepository(args.query, args.type, args.fileExtension);
          
        case 'list_directory':
          return await this.listDirectory(args.path, args.recursive);
          
        // Git Operations
        case 'git_diff':
          return await this.gitDiff(args.path, args.base);
          
        case 'git_commit':
          return await this.gitCommit(args.message, args.files);
          
        // PR Operations
        case 'pr_comment':
          return await this.prComment(args.body, args.replyTo);
          
        case 'pr_review':
          return await this.prReview(args.body, args.event, args.comments);
          
        case 'pr_request_reviewers':
          return await this.prRequestReviewers(args.reviewers, args.teams);
          
        case 'pr_add_labels':
          return await this.prAddLabels(args.labels);
          
        case 'pr_remove_labels':
          return await this.prRemoveLabels(args.labels);
          
        case 'pr_update_title':
          return await this.prUpdateTitle(args.title);
          
        case 'pr_update_description':
          return await this.prUpdateDescription(args.body);
          
        case 'pr_merge':
          return await this.prMerge(args.method, args.message);
          
        case 'pr_close':
          return await this.prClose(args.comment);
          
        // Command Execution
        case 'run_command':
          return await this.runCommand(args.command, args.workingDir, args.safe);
          
        case 'git_command':
          return await this.gitCommand(args.command, args.args);
          
        // Testing
        case 'run_tests':
          return await this.runTests(args.pattern, args.framework);
          
        // Environment
        case 'get_env_variable':
          return await this.getEnvVariable(args.name);
          
        case 'access_secret':
          return await this.accessSecret(args.name, args.reason);
          
        // Analysis
        case 'analyze_code':
          return await this.analyzeCode(args.path, args.tools);
          
        // Documentation
        case 'generate_docs':
          return await this.generateDocs(args.path, args.format);
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tool: name
      };
    }
  }
  
  // Implementation methods for each tool...
  
  async evaluatePrompt(args) {
    const { prompt, expert = 'programming', testScenarios = [], compareWith = 'none', customBaseline } = args;
    
    // Load expert prompt
    const expertLoader = new ExpertLoader({ baseDir: process.cwd() });
    await expertLoader.initialize();
    const expertData = await expertLoader.loadExpert(expert);
    
    // Generate default test scenarios if none provided
    const scenarios = testScenarios.length > 0 ? testScenarios : [
      { input: "Write a function that reverses a string", expectedBehavior: "Provide working code" },
      { input: "Explain how to handle errors", expectedBehavior: "Clear error handling guidance" },
      { input: "What are best practices?", expectedBehavior: "Domain-specific best practices" }
    ];
    
    const results = {
      prompt: prompt,
      expert: expert,
      scenarios: [],
      comparison: null
    };
    
    // Execute prompt with each test scenario
    for (const scenario of scenarios) {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nTest scenario: ${scenario.input}`
          }
        ]
      });
      
      // Expert evaluation of the response
      const evaluation = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `${expertData.content}
            
Evaluate this response for the ${expert} domain:

Test Input: ${scenario.input}
Expected Behavior: ${scenario.expectedBehavior}

Response:
${response.content[0].text}

Provide:
1. Score (1-10)
2. Strengths
3. Weaknesses
4. Suggestions for improvement`
          }
        ]
      });
      
      results.scenarios.push({
        input: scenario.input,
        response: response.content[0].text,
        evaluation: evaluation.content[0].text
      });
    }
    
    // Compare with baseline if requested
    if (compareWith === 'baseline') {
      // Get baseline from current main branch
      const baselineFile = await this.readFile(`prompts/${expert}.md`, 'base');
      const baseline = baselineFile.content;
      
      results.comparison = await this.comparePrompts(baseline, prompt, expert, scenarios);
    } else if (compareWith === 'custom' && customBaseline) {
      results.comparison = await this.comparePrompts(customBaseline, prompt, expert, scenarios);
    }
    
    return {
      success: true,
      results: results,
      summary: `Evaluated prompt with ${expert} expert across ${scenarios.length} scenarios`
    };
  }
  
  async runPromptABTest(args) {
    const { promptA, promptB, expert = 'programming', testCount = 3, criteria = [] } = args;
    
    // Generate test scenarios
    const testScenarios = [];
    for (let i = 0; i < testCount; i++) {
      testScenarios.push({
        input: `Test scenario ${i + 1}: Implement a solution`,
        expectedBehavior: "Correct, efficient implementation"
      });
    }
    
    // Run both prompts through evaluation
    const resultsA = await this.evaluatePrompt({
      prompt: promptA,
      expert: expert,
      testScenarios: testScenarios
    });
    
    const resultsB = await this.evaluatePrompt({
      prompt: promptB,
      expert: expert,
      testScenarios: testScenarios
    });
    
    // Expert comparison
    const comparison = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `As a ${expert} expert, compare these two prompt implementations:
          
Prompt A Results:
${JSON.stringify(resultsA.results.scenarios, null, 2)}

Prompt B Results:
${JSON.stringify(resultsB.results.scenarios, null, 2)}

Evaluation Criteria: ${criteria.length > 0 ? criteria.join(', ') : 'Standard ' + expert + ' best practices'}

Provide:
1. Winner (A, B, or TIE)
2. Detailed comparison
3. Recommendation (MERGE if B is better, REJECT if A is better, SUGGEST if improvements needed)`
        }
      ]
    });
    
    return {
      success: true,
      promptA: resultsA,
      promptB: resultsB,
      comparison: comparison.content[0].text,
      recommendation: this.parseRecommendation(comparison.content[0].text)
    };
  }
  
  async analyzePromptPerformance(args) {
    const { prompt, analysisType = 'comprehensive', context = {} } = args;
    
    const analysisPrompts = {
      security: "Analyze for security vulnerabilities, injection risks, and data exposure",
      performance: "Analyze for efficiency, token usage, and response time",
      accuracy: "Analyze for correctness, precision, and reliability",
      clarity: "Analyze for readability, structure, and user understanding",
      comprehensive: "Provide complete analysis across all dimensions"
    };
    
    const analysis = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Analyze this prompt for ${analysisType}:

Prompt:
${prompt}

Context:
- Domain: ${context.domain || 'general'}
- Use Case: ${context.useCase || 'general purpose'}
- Target Audience: ${context.targetAudience || 'developers'}

${analysisPrompts[analysisType]}

Provide detailed analysis with:
1. Strengths
2. Weaknesses
3. Specific recommendations
4. Score (1-10)
5. Priority improvements`
        }
      ]
    });
    
    return {
      success: true,
      analysisType: analysisType,
      analysis: analysis.content[0].text,
      prompt: prompt,
      context: context
    };
  }
  
  async comparePrompts(baseline, candidate, expert, scenarios) {
    // Helper method for prompt comparison
    const comparison = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `As a ${expert} expert, compare these prompts:
          
BASELINE:
${baseline}

CANDIDATE:
${candidate}

Test these with scenarios:
${scenarios.map(s => `- ${s.input}`).join('\n')}

Provide:
1. Which is better and why
2. Key differences
3. Recommendation for the PR`
        }
      ]
    });
    
    return comparison.content[0].text;
  }
  
  // Validation and permission helper methods
  isValidTool(name) {
    const allTools = [...BASE_TOOLS, ...PR_TOOLS, ...ISSUE_TOOLS];
    return allTools.some(tool => tool.name === name);
  }
  
  hasPermission(toolName) {
    // Check if workflow has required permissions
    const permissions = process.env.GITHUB_TOKEN_PERMISSIONS;
    
    if (!permissions) {
      this.log('warn', 'No permissions information available, assuming full access');
      return true;
    }
    
    // Map tools to required permissions
    const permissionMap = {
      'pr_merge': 'pull-requests:write',
      'pr_close': 'pull-requests:write',
      'write_file': 'contents:write',
      'delete_file': 'contents:write',
      'git_commit': 'contents:write',
      'pr_add_labels': 'issues:write',
      'issue_close': 'issues:write'
    };
    
    const required = permissionMap[toolName];
    if (!required) return true;
    
    return permissions.includes(required);
  }
  
  getRequiredPermission(toolName) {
    const permissionMap = {
      'pr_merge': 'pull-requests:write',
      'pr_close': 'pull-requests:write',
      'write_file': 'contents:write',
      'delete_file': 'contents:write',
      'git_commit': 'contents:write',
      'pr_add_labels': 'issues:write',
      'issue_close': 'issues:write'
    };
    return permissionMap[toolName] || 'none';
  }
  
  getAvailableTools() {
    if (this.context.pr) {
      return [...BASE_TOOLS, ...PR_TOOLS].map(t => t.name);
    } else if (this.context.issue) {
      return [...BASE_TOOLS, ...ISSUE_TOOLS].map(t => t.name);
    }
    return BASE_TOOLS.map(t => t.name);
  }
  
  async readFile(path, ref = 'head', encoding = 'utf8') {
    // Validate path
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid file path provided');
    }
    
    // Sanitize path to prevent directory traversal
    if (path.includes('..') || path.startsWith('/')) {
      throw new Error('Invalid path: directory traversal not allowed');
    }
    
    const refMap = {
      'head': this.context.pr?.branch?.head || 'HEAD',
      'base': this.context.pr?.branch?.base || this.context.repository?.defaultBranch,
      'main': this.context.repository?.defaultBranch || 'main'
    };
    
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.context.repository.owner,
        repo: this.context.repository.name,
        path: path,
        ref: refMap[ref] || ref
      });
      
      // Handle directories
      if (Array.isArray(data)) {
        return {
          success: true,
          type: 'directory',
          path: path,
          contents: data.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size
          }))
        };
      }
      
      // Check file size limits (GitHub API limit: 100MB)
      if (data.size > 100 * 1024 * 1024) {
        this.log('warn', `File too large for API: ${path}`, { size: data.size });
        return {
          success: false,
          error: 'File too large (>100MB). Use Git LFS or clone the repository.',
          path: path,
          size: data.size
        };
      }
      
      // Detect binary files
      const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.zip', '.tar', '.gz', '.rar', '.7z',
        '.exe', '.dll', '.so', '.dylib',
        '.mp3', '.mp4', '.avi', '.mov',
        '.db', '.sqlite', '.parquet'
      ];
      const isBinary = binaryExtensions.some(ext => path.toLowerCase().endsWith(ext));
      
      if (isBinary || encoding === 'base64') {
        this.log('debug', `Reading binary file: ${path}`);
        return {
          success: true,
          content: data.content, // Return base64 encoded
          encoding: 'base64',
          path: path,
          sha: data.sha,
          size: data.size
        };
      }
      
      // Text files - decode from base64
      try {
        const decodedContent = Buffer.from(data.content, 'base64').toString(encoding);
        return {
          success: true,
          content: decodedContent,
          encoding: encoding,
          path: path,
          sha: data.sha,
          size: data.size
        };
      } catch (decodeError) {
        this.log('warn', `Failed to decode file as ${encoding}, returning base64`, { 
          path,
          error: decodeError.message 
        });
        return {
          success: true,
          content: data.content,
          encoding: 'base64',
          path: path,
          sha: data.sha,
          size: data.size
        };
      }
      
    } catch (error) {
      if (error.status === 404) {
        this.log('info', `File not found: ${path}`);
        return {
          success: false,
          error: 'File not found',
          path: path
        };
      }
      throw error;
    }
  }
  
  async writeFile(path, content, mode = 'update', encoding = 'utf8') {
    let sha;
    
    // Get current file SHA if updating
    if (mode === 'update') {
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.context.repository.owner,
          repo: this.context.repository.name,
          path: path,
          ref: this.context.pr.branch.head
        });
        sha = data.sha;
      } catch (e) {
        if (mode === 'update' && e.status === 404) {
          mode = 'create'; // File doesn't exist, create it
        }
      }
    }
    
    const message = `Claude Code: ${mode} ${path}`;
    
    // Handle binary content
    let encodedContent;
    if (encoding === 'base64') {
      // Content is already base64 encoded (e.g., images, PDFs)
      encodedContent = content;
    } else {
      // Text content - encode to base64
      encodedContent = Buffer.from(content, encoding).toString('base64');
    }
    
    await this.octokit.repos.createOrUpdateFileContents({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      path: path,
      message: message,
      content: encodedContent,
      branch: this.context.pr.branch.head,
      sha: sha
    });
    
    return {
      success: true,
      path: path,
      mode: mode,
      message: message,
      encoding: encoding
    };
  }
  
  async prComment(body, replyTo = null) {
    const comment = await this.octokit.issues.createComment({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.pr.number,
      body: `🤖 **Claude Code Response**\n\n${body}`
    });
    
    return {
      success: true,
      commentId: comment.data.id,
      url: comment.data.html_url
    };
  }
  
  async prAddLabels(labels) {
    await this.octokit.issues.addLabels({
      owner: this.context.repository.owner,
      repo: this.context.repository.name,
      issue_number: this.context.pr.number,
      labels: labels
    });
    
    return {
      success: true,
      labels: labels,
      action: 'added'
    };
  }
  
  async runCommand(command, workingDir = '.', safe = true) {
    // Security check for safe mode
    if (safe && !this.safeCommands.some(cmd => command.startsWith(cmd))) {
      return {
        success: false,
        error: `Command '${command}' not allowed in safe mode`,
        allowedCommands: this.safeCommands
      };
    }
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 30000 // 30 second timeout
      });
      
      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
        command: command
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        command: command
      };
    }
  }
  
  async gitCommand(command, args = []) {
    await this.ensureGitConfig();
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const fullCommand = `git ${command} ${args.join(' ')}`.trim();
    
    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout: 60000 // 60 second timeout for git operations
      });
      
      // Special handling for certain git commands
      if (command.startsWith('commit')) {
        // Ensure changes are staged
        await execAsync('git add -A');
      }
      
      if (command.startsWith('push')) {
        // Set upstream if needed
        const branch = this.context.pr.branch.head;
        await execAsync(`git push --set-upstream origin ${branch}`, { timeout: 60000 });
      }
      
      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
        command: fullCommand
      };
    } catch (error) {
      // Handle common git errors
      if (error.message.includes('nothing to commit')) {
        return {
          success: true,
          message: 'No changes to commit',
          command: fullCommand
        };
      }
      
      if (error.message.includes('up to date')) {
        return {
          success: true,
          message: 'Already up to date',
          command: fullCommand
        };
      }
      
      return {
        success: false,
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        command: fullCommand
      };
    }
  }
  
  // ... implement remaining tool methods
}
```

### 6. Workflow Integration

```yaml
# .github/workflows/claude-code-handler.yml
name: Claude Code PR Handler

on:
  issue_comment:
    types: [created]

jobs:
  claude-code:
    if: |
      github.event.issue.pull_request && 
      contains(github.event.comment.body, '@prompt-expert')
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout PR Branch
        uses: actions/checkout@v3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          ref: ${{ github.event.pull_request.head.ref }}
          fetch-depth: 0  # Full history for git operations
          
      - name: Setup Git Identity
        run: |
          git config --global user.name "Claude Code"
          git config --global user.email "claude@anthropic.com"
          
      - name: Parse Command
        id: parse
        run: |
          COMMENT="${{ github.event.comment.body }}"
          # Extract expert, options, and prompt
          echo "Parsing: $COMMENT"
          
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Dependencies
        run: |
          npm install @anthropic-ai/sdk @octokit/rest
          
      - name: Setup Claude Session
        run: |
          # Initialize Claude with tools and context
          node .github/scripts/claude-code-session.js
          
      - name: Execute Claude Response
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          node .github/scripts/execute-claude.js \
            --pr=${{ github.event.issue.number }} \
            --expert="${{ steps.parse.outputs.expert }}" \
            --prompt="${{ steps.parse.outputs.prompt }}" \
            --options="${{ steps.parse.outputs.options }}"
            
      - name: Push Changes if Any
        run: |
          if [[ -n $(git status --porcelain) ]]; then
            git push origin ${{ github.event.pull_request.head.ref }}
          fi
```

### 7. Security & Permissions

```javascript
const PERMISSION_LEVELS = {
  read: ['read_file', 'list_directory', 'search_repository', 'git_diff'],
  
  write: ['write_file', 'delete_file', 'git_commit', 'pr_comment'],
  
  admin: ['pr_merge', 'pr_close', 'access_secret'],
  
  execute: ['run_command', 'run_tests']
};

const REQUIRES_APPROVAL = [
  'pr_merge',
  'pr_close', 
  'delete_file',
  'access_secret',
  'run_command' // when not in safe mode
];
```

## Binary Data Handling

### Supported Binary File Types
The system automatically detects and handles binary files based on extension:
- **Images**: .png, .jpg, .jpeg, .gif, .bmp, .svg
- **Documents**: .pdf, .doc, .docx, .xls, .xlsx
- **Archives**: .zip, .tar, .gz, .rar, .7z
- **Executables**: .exe, .dll, .so, .dylib
- **Media**: .mp3, .mp4, .avi, .mov
- **Data**: .db, .sqlite, .parquet

### Binary Data Operations

#### Reading Binary Files
```javascript
// Example: Reading an image file
const imageFile = await readFile('assets/logo.png', 'head', 'base64');
// Returns: { content: "iVBORw0KGgo...", encoding: "base64", size: 12345 }
```

#### Writing Binary Files
```javascript
// Example: Writing a PDF file
await writeFile('reports/analysis.pdf', pdfBase64Content, 'create', 'base64');
// Content must be base64 encoded when encoding='base64'
```

#### Processing Binary Data
- Binary files are kept in base64 format throughout the workflow
- No decoding/re-encoding to prevent data corruption
- Size limits apply (GitHub API: 100MB max file size)
- Large files should use Git LFS references

### 8. Example Usage Sessions

#### Example 1: Prompt Evaluation
```markdown
# User comments on PR:
@prompt-expert programming --evaluate "Test if this new error handling prompt properly guides developers"

# Claude receives context and responds:
🤖 Claude Code Session Started

I'll evaluate your error handling prompt using the programming expert.

## Actions Taken:

### 1. Evaluating the prompt
[Tool: evaluate_prompt] Running evaluation with programming expert...
Testing with 3 scenarios:
- Error handling implementation
- Exception recovery patterns  
- Logging best practices

### 2. Analysis Results
✅ **Score: 8.5/10**

**Strengths:**
- Clear guidance on try/catch patterns
- Good examples of error recovery
- Proper logging integration

**Areas for Improvement:**
- Could include async error handling
- Missing guidance on error boundaries in React
- No mention of error monitoring services

### 3. A/B Comparison with baseline
[Tool: run_prompt_ab_test] Comparing with current baseline prompt...

**Winner: New Prompt (B)**
- Better structured error handling guidance
- More comprehensive examples
- Clearer explanation of recovery patterns

**Recommendation: MERGE** - The new prompt is demonstrably superior

Would you like me to add the suggested improvements before merging?
```

#### Example 2: Fix and Test with Git Operations
```markdown
# User comments on PR:
@prompt-expert security --fix --test "Fix the SQL injection vulnerability in the user login handler"

# Claude receives context and responds:
🤖 Claude Code Session Started

I've identified the SQL injection vulnerability in `handlers/auth.js`. Let me fix it and add tests.

## Actions Taken:

### 1. Setting up git environment
[Tool: run_command] Configuring git...
```bash
git config user.name "Claude Code"
git config user.email "claude@anthropic.com"
git checkout -b fix-sql-injection
```

### 2. Reading the vulnerable file
[Tool: read_file] Reading handlers/auth.js...
Found direct string concatenation in SQL query at line 45.

### 3. Fixing the vulnerability
[Tool: write_file] Updating handlers/auth.js...
- Replaced string concatenation with parameterized queries
- Added input validation
- Implemented prepared statements

### 4. Adding security tests
[Tool: write_file] Creating handlers/auth.test.js...
Added tests for:
- SQL injection attempts
- XSS prevention
- Input validation

### 5. Running tests
[Tool: run_command] Running test suite...
```bash
npm test handlers/auth.test.js
```
✅ All tests passing (15/15)

### 6. Security analysis
[Tool: run_command] Running security scan...
```bash
npm audit
eslint handlers/auth.js --plugin security
```
✅ No vulnerabilities detected

### 7. Committing changes
[Tool: run_command] Staging and committing...
```bash
git add handlers/auth.js handlers/auth.test.js package.json
git commit -m "Fix SQL injection vulnerability in auth handler

- Replace string concatenation with parameterized queries
- Add comprehensive input validation
- Implement prepared statements for all DB operations
- Add security test coverage"
```

### 8. Pushing changes
[Tool: run_command] Pushing to PR branch...
```bash
git push origin fix-sql-injection
```

## Summary
Successfully fixed the SQL injection vulnerability by implementing parameterized queries and adding comprehensive security tests. The code now properly sanitizes all user inputs and uses prepared statements for database queries.

### Files Modified:
- handlers/auth.js: Fixed SQL injection
- handlers/auth.test.js: Added security tests
- package.json: Added sql-template-strings dependency

### Git Operations:
- Created feature branch: fix-sql-injection
- Committed changes with detailed message
- Pushed to PR branch for review

Would you like me to request a security review from the team?
```

## Edge Cases and Error Handling

### Critical Edge Cases

1. **Detached HEAD State**
   - Detection: Check `git symbolic-ref HEAD` fails
   - Recovery: Create temporary branch from current commit
   - Prevention: Always checkout PR branch explicitly

2. **Concurrent Modifications**
   - Detection: SHA mismatch on file update
   - Recovery: Fetch latest, merge, retry operation
   - Prevention: Use optimistic locking with SHA verification

3. **Fork PR Limitations**
   - Detection: Check if PR is from fork
   - Handling: Warn about read-only permissions
   - Workaround: Request maintainer to enable write permissions

4. **Rate Limiting**
   - Primary limit: 1000 requests/hour
   - Secondary limit: 15000 for Enterprise
   - Handling: Exponential backoff, request batching
   - Monitoring: Track remaining quota in headers

5. **Large File Handling**
   - API limit: 100MB per file
   - Detection: Check file size before operations
   - Alternative: Suggest Git LFS for large files
   - Chunking: Not supported by GitHub API

6. **Branch Protection Rules**
   - Detection: 403 error on push/merge
   - Handling: Report specific protection violated
   - Workaround: Request admin override or approval

7. **Workflow Timeout**
   - Job limit: 6 hours
   - Step limit: No specific limit
   - Token expiry: 24 hours max
   - Handling: Checkpoint progress, allow resume

8. **Invalid Command Injection**
   - Risk: User-provided strings in shell commands
   - Prevention: Strict input validation, parameterization
   - Sanitization: Escape shell metacharacters

### Comprehensive Logging Strategy

```javascript
class StructuredLogger {
  constructor(context) {
    this.context = context;
    this.correlationId = this.generateCorrelationId();
    this.logBuffer = [];
    this.metricsCollector = new MetricsCollector();
  }
  
  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      level: level,
      message: message,
      context: {
        pr: this.context.pr?.number,
        issue: this.context.issue?.number,
        repository: this.context.repository?.fullName,
        workflow: {
          runId: process.env.GITHUB_RUN_ID,
          runNumber: process.env.GITHUB_RUN_NUMBER,
          actor: process.env.GITHUB_ACTOR
        }
      },
      data: data,
      metrics: this.metricsCollector.current()
    };
    
    // Console output for GitHub Actions
    console.log(`::${this.getGitHubLogLevel(level)}::${JSON.stringify(entry)}`);
    
    // Buffer for summary report
    this.logBuffer.push(entry);
    
    // Alert on critical errors
    if (level === 'error' && data.critical) {
      this.createAnnotation(message, data);
    }
    
    return entry;
  }
  
  getGitHubLogLevel(level) {
    const mapping = {
      'error': 'error',
      'warn': 'warning',
      'info': 'notice',
      'debug': 'debug'
    };
    return mapping[level] || 'notice';
  }
  
  createAnnotation(message, data) {
    // GitHub Actions annotation format
    const file = data.file || 'unknown';
    const line = data.line || 1;
    console.log(`::error file=${file},line=${line}::${message}`);
  }
  
  generateSummaryReport() {
    const summary = {
      correlationId: this.correlationId,
      duration: this.metricsCollector.totalDuration(),
      toolsExecuted: this.metricsCollector.toolCount(),
      errors: this.logBuffer.filter(e => e.level === 'error'),
      warnings: this.logBuffer.filter(e => e.level === 'warn'),
      metrics: this.metricsCollector.summary()
    };
    
    // Write to GitHub Actions summary
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      fs.appendFileSync(summaryPath, this.formatSummaryMarkdown(summary));
    }
    
    return summary;
  }
}
```

### Error Recovery Patterns

```javascript
class ErrorRecovery {
  static async recoverFromGitError(error, context) {
    if (error.message.includes('index.lock')) {
      // Remove lock file and retry
      await exec('rm -f .git/index.lock');
      return { retry: true };
    }
    
    if (error.message.includes('detached HEAD')) {
      // Create temporary branch
      const tempBranch = `temp-${Date.now()}`;
      await exec(`git checkout -b ${tempBranch}`);
      return { retry: true, cleanup: () => exec(`git branch -d ${tempBranch}`) };
    }
    
    if (error.message.includes('merge conflict')) {
      // Report conflict details
      const conflicts = await exec('git diff --name-only --diff-filter=U');
      return { 
        retry: false, 
        report: `Merge conflicts in: ${conflicts}`,
        suggestion: 'Manual intervention required'
      };
    }
    
    return { retry: false };
  }
  
  static async recoverFromAPIError(error, context) {
    if (error.status === 403 && error.message.includes('rate limit')) {
      const resetTime = error.headers?.['x-ratelimit-reset'];
      const waitTime = resetTime ? (resetTime * 1000 - Date.now()) : 60000;
      
      if (waitTime > 0 && waitTime < 300000) { // Max 5 minutes
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return { retry: true };
      }
    }
    
    if (error.status === 422 && error.message.includes('sha')) {
      // File was modified, fetch latest
      const latest = await context.octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: error.path
      });
      return { 
        retry: true, 
        newSha: latest.data.sha 
      };
    }
    
    return { retry: false };
  }
}
```

## GitHub Actions Workflow Constraints

### Key Limitations to Consider

1. **GITHUB_TOKEN Permissions**:
   - Token expires after job completes or 24 hours max
   - Rate limit: 1,000 requests/hour (15,000 for Enterprise)
   - Fork PRs have read-only by default unless admin enables write

2. **Execution Limits**:
   - Job timeout: 6 hours maximum
   - Workflow run queue: 500 runs per 10 seconds
   - Matrix jobs: 256 max per workflow
   - Command length: 21,000 characters per shell command

3. **File Operations**:
   - Diff limit: 300 files for path filters
   - File watchers: 8192 (can be increased)
   - Artifacts retention: 1-90 days (public), 1-400 days (private)

4. **Git Operations in Workflows**:
   - Must checkout with proper token permissions
   - Need fetch-depth: 0 for full history
   - Push requires proper authentication setup
   - Commits must be signed if branch protection enabled

### Workflow Design Considerations

1. **Authentication**: Use `actions/checkout@v3` with `token: ${{ secrets.GITHUB_TOKEN }}`
2. **Git Config**: Must set user.name and user.email for commits
3. **Branch Operations**: Ensure PR branch is checked out, not detached HEAD
4. **Push Access**: Verify workflow has `contents: write` permission
5. **Concurrency**: Use concurrency groups to prevent race conditions

## Implementation Timeline

1. **Phase 1**: Command parsing and basic tool setup (Week 1)
   - Implement @prompt-expert command parser
   - Setup basic tool definitions
   - Create workflow trigger handler

2. **Phase 2**: Core tool implementations (Week 2)
   - Prompt evaluation tools
   - File operations with git integration
   - PR management tools

3. **Phase 3**: Security and permissions layer (Week 3)
   - Permission level enforcement
   - Approval workflows for sensitive operations
   - Audit logging system

4. **Phase 4**: Testing and refinement (Week 4)
   - End-to-end testing with real PRs
   - Performance optimization
   - Documentation and examples

## Success Metrics

- Response time < 30 seconds for simple operations
- Tool execution success rate > 95%
- Zero security incidents
- Successful git operations without detached HEAD issues
- User satisfaction score > 4.5/5

## Risk Mitigation

1. **Security**: 
   - Sandboxed execution with safe command allowlist
   - Permission levels with explicit approval requirements
   - Secrets never exposed in logs or responses

2. **Rate Limiting**: 
   - Implement request batching for GitHub API
   - Cache frequently accessed data
   - Monitor API quota usage

3. **Git Safety**:
   - Always work on feature branches
   - Automatic backups before modifications
   - Rollback capability via git history

4. **Workflow Reliability**:
   - Proper error handling for all git operations
   - Retry logic for transient failures
   - Clear error messages for debugging

## Conclusion

This comprehensive system provides Claude with full context awareness and action capabilities while respecting GitHub Actions limitations. The tool-based approach ensures Claude explicitly requests actions through a transparent, auditable system that works within GitHub's security model and operational constraints.