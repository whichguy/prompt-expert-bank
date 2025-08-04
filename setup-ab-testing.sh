#!/bin/bash
# Setup script to enable A/B testing in any repository

echo "🚀 Setting up Result-Focused A/B Testing in your repository..."

# Create necessary directories
echo "📁 Creating directory structure..."
mkdir -p .github/workflows
mkdir -p .claude-ab-tests/test-results
mkdir -p .claude-ab-tests/local-experts

# Create the A/B testing workflow
echo "📝 Creating GitHub workflow..."
cat > .github/workflows/prompt-ab-testing.yml << 'EOF'
name: Prompt A/B Testing

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - '**/*.md'
      - '**/*prompt*'
      - '.claude-ab-tests/**'

permissions:
  contents: read
  pull-requests: write
  statuses: write

jobs:
  ab-test:
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Clone Expert Bank
        run: |
          git clone https://github.com/whichguy/prompt-expert-bank.git /tmp/expert-bank
      
      - name: Run A/B Test with Claude
        id: test
        uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          model: claude-3-5-sonnet-20241022
          max_turns: 3
          timeout_minutes: 10
          allowed_tools: ['str_replace_editor']
          prompt: |
            You are conducting a Result-Focused Prompt A/B Test.
            
            ## Your Mission:
            1. Identify changed prompt files using git diff
            2. Load appropriate expert from /tmp/expert-bank/prompt-experts/
            3. Run OLD vs NEW prompts through test scenarios
            4. Evaluate OUTPUTS using expert framework
            5. Write results to .claude-ab-tests/test-results/report.md
            
            ## Process:
            
            1. First, identify what changed:
               git diff origin/${{ github.base_ref }}...HEAD --name-only | grep -E '\.(md|prompt|txt)$'
            
            2. Based on file content, select expert:
               - Financial terms → financial_analysis_expert.md
               - GAS/Script terms → gas_javascript_expert.md
               - Data/Analysis → data_analysis_expert.md
               - Default → general_purpose_expert.md
            
            3. Create 3-5 test scenarios relevant to the domain
            
            4. Run both OLD and NEW prompts through scenarios
            
            5. Score outputs using expert's weighted competencies
            
            6. Generate report with:
               - Overall recommendation (APPROVE/REJECT/NEEDS_REVISION)
               - Competency scores with specific examples
               - Key improvements and issues
               - Actionable feedback
            
            Focus on OUTPUT QUALITY, not prompt structure!
      
      - name: Post Results to PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const reportPath = '.claude-ab-tests/test-results/report.md';
            
            if (fs.existsSync(reportPath)) {
              const report = fs.readFileSync(reportPath, 'utf8');
              
              // Extract key info
              const rec = report.match(/Recommendation:\s*\*?\*?([^*\n]+)/)?.[1]?.trim() || 'UNKNOWN';
              const confidence = report.match(/Confidence:\s*([^\n]+)/)?.[1] || 'N/A';
              
              // Create concise comment
              let comment = `## 🧪 A/B Test Results\n\n`;
              comment += `**Recommendation:** ${rec}\n`;
              comment += `**Confidence:** ${confidence}\n\n`;
              
              if (rec.includes('APPROVE')) {
                comment += `✅ This prompt change improves output quality and is ready to merge.\n\n`;
              } else if (rec.includes('REJECT')) {
                comment += `❌ This prompt change reduces output quality and should not be merged.\n\n`;
              } else {
                comment += `⚠️ This prompt change needs revision before merging.\n\n`;
              }
              
              // Add summary
              const summary = report.match(/## Summary\n([^#]+)/)?.[1]?.trim() || 
                             report.substring(0, 500) + '...';
              comment += summary + '\n\n';
              
              comment += `[📄 View Full Report](https://github.com/${{ github.repository }}/pull/${{ github.event.pull_request.number }}/files)\n`;
              
              await github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.name,
                body: comment
              });
              
              // Set status check
              const state = rec.includes('APPROVE') ? 'success' : 
                           rec.includes('REJECT') ? 'failure' : 'pending';
              
              await github.rest.repos.createCommitStatus({
                owner: context.repo.owner,
                repo: context.repo.name,
                sha: context.sha,
                state: state,
                description: `Prompt Quality: ${rec}`,
                context: 'prompt-ab-test'
              });
            }
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ab-test-results
          path: .claude-ab-tests/test-results/
EOF

# Create configuration file
echo "⚙️ Creating configuration..."
cat > .claude-ab-tests/config.yml << 'EOF'
version: "1.0"

# Expert bank configuration
expert_bank:
  repository: "whichguy/prompt-expert-bank"
  
  # Map file patterns to experts
  expert_mapping:
    - pattern: "**/*financial*|**/*budget*|**/*money*|**/*invest*"
      expert: "financial_analysis_expert"
      
    - pattern: "**/*gas*|**/*script*|**/*sheets*|**/*apps*"
      expert: "gas_javascript_expert"
      
    - pattern: "**/*data*|**/*analysis*|**/*analytics*"
      expert: "data_analysis_expert"
      
    - pattern: "**"
      expert: "general_purpose_expert"

# Test configuration
test_settings:
  scenarios_per_prompt: 3
  max_test_time: 300  # seconds
  
# Evaluation settings
evaluation:
  min_improvement_for_approval: 10  # percentage
  confidence_threshold: 70  # percentage

# Local expert overrides (optional)
local_experts:
  enabled: true
  directory: ".claude-ab-tests/local-experts"
EOF

# Create sample local expert
echo "👤 Creating sample local expert..."
cat > .claude-ab-tests/local-experts/sample_local_expert.md << 'EOF'
# Sample Local Expert

This is a template for creating repository-specific experts.

## Your Role in A/B Testing

**Focus on RESULTS, not process.** Evaluate domain-specific output quality.

## Evaluation Framework

### Core Competencies (Weighted - Total 100%):

**Domain-Specific Quality (40%)**
- [Your criteria here]

**Practical Applicability (30%)**
- [Your criteria here]

**Technical Accuracy (30%)**
- [Your criteria here]

## Good vs Bad Examples

### ✅ GOOD Output:
- [Example]

### ❌ BAD Output:
- [Example]
EOF

# Update .gitignore
echo "📝 Updating .gitignore..."
if ! grep -q ".claude-ab-tests/test-results" .gitignore 2>/dev/null; then
  echo -e "\n# A/B Test Results\n.claude-ab-tests/test-results/" >> .gitignore
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your ANTHROPIC_API_KEY to repository secrets:"
echo "   gh secret set ANTHROPIC_API_KEY"
echo ""
echo "2. Customize expert mappings in .claude-ab-tests/config.yml if needed"
echo ""
echo "3. Create a PR with prompt changes to see it in action!"
echo ""
echo "The system will automatically:"
echo "- Detect prompt changes in PRs"
echo "- Load the appropriate expert from the expert bank"
echo "- Run A/B tests comparing outputs"
echo "- Post results directly to your PR"
