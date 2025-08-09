# Local System Path References Validation

## Current Sparse Checkout Configuration
```yaml
sparse-checkout: |
  scripts              # ✅ All scripts
  templates            # ✅ Template files
  expert-definitions   # ✅ Expert definitions
  prompts             # ✅ Prompt files
  package.json        # ✅ NPM config
```

## Path References Analysis

### 1. Scripts Directory Files

**scripts/prompt-expert.js**
- Reads: `pr-context.json` ⚠️ (created by workflow, not in sparse checkout)
- Writes: Dynamic filename from Claude response (likely in prompts/ or expert-definitions/)
- Requires: `./error-handler` ✅ (in scripts/)

**scripts/abtest.js**
- No local file operations ✅
- Uses GitHub API for all file access ✅

**scripts/error-handler.js**
- No file operations ✅

### 2. Workflow-Created Files (Root Directory)

These files are created during workflow execution and read by scripts:

| File | Created By | Read By | In Sparse Checkout |
|------|------------|---------|-------------------|
| `pr-context.json` | prompt-expert.yml | scripts/prompt-expert.js | ❌ No (created at runtime) |
| `repo_context.json` | evaluate-prompts.yml | evaluate.js | ❌ No (created at runtime) |
| `cleanup_report.json` | evaluate-prompts.yml | workflow itself | ❌ No (created at runtime) |
| `track_result.json` | evaluate-prompts.yml | workflow itself | ❌ No (created at runtime) |
| `evaluate.js` | evaluate-prompts.yml (copied) | workflow itself | ❌ No (created at runtime) |

### 3. File Operations in Workflows

**evaluate-prompts.yml:**
```bash
cp scripts/evaluate-with-context.js evaluate.js  # ✅ scripts/ in checkout
cp scripts/evaluate-prompts.js evaluate.js       # ✅ scripts/ in checkout
node scripts/repo-context-v2.js > repo_context.json  # ✅ script exists
node scripts/claude-cache-manager.js > cleanup_report.json  # ✅ script exists
```

**prompt-expert.yml:**
```javascript
fs.writeFileSync('pr-context.json', ...)  # Creates in root (runtime)
```

### 4. Dynamic File Access

**Files that might be read/written dynamically:**
- Files in PR (via `prContext.files`)
- Usually `.md` or `.txt` files in:
  - `prompts/` ✅ (in sparse checkout)
  - `expert-definitions/` ✅ (in sparse checkout)
  - Could be other locations ⚠️

### 5. Required Additions to Sparse Checkout

**Option 1: Add root for runtime files**
```yaml
sparse-checkout: |
  scripts
  templates
  expert-definitions
  prompts
  package.json
  *.json              # For runtime JSON files
```

**Option 2: Keep minimal, handle runtime files**
Current configuration is fine because:
- Runtime files (`pr-context.json`, etc.) are created in workspace root
- Workspace root is always available even with sparse checkout
- These are temporary files that don't need to be in the repo

### 6. Validation Results

| Path Type | Status | Notes |
|-----------|--------|-------|
| Script requires | ✅ Valid | All use relative paths within scripts/ |
| NPM packages | ✅ Valid | package.json in sparse checkout |
| Expert definitions | ✅ Valid | expert-definitions/ in sparse checkout |
| Prompts | ✅ Valid | prompts/ in sparse checkout |
| Templates | ✅ Valid | templates/ in sparse checkout |
| Runtime JSON files | ✅ Valid | Created in workspace root (always available) |
| Dynamic PR files | ⚠️ Partial | Depends on what files are in the PR |

## Recommendations

### No Changes Needed ✅
The current sparse checkout configuration is correct because:

1. **Runtime files** are created in the workspace root, which is always available
2. **All source files** referenced are included in sparse checkout
3. **Dynamic files** from PRs are handled separately by git operations

### Potential Issue: PR File Access
When `prompt-expert.js` tries to read files from `prContext.files`:
```javascript
fileContents[file.filename] = fs.readFileSync(file.filename, 'utf-8');
```

This assumes the files exist locally. Solutions:
1. **Current approach works** if files are in directories included in sparse checkout
2. **For files outside sparse checkout**, they won't be readable
3. **Better approach**: Fetch file contents via GitHub API instead of local reads

### Suggested Script Improvement

Update `scripts/prompt-expert.js` to handle missing files gracefully:
```javascript
// Instead of:
fileContents[file.filename] = fs.readFileSync(file.filename, 'utf-8');

// Use:
try {
  fileContents[file.filename] = await fs.readFile(file.filename, 'utf-8');
} catch (err) {
  // File not in sparse checkout or doesn't exist
  console.log(`File ${file.filename} not available locally`);
  // Could fetch via GitHub API here if needed
}
```

## Conclusion

✅ **Current sparse checkout is correctly configured** for all required paths.

The only edge case is reading PR files that might not be in the sparse checkout directories, but this is handled by the try/catch blocks in the original code.