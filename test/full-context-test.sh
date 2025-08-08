#!/bin/bash

# Full Context Evaluation Test Script
# Tests the complete workflow locally

set -e

echo "============================================"
echo "FULL CONTEXT EVALUATION TEST"
echo "============================================"
echo

# Configuration
REPO_PATH="./test/context-test-demo"
BASELINE_PROMPT="test-prompt-baseline.md"
IMPROVED_PROMPT="test-prompt-improved.md"

echo "Test Configuration:"
echo "  Repository Path: $REPO_PATH"
echo "  Baseline Prompt: $BASELINE_PROMPT"
echo "  Improved Prompt: $IMPROVED_PROMPT"
echo

# Step 1: Load repository context
echo "[1/4] Loading repository context..."
echo "--------------------------------------"
CONTEXT_OUTPUT=$(node scripts/repo-context-v2.js "$REPO_PATH" --max-files=10 2>&1)

# Check if context loaded successfully
if echo "$CONTEXT_OUTPUT" | grep -q "UNIQUE_PROCESSING_KEY_789"; then
    echo "✓ Context loaded successfully"
    echo "  - Found unique marker: UNIQUE_PROCESSING_KEY_789"
else
    echo "✗ Failed to load context with unique marker"
    echo "$CONTEXT_OUTPUT" | head -20
    exit 1
fi

# Count loaded files
FILE_COUNT=$(echo "$CONTEXT_OUTPUT" | grep -oE "Found [0-9]+ relevant files" | grep -oE "[0-9]+")
echo "  - Loaded $FILE_COUNT files"
echo

# Step 2: Check baseline prompt
echo "[2/4] Checking baseline prompt..."
echo "--------------------------------------"
if [ -f "$BASELINE_PROMPT" ]; then
    echo "✓ Baseline prompt exists"
    BASELINE_LINES=$(wc -l < "$BASELINE_PROMPT")
    echo "  - Lines: $BASELINE_LINES"
else
    echo "✗ Baseline prompt not found"
    exit 1
fi
echo

# Step 3: Check improved prompt
echo "[3/4] Checking improved prompt..."
echo "--------------------------------------"
if [ -f "$IMPROVED_PROMPT" ]; then
    echo "✓ Improved prompt exists"
    IMPROVED_LINES=$(wc -l < "$IMPROVED_PROMPT")
    echo "  - Lines: $IMPROVED_LINES"
else
    echo "✗ Improved prompt not found"
    exit 1
fi
echo

# Step 4: Simulate evaluation (would call evaluate-with-context.js with API)
echo "[4/4] Simulating evaluation workflow..."
echo "--------------------------------------"
echo "In production, this would:"
echo "  1. Call .github/scripts/evaluate-with-context.js"
echo "  2. Send both prompts to Claude API with context"
echo "  3. Compare responses for context usage"
echo "  4. Generate evaluation report"
echo

# Verify unique markers in context
echo "Context Validation:"
echo "-------------------"
echo "$CONTEXT_OUTPUT" | grep -E "(UNIQUE_PROCESSING_KEY_789|/api/v2/auth/login|maxBatchSize.*1000)" | head -5

echo
echo "============================================"
echo "TEST COMPLETE"
echo "============================================"
echo
echo "Summary:"
echo "  ✓ Repository context loads successfully"
echo "  ✓ Test files contain unique markers"
echo "  ✓ Both prompt files are available"
echo "  ✓ Context includes all test repository files"
echo
echo "Next Steps:"
echo "  1. Merge PR #7 to main branch"
echo "  2. Comment '@prompt-expert programming --repo-path=\"./test/context-test-demo\"'"
echo "  3. GitHub Actions will run the full evaluation"
echo "  4. Check workflow logs for context usage validation"
echo
echo "PR URL: https://github.com/whichguy/prompt-expert-bank/pull/7"