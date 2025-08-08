# Context-Aware Prompt Evaluation Guide

## Overview
The prompt-expert system can evaluate prompts with full repository context, allowing improved prompts to reference specific code, configurations, and patterns from the target repository.

## How It Works

### 1. Context Loading
When you specify `--repo-path`, the system:
- Loads files from the specified repository
- Generates git blob hashes for caching
- Includes text files, and optionally images/PDFs
- Falls back to directory scanning if files aren't git-tracked

### 2. Path Interpretation
- `./path` or `../path` → Relative to prompt-expert-bank repository
- `/absolute/path` → Absolute filesystem path  
- `owner/repo` → GitHub repository (cloned temporarily)
- `https://github.com/...` → Full GitHub URL

### 3. Evaluation Process
The system runs three evaluation threads:
- **Thread A**: Baseline prompt (no context)
- **Thread B**: Improved prompt (with context)
- **Thread C**: Expert comparison of both responses

### 4. Context Usage Detection
The evaluation looks for:
- References to specific files from the repository
- Mentions of unique identifiers or configuration values
- Code patterns specific to the project
- Architecture understanding demonstrated

## Testing the System

### Local Testing

1. **Run the full test suite**:
   ```bash
   ./test/full-context-test.sh
   ```

2. **See context usage demonstration**:
   ```bash
   node test/demo-context-usage.js
   ```

3. **Test context loading directly**:
   ```bash
   node scripts/repo-context-v2.js ./test/context-test-demo --max-files=10
   ```

### GitHub Actions Testing

After merging to main, comment on any PR:
```
@prompt-expert programming --repo-path="./test/context-test-demo"
```

## Example Test Case

Our test repository (`test/context-test-demo/`) contains:

1. **Unique Markers**:
   - `UNIQUE_PROCESSING_KEY_789` in processor.js
   - `/api/v2/auth/login` endpoint in api-config.json
   - `maxBatchSize = 1000` in DataProcessor class
   - Rate limit of 60 requests/minute

2. **Expected Behavior**:
   - Baseline prompt gives generic advice
   - Improved prompt references specific files and values
   - Context-aware response mentions the unique markers

## File Structure

```
prompt-expert-bank/
├── .github/
│   ├── scripts/
│   │   └── evaluate-with-context.js    # Main evaluation script
│   └── workflows/
│       └── evaluate-prompt.yml         # GitHub Actions workflow
├── scripts/
│   ├── repo-context-v2.js             # Context loader with git hashing
│   └── claude-cache-manager.js        # Cache management for Claude API
├── test/
│   ├── context-test-demo/             # Test repository with unique markers
│   │   ├── README.md
│   │   ├── config/
│   │   │   └── api-config.json
│   │   └── data/
│   │       └── processor.js
│   ├── test-prompt-baseline.md        # Simple prompt without context
│   ├── test-prompt-improved.md        # Context-aware prompt
│   ├── full-context-test.sh          # Automated test script
│   ├── demo-context-usage.js         # Demonstration script
│   └── TEST_RESULTS.md               # Test documentation
└── docs/
    ├── EXPERT_LOADING_EXAMPLES.md    # Expert loading documentation
    └── CONTEXT_EVALUATION_GUIDE.md   # This file
```

## Advanced Features

### External Repository Support
Load context from any GitHub repository:
```
@prompt-expert programming --repo-path="facebook/react"
```

### Expert Loading from External Repos
Experts can also be loaded from external repositories:
```yaml
expert: "anthropics/prompt-engineering:experts/code-review"
```

### Cache Management
The system uses git blob hashes for efficient caching:
- Identical files share the same cache entry
- Cache keys are based on content, not file paths
- Supports Claude API's cache control features

## Troubleshooting

### Context Not Loading
1. Check path interpretation (use `./` for relative paths)
2. Verify files exist and are readable
3. Check git status if expecting git hashes
4. Review logs for fallback to directory scanning

### Markers Not Found
1. Ensure test files contain unique identifiers
2. Check context is being passed to improved prompt
3. Verify systemContext includes expected content
4. Review hash generation for consistency

### GitHub Actions Not Triggering
1. Verify workflow file exists in main branch
2. Check GitHub Actions is enabled
3. Ensure comment format is exact
4. Review workflow run logs

## Best Practices

1. **Use Unique Markers**: Include identifiable strings in test files
2. **Document Context Usage**: Improved prompts should explicitly request context usage
3. **Test Locally First**: Use `full-context-test.sh` before PR testing
4. **Monitor Logs**: Check [REPO-CONTEXT] logs for loading details
5. **Version Control**: Test files should be in git for consistent hashing

## API Integration

The evaluation uses Claude API with:
- Model: `claude-3-5-sonnet-20241022`
- Temperature: 0.0 for consistency
- Cache control for efficient context reuse
- Three separate conversation threads

## Security Considerations

- API keys are stored in GitHub Secrets
- Context loading respects file size limits
- External repos are cloned to temp directories
- Sensitive files can be excluded from context

## Performance

- Max 50 files loaded by default
- Text files limited to 100KB
- Images/PDFs limited to 5MB
- Git hashing for deduplication
- Cache TTL of 1 hour

## Future Enhancements

- [ ] Support for more file types
- [ ] Incremental context updates
- [ ] Context diffing between versions
- [ ] Multi-repository context loading
- [ ] Custom relevance scoring