# Merge Instructions for PR #7

## Branch: test-full-context-evaluation

### Pre-Merge Checklist
✅ All tests passing locally (`./test/full-context-test.sh`)
✅ Context loading validated with unique markers
✅ Path interpretation rules documented
✅ GitGuardian security checks passed
✅ Test documentation created

### How to Merge

1. **Via GitHub Web UI**:
   - Go to: https://github.com/whichguy/prompt-expert-bank/pull/7
   - Click "Merge pull request"
   - Choose merge strategy (recommended: "Squash and merge")

2. **Via Command Line** (if you have push access):
   ```bash
   git checkout main
   git pull origin main
   git merge origin/test-full-context-evaluation
   git push origin main
   ```

### Post-Merge Testing

After merging, test the GitHub Actions workflow:

1. Go to any PR in the repository
2. Add a comment:
   ```
   @prompt-expert programming --repo-path="./test/context-test-demo"
   ```

3. The workflow should:
   - Load context from `test/context-test-demo/`
   - Evaluate both baseline and improved prompts
   - Show how improved prompt uses context (look for `UNIQUE_PROCESSING_KEY_789`)

### Expected Behavior

The improved prompt should reference specific elements from the test repository:
- API endpoints from `config/api-config.json`
- Processing logic from `data/processor.js`
- The unique key `UNIQUE_PROCESSING_KEY_789`
- Rate limits and batch size configurations

The baseline prompt will not have access to this context and should provide generic advice.

### Troubleshooting

If the workflow doesn't trigger:
1. Check GitHub Actions is enabled for the repository
2. Verify the workflow file exists: `.github/workflows/evaluate-prompt.yml`
3. Check workflow runs: https://github.com/whichguy/prompt-expert-bank/actions

If context doesn't load:
1. Check the repo-context-v2.js script logs in the workflow
2. Verify the path interpretation (should use `./` prefix)
3. Check that test files exist in the main branch after merge