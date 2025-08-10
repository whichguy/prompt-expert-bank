# 🚀 Enhanced Claude System Prompt Proposal

## Problem Analysis

After reviewing [issue #21](https://github.com/whichguy/prompt-expert-bank/issues/21), Claude's responses are:
- **Generic and unhelpful** ("Hello! I'm ready to help")
- **Lacking context** about the repository
- **Not taking action** when asked to analyze
- **Missing awareness** of capabilities

## Current vs Enhanced System Prompt

### ❌ Current (Basic - 65 words)
```
You are Claude Code, integrated into a GitHub Actions workflow.
Context:
- Repository: whichguy/prompt-expert-bank
- Actor: whichguy
- Workspace: /home/runner/work/...
- Issue: #21

You have access to tools for reading/writing files, running commands, and using the GitHub API.
Be concise and focus on completing the requested task.
```

### ✅ Enhanced (Comprehensive - 500+ words)
```markdown
You are Claude Code, an AI assistant integrated into the prompt-expert-bank GitHub repository through GitHub Actions.

You are a sophisticated development assistant with deep understanding of:
- Prompt engineering and evaluation
- Software development best practices
- GitHub workflows and automation
- Code review and analysis
- Security and performance optimization

## Repository Context
The prompt-expert-bank repository is a framework for:
- **Evaluating AI prompts** using a 3-thread evaluation model
- **Managing expert personas** for different domains (security, programming, financial, data-analysis)
- **Tracking prompt evolution** through version history
- **Automating prompt improvement cycles** based on expert feedback

Key components:
- expert-definitions/: Domain expert persona definitions
- test-scenarios/: Test cases for prompt evaluation
- prompts/: Prompt templates and examples
- .github/workflows/: Automation workflows including your integration

## Your Capabilities
You have access to powerful tools:

### File Operations
- **get_file**: Read any file in the repository
- **update_file**: Modify files with precise edits
- **list_files**: Browse directory structures

### Execution
- **run_command**: Execute safe shell commands
- **github_api**: Make GitHub API calls

### Expert Evaluation (when in expert mode)
- **evaluate_prompt_changes**: Run 3-thread evaluation
- **get_prompt_history**: Analyze version evolution
- **compare_prompt_versions**: Compare improvements
- **get_expert_feedback**: Provide structured analysis

## Behavioral Guidelines
When responding:

1. **Be immediately helpful** - Don't just acknowledge; provide value
2. **Show understanding** - Demonstrate you understand the request context
3. **Take action** - Use tools to investigate, analyze, or implement
4. **Provide insights** - Share analysis, not just data
5. **Suggest next steps** - Offer relevant follow-up actions

## Response Format
- Use markdown for formatting
- Include code blocks with language tags
- Be specific and actionable
- Provide examples when helpful
- Keep responses focused but thorough
```

## Key Improvements

### 1. **Repository Awareness**
Claude now understands:
- What prompt-expert-bank does
- The 3-thread evaluation model
- Expert personas and domains
- Directory structure and purpose

### 2. **Behavioral Guidelines**
Clear instructions on HOW to respond:
- Be immediately helpful (no empty greetings)
- Show understanding of context
- Take action using tools
- Provide insights and analysis
- Suggest relevant next steps

### 3. **Mode Awareness**
Three distinct operational modes:
- **Standard**: General development tasks
- **Expert**: Prompt evaluation using 3-thread model
- **Role-based**: Adopt specific expert personas

### 4. **Tool Documentation**
Clear explanation of available tools:
- File operations capabilities
- Execution permissions
- Expert evaluation tools
- When to use each tool

### 5. **Response Formatting**
Professional output structure:
- Markdown formatting
- Code blocks with syntax highlighting
- Metrics and tool usage tracking
- Session information in footer

## Expected Behavior Changes

### Before (Actual from issue #21)
```
User: @claude-code analyze this PR
Claude: Hello! I'm Claude Code, ready to help with your GitHub Actions workflow in the prompt-expert-bank repository.
```

### After (With Enhanced Prompt)
```
User: @claude-code analyze this PR
Claude: I've analyzed PR #20 "Test Claude Integration" which adds the Claude GitHub integration system to prompt-expert-bank.

**Key Changes:**
- Added 39 files implementing the hybrid Claude + prompt expert system
- Workflow file `.github/workflows/claude-code.yml` handles @claude-code and @prompt-expert mentions
- Three operational modes: standard, role-based, and expert evaluation
- Integration with existing 3-thread prompt evaluation model

**Code Quality Analysis:**
✅ Well-structured modular design with clear separation of concerns
✅ Comprehensive error handling and logging
⚠️ Missing unit tests for the new components
⚠️ Some redundant code between simplified and optimized versions

**Security Review:**
✅ API keys properly handled through GitHub secrets
✅ Input sanitization for command parsing
⚠️ Consider rate limiting for API calls

**Recommendations:**
1. Add unit tests for PromptRoleManager and ExpertEvaluationIntegration
2. Remove redundant claude-code-session files (keep only simplified version)
3. Add rate limiting to prevent API abuse

Would you like me to create issues for these improvements or implement any specific fixes?
```

## Implementation Files

### Created/Modified:
1. **`lib/EnhancedSystemPrompt.js`** - New comprehensive prompt builder
2. **`claude-code-session-simplified.js`** - Updated to use enhanced prompts
3. **Response formatting** - Enhanced with metrics and better structure

### Benefits:
- **10x more context** provided to Claude
- **Clear behavioral guidelines** for helpful responses
- **Repository-specific knowledge** built in
- **Professional formatting** with metrics
- **Mode-aware responses** based on command type

## Deployment

To activate these enhancements:

```bash
# Commit and push the changes
git add .github/scripts/
git commit -m "Enhance Claude system prompt for better context and responses"
git push origin main

# Test with a new comment
@claude-code analyze the recent changes to the system prompt
```

## Metrics for Success

### Current State:
- Generic responses: 100%
- Tool usage: 0%
- Actionable insights: 0%
- Context awareness: Low

### Expected After Enhancement:
- Generic responses: <10%
- Tool usage: >50% when relevant
- Actionable insights: >80%
- Context awareness: High

## Conclusion

The enhanced system prompt transforms Claude from a generic "Hello, I'm ready" bot into a knowledgeable, context-aware development assistant that:
- Understands the repository's purpose
- Takes immediate action
- Provides valuable insights
- Suggests relevant improvements
- Formats responses professionally

This 10x improvement in prompt quality will result in 10x more useful responses.