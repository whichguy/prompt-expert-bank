# PromptExpert v2 Usage Guide

## New Command Syntax

The new PromptExpert v2 workflow uses a flexible command syntax:

```
@promptexpert <expert> <instructions>
```

## Examples

### Review a PR for Security Issues
```
@promptexpert security analyze this PR for potential vulnerabilities and suggest fixes
```

### Improve Code Quality
```
@promptexpert programming review the code structure and suggest refactoring improvements
```

### Check Financial Compliance
```
@promptexpert financial ensure all financial advice includes proper disclaimers
```

### Update Documentation
```
@promptexpert general update the README to reflect the latest changes
```

### Request Changes
```
@promptexpert security this code has SQL injection risks, please fix before merging
```

## Available Actions

Based on the expert's analysis and your instructions, PromptExpert v2 can:

1. **Post Comments** - Provide feedback and suggestions
2. **Update Files** - Make direct improvements to code/docs
3. **Close PRs** - If critical issues are found
4. **Approve PRs** - When everything looks good
5. **Request Changes** - Formally request improvements

## How It Works

1. **Command Parsing**: Extracts the expert name and instructions
2. **Context Gathering**: 
   - PR metadata (title, author, branches)
   - Changed files with patches
   - Recent comments
   - Commit history
3. **Expert Analysis**: Loads expert definition and analyzes with full context
4. **Automated Actions**: Executes the recommended actions

## Response Format

PromptExpert v2 uses a structured JSON response format:

```json
{
  "analysis": "Detailed analysis of the PR",
  "actions": [
    {
      "type": "comment",
      "content": "Feedback to post on PR"
    },
    {
      "type": "update_file",
      "filename": "path/to/file.md",
      "content": "Updated content"
    }
  ],
  "summary": "Brief summary of actions taken"
}
```

## Available Experts

- `security` - Security analysis and vulnerability detection
- `programming` - Code quality and best practices
- `financial` - Financial compliance and disclaimers
- `data-analysis` - Data science and analytics review
- `general` - General improvements and documentation

## Benefits Over v1

1. **Flexible Instructions** - No more rigid `--suggest:` format
2. **Multiple Actions** - Can comment, update files, and manage PR state
3. **Full Context** - Sees entire PR context, not just changed files
4. **Expert Knowledge** - Loads domain-specific expert definitions
5. **Automated Workflow** - Takes direct action based on analysis