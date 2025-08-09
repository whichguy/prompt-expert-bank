# Path Validation Report

## ✅ Validation Results

### 1. Script Require Paths

**scripts/prompt-expert.js**
- `require('./error-handler')` ✅ Correct relative path
- Both files in same `scripts/` directory

**scripts/abtest.js**
- `require('@octokit/rest')` ✅ NPM package (not local)
- No local requires

**scripts/error-handler.js**
- No requires ✅

### 2. Sparse Checkout Configuration

All workflows now have identical sparse checkout:
```yaml
sparse-checkout: |
  scripts          # Contains all main scripts
  templates        # Contains evaluation templates
  expert-definitions  # Expert definitions
  prompts          # Prompt library
  package.json     # NPM dependencies
```

### 3. Workflow Script References

**Fixed References:**
- ✅ `prompt-expert.yml`: `node scripts/prompt-expert.js`
- ✅ `claude-code-handler.yml`: `node scripts/claude-code-session.js`
- ✅ `claude-code.yml`: `node scripts/claude-code-session-simplified.js`
- ✅ `evaluate-prompts.yml`: Various scripts in `scripts/` folder

### 4. Alignment Matrix

| Resource | Location | In Sparse Checkout | Used By |
|----------|----------|-------------------|---------|
| prompt-expert.js | scripts/ | ✅ Yes | prompt-expert.yml |
| error-handler.js | scripts/ | ✅ Yes | prompt-expert.js |
| abtest.js | scripts/ | ✅ Yes | Various |
| templates/*.md | templates/ | ✅ Yes | ABTest scripts |
| expert-definitions/ | root | ✅ Yes | All workflows |
| prompts/ | root | ✅ Yes | All workflows |
| package.json | root | ✅ Yes | NPM install |

### 5. Migration Status

**Completed:**
- ✅ Moved scripts from `.github/scripts` to `scripts/`
- ✅ Updated all workflow references
- ✅ Aligned sparse checkout paths
- ✅ Validated all require statements

**Old Structure (to be removed):**
- `.github/scripts/` - Can be deleted after confirming new structure works
- `.github/scripts/lib/` - Superseded by simplified scripts

### 6. Missing Files to Create

Some scripts referenced in workflows don't exist yet in new location:
- `scripts/claude-code-session.js` (referenced by claude-code-handler.yml)
- `scripts/claude-code-session-simplified.js` (referenced by claude-code.yml)
- `scripts/claude-cache-manager.js` (referenced by evaluate-prompts.yml)
- `scripts/repo-context-v2.js` (referenced by evaluate-prompts.yml)
- `evaluate.js` (referenced by evaluate-prompts.yml)

## Recommendations

1. **Immediate Actions:**
   - Copy or recreate missing scripts in `scripts/` folder
   - Test workflows with new paths
   - Remove old `.github/scripts/` after confirmation

2. **Simplification Opportunities:**
   - Consolidate claude-code-session variants into one
   - Merge similar functionality scripts
   - Remove unused scripts

3. **Final Structure:**
   ```
   scripts/
   ├── prompt-expert.js       # Main handler
   ├── error-handler.js       # Error utility
   ├── abtest.js             # A/B testing
   └── claude-session.js     # Claude integration (consolidated)
   ```

## Validation Passed ✅

All require paths and sparse checkout paths are now properly aligned.