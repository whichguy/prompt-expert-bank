# Repository Context Validation Test Case

## Overview
This test validates that the Prompt Expert system correctly:
1. Loads repository context files with calculated file IDs (git hashes)
2. Sends them to Claude API with proper tracking
3. Uses the SAME context (file IDs) in BOTH Thread A and Thread B evaluations
4. Shows improved evaluation scores when better prompts utilize the context

## Test Setup

### Step 1: Clean Up Old Test Material
```bash
# Remove any existing test files
rm -rf test/context-test-demo/
rm -f test/*demo-prompt*.md
rm -f .claude-cache-index.json
rm -f .prompt-expert-cache.json
```

### Step 2: Create Test Directory Structure
```bash
# Create test directory with unique context
mkdir -p test/context-test-demo/data
mkdir -p test/context-test-demo/config
```

### Step 3: Create Context Files with Unique Information

#### File 1: Configuration File
```bash
cat > test/context-test-demo/config/api-config.json << 'EOF'
{
  "apiEndpoints": {
    "userAuth": "/api/v2/auth/login",
    "dataFetch": "/api/v2/data/fetch",
    "secretKey": "DEMO_API_KEY_12345"
  },
  "rateLimits": {
    "requestsPerMinute": 60,
    "burstLimit": 100
  },
  "features": {
    "enableCache": true,
    "cacheTimeout": 3600,
    "useCompression": true
  }
}
EOF
```

#### File 2: Data Processing Module
```bash
cat > test/context-test-demo/data/processor.js << 'EOF'
/**
 * Data Processor Module
 * This module contains unique logic for processing user data
 */

class DataProcessor {
  constructor() {
    this.processingKey = "UNIQUE_PROCESSING_KEY_789";
    this.maxBatchSize = 1000;
  }

  /**
   * Process user data with special validation
   * @param {Array} data - User data array
   * @returns {Object} Processed result
   */
  processUserData(data) {
    // Unique validation logic
    if (!data || data.length > this.maxBatchSize) {
      throw new Error(`Data batch exceeds maximum size of ${this.maxBatchSize}`);
    }
    
    // Special processing with the unique key
    return {
      processed: data.map(item => ({
        ...item,
        processedAt: new Date().toISOString(),
        signature: this.generateSignature(item)
      })),
      metadata: {
        count: data.length,
        processingKey: this.processingKey,
        maxBatchSize: this.maxBatchSize
      }
    };
  }

  generateSignature(item) {
    // Unique signature generation
    return `SIG_${this.processingKey}_${JSON.stringify(item).length}`;
  }
}

module.exports = DataProcessor;
EOF
```

#### File 3: Architecture Diagram (Image)
```bash
# Create a simple SVG diagram
cat > test/context-test-demo/architecture.svg << 'EOF'
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="100" height="50" fill="lightblue" stroke="black"/>
  <text x="60" y="40" text-anchor="middle">Client</text>
  
  <rect x="150" y="10" width="100" height="50" fill="lightgreen" stroke="black"/>
  <text x="200" y="40" text-anchor="middle">API Gateway</text>
  
  <rect x="290" y="10" width="100" height="50" fill="lightyellow" stroke="black"/>
  <text x="340" y="40" text-anchor="middle">Database</text>
  
  <line x1="110" y1="35" x2="150" y2="35" stroke="black" marker-end="url(#arrowhead)"/>
  <line x1="250" y1="35" x2="290" y2="35" stroke="black" marker-end="url(#arrowhead)"/>
  
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="black"/>
    </marker>
  </defs>
  
  <text x="200" y="100" text-anchor="middle" font-weight="bold">System Architecture</text>
  <text x="200" y="130" text-anchor="middle">Rate Limit: 60 req/min</text>
  <text x="200" y="150" text-anchor="middle">Max Batch: 1000 items</text>
</svg>
EOF
```

### Step 4: Create Initial Bad Prompt (v1)
```bash
cat > test/api-documentation-prompt-v1.md << 'EOF'
# API Documentation Generator Prompt

You are a technical writer creating API documentation.

## Task
Generate API documentation for the provided code.

## Instructions
1. Document all endpoints
2. Include parameters
3. Add examples

## Output Format
Markdown documentation with standard sections.
EOF
```

