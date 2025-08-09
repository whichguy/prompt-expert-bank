# Claude Code Integration for Prompt Expert System

## Overview

The Claude Code Integration system enables Claude to act as an intelligent assistant within GitHub Pull Requests and Issues, providing prompt evaluation, code analysis, and automated improvements through a comprehensive set of tools.

## Features

### Core Capabilities
- **Prompt Evaluation & Testing**: Execute prompts with experts and analyze results
- **A/B Testing**: Compare prompt implementations with automated scoring
- **Auto-Implementation**: Automatically implement suggested improvements when scores are below threshold
- **Context-Aware Tools**: Different tool sets for PRs vs Issues
- **Binary Data Handling**: Automatic detection and base64 encoding for images, PDFs, etc.
- **Comprehensive Error Recovery**: Handles git locks, rate limits, network errors
- **Structured Logging**: Full audit trail with GitHub Actions integration

### Tool Categories

#### Prompt Evaluation Tools
- `evaluate_prompt` - Test prompts with experts and scenarios
- `run_prompt_ab_test` - Compare two prompt variants
- `analyze_prompt_performance` - Analyze prompt metrics

#### File Operations
- `read_file` - Read repository files (text/binary)
- `write_file` - Create/update files with auto-encoding
- `delete_file` - Remove files from repository
- `search_repository` - Search code patterns
- `list_directory` - Browse repository structure

#### Git Operations
- `git_diff` - View changes
- `git_commit` - Create commits
- `git_command` - Execute git commands

#### PR-Specific Tools (PR context only)
- `pr_comment` - Add comments
- `pr_review` - Submit reviews with inline feedback
- `pr_add_labels` / `pr_remove_labels` - Manage labels
- `pr_update_title` / `pr_update_description` - Modify PR metadata
- `pr_request_reviewers` - Request reviews
- `pr_merge` - Merge PR (with approval)
- `pr_close` - Close without merging

#### Issue-Specific Tools (Issue context only)
- `issue_comment` - Add comments
- `issue_add_labels` / `issue_remove_labels` - Manage labels
- `issue_assign` / `issue_unassign` - Manage assignees
- `issue_update_title` / `issue_update_body` - Modify issue
- `issue_close` / `issue_reopen` - Manage issue state

## Usage

### Basic Command Syntax
```
@prompt-expert <expert> [--options] <prompt>
```

### Examples

#### Simple Evaluation
```
@prompt-expert programming --evaluate "Test the error handling prompt"
```

#### A/B Testing with Auto-Implementation
```
@prompt-expert security --auto-implement "Compare and improve the SQL injection prevention prompt"
```

#### Complex Analysis with Options
```
@prompt-expert code-reviewer --aggressive --test --fix "Review the authentication module for security vulnerabilities"
```

### Command Options
- `--evaluate` - Run evaluation tests on the prompt
- `--auto-implement` - Automatically implement improvements if score < 8.0
- `--aggressive` - Use more thorough analysis
- `--test` - Run tests after modifications
- `--fix` - Attempt to fix identified issues

## Auto-Implementation Feature

When Claude evaluates a prompt and finds the average score is below 8.0/10, it can automatically:

1. Generate an improved version addressing identified weaknesses
2. Write the improved prompt to the appropriate file
3. Commit the changes with detailed message
4. Post a comment explaining the improvements
5. Suggest re-evaluation of the improved prompt

To enable auto-implementation, use the `--auto-implement` flag or ensure the prompt evaluation includes `autoImplement: true`.

## Production Readiness Features

### Error Recovery
- **Git Lock Handling**: Automatically removes index.lock and retries
- **Detached HEAD Recovery**: Creates temporary branch and continues
- **Rate Limit Management**: Exponential backoff with smart waiting
- **Network Error Retry**: Automatic retry for transient failures
- **SHA Mismatch Resolution**: Fetches latest SHA and retries

### Security Features
- **Safe Command Mode**: Restricts dangerous commands by default
- **Secret Access Control**: Requires manual approval for secrets
- **Path Sanitization**: Prevents directory traversal attacks
- **Permission Validation**: Checks GitHub token permissions
- **Audit Logging**: Complete trail of all operations

### Performance Optimizations
- **Request Batching**: Minimizes API calls
- **Parallel Execution**: Runs independent operations concurrently
- **Smart Caching**: Reduces redundant fetches
- **Timeout Management**: Configurable timeouts for long operations

## Workflow Integration

### GitHub Actions Workflow
The system triggers on issue comments containing `@prompt-expert`:

```yaml
on:
  issue_comment:
    types: [created]

jobs:
  claude-code:
    if: contains(github.event.comment.body, '@prompt-expert')
    # ... workflow steps
```

### Workflow Features
- Automatic branch checkout for PRs
- Git identity configuration
- Node.js environment setup
- Dependency installation
- Visual feedback via reactions (👀→🚀/😕)
- Automatic change pushing
- Error reporting in comments

## Monitoring & Debugging

### Structured Logging
Every operation is logged with:
- Correlation ID for session tracking
- Timestamp and duration
- Context (PR/Issue number, repository)
- Success/failure status
- Detailed error information

### GitHub Actions Summary
After each session, a summary is generated showing:
- Total tools executed
- Success rate
- Errors and warnings
- Performance metrics
- Session duration

### Debug Mode
Enable debug logging by setting:
```yaml
env:
  RUNNER_DEBUG: '1'
```

## Edge Cases Handled

1. **Fork PRs**: Detects read-only permissions and warns
2. **Large Files**: Handles files up to 100MB (GitHub API limit)
3. **Binary Files**: Automatic base64 encoding/decoding
4. **Merge Conflicts**: Reports conflicts and suggests resolution
5. **Branch Protection**: Detects and reports protection violations
6. **Concurrent Modifications**: SHA verification prevents overwrites
7. **Workflow Timeouts**: Checkpoints progress for recovery

## Configuration

### Environment Variables
Required:
- `ANTHROPIC_API_KEY` - Claude API key
- `GITHUB_TOKEN` - GitHub token with appropriate permissions

Optional:
- `RUNNER_DEBUG` - Enable debug logging
- `MAX_RETRIES` - Maximum retry attempts (default: 3)
- `TIMEOUT_SECONDS` - Operation timeout (default: 30)

### Permissions Required
```yaml
permissions:
  contents: write     # File operations
  pull-requests: write # PR operations
  issues: write       # Issue/label operations
  actions: read       # Workflow metadata
  checks: write       # Status checks
```

## Best Practices

1. **Use Specific Experts**: Choose the most relevant expert for your use case
2. **Provide Context**: Include relevant details in your prompt
3. **Review Auto-Implementations**: Always review automatically generated changes
4. **Monitor Rate Limits**: Be aware of GitHub API limits (1000/hour)
5. **Test in Draft PRs**: Test complex operations in draft PRs first

## Troubleshooting

### Common Issues

#### "Not in git repository"
- **Cause**: Workflow didn't checkout code properly
- **Fix**: Ensure workflow includes `actions/checkout@v4` with proper token

#### "Rate limit exceeded"
- **Cause**: Too many API requests
- **Fix**: Wait for reset or use different token

#### "Permission denied"
- **Cause**: Insufficient GitHub token permissions
- **Fix**: Update workflow permissions or use PAT

#### "Detached HEAD state"
- **Cause**: Incorrect branch checkout
- **Fix**: System automatically creates temporary branch

## Support

For issues or feature requests, please:
1. Check the workflow logs for detailed error information
2. Review the session summary in GitHub Actions
3. Create an issue with the correlation ID and error details

## License

This system is part of the prompt-expert-bank project and follows the same licensing terms.