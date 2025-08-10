# Templates

This folder contains prompt templates used by the GitHub Actions workflow.

## Active Templates

### abtest-evaluation.md
The main A/B test evaluation template using LLM-as-Judge methodology. This template is used when A/B testing is detected in PR comments.

**Variables used:**
- `{{EXPERT_DEFINITION}}` - Expert criteria for evaluation
- `{{EXPERT_NAME}}` - Name of the expert role
- `{{TIMESTAMP}}` - Evaluation timestamp
- `{{BASELINE_PROMPT}}` - The baseline prompt content
- `{{IMPROVED_PROMPT}}` - The improved prompt content
- `{{BASELINE_CONTENT}}` - Response from baseline
- `{{IMPROVED_CONTENT}}` - Response from improved

**Triggered by:** Keywords like "A/B test", "compare", "baseline", "improved", "evaluate"

### claude-response.md
Standard response template for non-A/B test requests. Used for general PR comment responses.

**Variables used:**
- `{{GITHUB_CONTEXT}}` - PR/Issue context information
- `{{USER_REQUEST}}` - The user's request from the comment
- `{{PR_FILE_CONTENTS}}` - Files from the PR (conditional)
- `{{REQUESTED_FILE_CONTENTS}}` - Files mentioned in comment (conditional)
- `{{FILE_VALIDATION_REPORT}}` - File path validation results (conditional)

**Used for:** All non-A/B test @prompt-expert mentions

## Usage

Templates are loaded by `scripts/claude-code-session-simplified.js` when processing GitHub comments:
- A/B test requests trigger `abtest-evaluation.md`
- Standard requests use `claude-response.md`
- Both templates have fallback prompts if files cannot be loaded

## Template Processing

The script automatically:
1. Detects request type based on keywords and file contents
2. Loads the appropriate template
3. Replaces variables with actual content
4. Handles conditional sections ({{#if}} blocks)
5. Falls back to hardcoded prompts if template loading fails