### Step 5: Commit Initial Version
```bash
cd test/context-test-demo
git init
git add .
git commit -m "Initial test context files"
cd ../..

git add test/api-documentation-prompt-v1.md
git commit -m "Add initial API documentation prompt"
```

### Step 6: Create Improved Prompt (v2) with Context References
```bash
cat > test/api-documentation-prompt-v2.md << 'EOF'
# API Documentation Generator Prompt

You are a technical writer creating comprehensive API documentation for a production system.

## Context Awareness
You have access to the actual codebase including:
- Configuration files showing actual endpoints and rate limits
- Implementation details from processor modules
- Architecture diagrams showing system design

## Task
Generate detailed API documentation that:
1. References the actual endpoints from api-config.json (e.g., /api/v2/auth/login)
2. Documents the real rate limits (60 requests/minute, burst: 100)
3. Explains the data processing constraints (max batch size: 1000 items)
4. References the unique processing key and signature generation
5. Includes the architecture flow from the diagram

## Specific Requirements
- Document the DataProcessor class and its processUserData method
- Include the actual rate limiting values from the config
- Reference the specific endpoints: userAuth and dataFetch
- Explain the signature generation using UNIQUE_PROCESSING_KEY_789
- Note the caching configuration (timeout: 3600 seconds)

## Output Format
Generate documentation that includes:
1. Overview with architecture reference
2. Authentication endpoint (/api/v2/auth/login)
3. Data fetching endpoint (/api/v2/data/fetch)
4. Rate limiting details (60/min, burst 100)
5. Data processing constraints (max 1000 items)
6. Signature verification process
7. Caching behavior (3600s timeout)
8. Error handling for batch size exceeded

Include code examples that show the actual processing logic and configuration values.
EOF
```

### Step 7: Create PR and Run Test
```bash
# Create a new branch
git checkout -b test-context-feature

# Add the improved prompt
git add test/api-documentation-prompt-v2.md
git commit -m "Improve API documentation prompt with context awareness"

# Push and create PR
git push origin test-context-feature
gh pr create --title "Test: Improve API documentation with context" \
  --body "This PR improves the API documentation prompt to reference actual codebase context"
```

### Step 8: Trigger Evaluation with Context
```bash
# Comment on the PR to trigger evaluation with context
gh pr comment --body "@prompt-expert programming --repo-path='test/context-test-demo' --scenario='Generate documentation for the DataProcessor.processUserData method including rate limits and signature generation'"
```

## Expected Results

### Thread A (v1 prompt + repository context)
- Has access to all repository files and file IDs
- But the v1 prompt is generic and doesn't reference the context
- May still produce generic documentation despite having context available
- Context is present but prompt doesn't guide its usage
- **Expected Score: ~5-6/10**

### Thread B (v2 prompt + SAME repository context)
- Has access to the SAME repository files and file IDs as Thread A
- The v2 prompt explicitly references context elements
- Guides the model to use specific values from the context
- References actual endpoints: /api/v2/auth/login, /api/v2/data/fetch
- Documents real rate limits: 60 req/min, burst 100
- Explains DataProcessor.processUserData with batch size 1000
- Describes signature generation with UNIQUE_PROCESSING_KEY_789
- References architecture from SVG diagram
- **Expected Score: ~9-10/10**

### Key Difference
- **Both threads receive the SAME context (file IDs)**
- **Thread A**: Generic prompt + context = poor utilization
- **Thread B**: Context-aware prompt + context = excellent utilization
- **This proves the prompt quality matters even with context available**

## Validation Points

### 1. Check Logs for File Loading
Look for these log entries:
```
[REPO-CONTEXT] Loading repository context from: test/context-test-demo
[REPO-CONTEXT] Found 3 relevant files to load
[REPO-CONTEXT] Loaded text file: config/api-config.json (xxx chars) - Hash: abc12345
[REPO-CONTEXT] Loaded text file: data/processor.js (xxx chars) - Hash: def67890
[REPO-CONTEXT] Loaded image file: architecture.svg (xxxKB) - Hash: ghi11111
```

