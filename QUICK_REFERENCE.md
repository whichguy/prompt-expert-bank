# Prompt Expert - Quick Reference

## 🚀 Quick Start

### Test Everything Locally
```bash
# Run full test suite
./test/full-context-test.sh

# See demonstration
node test/demo-context-usage.js
```

### Test with GitHub Actions
```
@prompt-expert programming --repo-path="./test/context-test-demo"
```

## 📁 Path Formats

| Format | Example | Resolves To |
|--------|---------|-------------|
| `./path` | `./test/context-test-demo` | Relative to prompt-expert-bank |
| `/path` | `/home/user/project` | Absolute filesystem path |
| `owner/repo` | `facebook/react` | GitHub repository |
| `https://...` | `https://github.com/owner/repo` | Full GitHub URL |

## 🎯 Test Markers

Look for these in evaluation results:
- `UNIQUE_PROCESSING_KEY_789` - From processor.js
- `/api/v2/auth/login` - From api-config.json
- `maxBatchSize = 1000` - From DataProcessor
- `60 requests per minute` - Rate limit config

## 📊 Evaluation Flow

```
1. Load Context → 2. Send to Claude → 3. Compare Responses
       ↓                ↓                      ↓
   [Git Hash]    [Thread A: Base]     [Thread C: Expert]
                 [Thread B: Improved]
```

## 🔧 Key Commands

### Load Context
```bash
node scripts/repo-context-v2.js <path> [options]
  --max-files=N        # Limit files loaded
  --include-images     # Include image files
  --include-pdfs       # Include PDF files
```

### GitHub CLI
```bash
# View PR
gh pr view 7

# Check workflow runs
gh run list --workflow=evaluate-prompt.yml
```

## 📝 File Locations

- **Test Prompts**: `test-prompt-baseline.md`, `test-prompt-improved.md`
- **Test Context**: `test/context-test-demo/`
- **Evaluation Script**: `.github/scripts/evaluate-with-context.js`
- **Context Loader**: `scripts/repo-context-v2.js`

## ✅ Success Indicators

1. **Context Loading**:
   - "Found N relevant files to load"
   - Files show with hash IDs

2. **Evaluation**:
   - Baseline gives generic advice
   - Improved references specific files
   - Unique markers appear in improved response

3. **Comparison**:
   - Expert identifies context usage
   - Specific improvements noted

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| No files loaded | Check path, use `./` prefix |
| Git hash missing | Files not tracked, uses content hash |
| Workflow not triggered | Check comment format exactly |
| No context in response | Verify improved prompt asks for context |

## 🔗 Links

- **PR #7**: https://github.com/whichguy/prompt-expert-bank/pull/7
- **Actions**: https://github.com/whichguy/prompt-expert-bank/actions
- **Full Guide**: `docs/CONTEXT_EVALUATION_GUIDE.md`

## 💡 Tips

- Always test locally first with `./test/full-context-test.sh`
- Use unique markers in test files for easy validation
- Check [REPO-CONTEXT] logs for debugging
- Improved prompts should explicitly request context usage