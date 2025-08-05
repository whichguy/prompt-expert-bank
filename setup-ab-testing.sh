#!/bin/bash
# Setup script to enable prompt evaluation in any repository

echo "🚀 Setting up Prompt Expert evaluation in your repository..."

# Create necessary directories
echo "📁 Creating directory structure..."
mkdir -p .github/workflows

# Create the evaluation workflow
echo "📝 Creating GitHub workflow..."
cat > .github/workflows/prompt-evaluation.yml << 'EOF'
name: Prompt Evaluation

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - '**/*prompt*.md'
      - '**/*prompt*.txt'
      - 'prompts/**'

jobs:
  evaluate-prompts:
    uses: whichguy/prompt-expert/.github/workflows/evaluate-prompts.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number }}
      repository: ${{ github.repository }}
    secrets:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
EOF

# Update .gitignore
echo "📝 Updating .gitignore..."
if ! grep -q "node_modules" .gitignore 2>/dev/null; then
  echo -e "\n# Dependencies\nnode_modules/" >> .gitignore
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