### 2. Check Claude Cache Tracking
Look for these log entries:
```
[CLAUDE-CACHE] Starting file tracking for session: xxx
[CLAUDE-CACHE] Processing 3 files for Claude API
[CLAUDE-CACHE] NEW FILE: config/api-config.json (text) - Hash: abc12345
[CLAUDE-CACHE] NEW FILE: data/processor.js (text) - Hash: def67890
[CLAUDE-CACHE] NEW FILE: architecture.svg (image) - Hash: ghi11111
[CLAUDE-CACHE] Session xxx summary:
[CLAUDE-CACHE]   - New files: 3
[CLAUDE-CACHE]   - Cached files: 0
```

### 3. Check Evaluation Logs
Look for these log entries:
```
[EVALUATE] Injecting 3 context messages into BOTH evaluation threads
[EVALUATE] Context includes files from: 3 files
[EVALUATE] Both Thread A and Thread B will receive the same repository context
[EVALUATE] Thread A prepared with repository context + baseline prompt
[EVALUATE] Thread B prepared with repository context + PR prompt
[EVALUATE] File IDs from repository context are shared between threads
[EVALUATE] Executing Thread A with repository context
[EVALUATE] Executing Thread B with repository context
```

### 4. Verify Evaluation Report
The evaluation report should show:
- Thread B response includes specific values:
  - "/api/v2/auth/login" endpoint
  - "60 requests per minute" rate limit
  - "1000 items" batch size
  - "UNIQUE_PROCESSING_KEY_789" in signature
  - "3600 seconds" cache timeout

### 5. Score Improvement
- Thread A (v1, no context): Lower score due to generic content
- Thread B (v2, with context): Higher score due to specific, accurate references

## Running the Test

### Automated Test Script
```bash
#!/bin/bash
# Save as: test/run-context-validation.sh

set -e

echo "=== Starting Repository Context Validation Test ==="

# Step 1: Cleanup
echo "Step 1: Cleaning up old test material..."
rm -rf test/context-test-demo/
rm -f test/*demo-prompt*.md
rm -f test/api-documentation-prompt-*.md

# Step 2-3: Create test structure and files
echo "Step 2-3: Creating test files..."
mkdir -p test/context-test-demo/data
mkdir -p test/context-test-demo/config

# Create all test files (content from above)
# ... (include all file creation commands)

# Step 4-5: Create and commit v1
echo "Step 4-5: Creating v1 prompt..."
# ... (create v1 prompt)

# Step 6: Create v2
echo "Step 6: Creating v2 prompt..."
# ... (create v2 prompt)

echo "=== Test setup complete ==="
echo "Now create a PR and run:"
echo "  @prompt-expert programming --repo-path='test/context-test-demo'"
```

## Success Criteria

✅ **Test Passes If:**
1. All 3 context files are loaded with calculated file IDs (git hashes)
2. Files are tracked in Claude cache manager with proper hash IDs
3. SAME context (file IDs) is injected into BOTH Thread A and Thread B
4. Thread B response contains specific values from context files
5. Thread A response is more generic despite having same context
6. Thread B scores higher than Thread A (improvement ≥ 30%)
7. Evaluation report shows both threads received same context
8. Logs confirm "Both Thread A and Thread B will receive the same repository context"

❌ **Test Fails If:**
1. Context files are not loaded
2. Cache tracking shows errors
3. Thread B doesn't reference specific values
4. No score improvement between threads
5. Evaluation doesn't show context usage

## Debugging

If the test fails, check:
1. **Workflow logs** - Verify context loading steps executed
2. **File paths** - Ensure repo-path points to correct directory
3. **File hashes** - Check git blob hashes are calculated correctly
4. **API logs** - Verify context messages were sent to Claude
5. **Cache index** - Check .claude-cache-index.json for tracked files

## Cleanup

After test completion:
```bash
# Remove test files
rm -rf test/context-test-demo/
rm -f test/api-documentation-prompt-*.md
rm -f .claude-cache-index.json

# Remove test branch
git branch -D test-context-feature
```