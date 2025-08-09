# Sparse Checkout Analysis for prompt-expert-bank

## Current Sparse Checkout Configuration

```yaml
sparse-checkout: |
  .github/scripts
  .github/scripts/lib
  .github/scripts/lib/templates
  expert-definitions
  prompts
sparse-checkout-cone-mode: false
```

## File Dependencies Analysis

### 1. Node Script Dependencies (.github/scripts/)

#### Main Entry Points
- `claude-code-session.js` requires:
  - `./lib/ClaudeToolExecutor`
  - `./lib/StructuredLogger`
  - `./lib/CommandParser`
  - `./lib/ContextBuilder`
  - `./lib/ToolDefinitions`

- `prompt-expert-handler.js` requires:
  - Calls `evaluate-with-context.js` via child_process
  - No direct file requires

- `evaluate-prompts.js`:
  - External dependencies only (@anthropic-ai/sdk, @octokit/rest)

### 2. Library Dependencies (.github/scripts/lib/)

All lib files are self-contained within the lib directory and templates subdirectory.

### 3. GitHub API File Access Patterns

From ABTestSimplified.js and examples:
- `expert-definitions/*.md` - Expert definition files
- `prompts/*.md` - Prompt files  
- `.github/workflows/*.yml` - Workflow files (for context)
- Cross-repo access (e.g., `facebook/react:README.md`)

### 4. Potential Additional Paths

Based on example usage patterns, these paths might be accessed:
- `src/` - Source code files (context loading)
- `README.md` - Repository documentation
- `package.json` - Package configuration
- `security-config.json` - Security configurations
- `.github/workflows/` - Workflow files

## Recommended Enhanced Sparse Checkout

```yaml
sparse-checkout: |
  # Core script infrastructure
  .github/scripts
  .github/scripts/lib
  .github/scripts/lib/templates
  .github/scripts/config
  .github/scripts/examples
  .github/scripts/tests
  
  # Expert and prompt definitions
  expert-definitions
  prompts
  
  # Common context files that might be accessed
  README.md
  package.json
  
  # Workflow files (for context analysis)
  .github/workflows
  
  # Optional: Source directories if referenced
  # src
  # tests
  # docs
  
sparse-checkout-cone-mode: false
```

## Current Configuration Assessment

✅ **Adequate for basic operations:**
- All Node scripts and their lib dependencies are included
- Expert definitions and prompts are available
- Template files are accessible

⚠️ **Potential issues:**
- Missing `.github/scripts/config/` directory
- Missing `.github/workflows/` for workflow context analysis
- Missing root files like README.md and package.json if referenced

## Recommendations

1. **Minimal Addition** (Recommended):
   ```yaml
   sparse-checkout: |
     .github/scripts
     .github/scripts/lib
     .github/scripts/lib/templates
     .github/scripts/config
     .github/workflows
     expert-definitions
     prompts
     README.md
     package.json
   sparse-checkout-cone-mode: false
   ```

2. **Conservative Approach** (Current - Works for most cases):
   Keep current configuration as-is since:
   - Core functionality is covered
   - Additional files are fetched via GitHub API when needed
   - Reduces checkout size and time

3. **Comprehensive Approach** (If issues arise):
   Add directories as needed when scripts fail due to missing files

## Validation

The current sparse checkout configuration covers:
- ✅ All Node.js script requires (`./lib/*`)
- ✅ Expert definition files
- ✅ Prompt files
- ✅ Template files
- ⚠️ Config files (if used)
- ⚠️ Workflow files (if analyzed)

## Conclusion

The current sparse checkout configuration is **adequate for the core functionality** but could benefit from adding:
1. `.github/scripts/config` - For configuration files
2. `.github/workflows` - For workflow analysis
3. `README.md` and `package.json` - Common reference files

These additions would prevent potential "file not found" errors without significantly increasing checkout time.