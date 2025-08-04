# Prompt Expert Bank 🏦

Automated LLM prompt evaluation using domain experts. Get detailed A/B testing feedback on every pull request.

## 🚀 Quick Start (2 minutes)

```bash
# 1. Create workflow file
mkdir -p .github/workflows
curl -o .github/workflows/prompt-evaluation.yml \
  https://raw.githubusercontent.com/whichguy/prompt-expert-bank/main/examples/workflow-template.yml

# 2. Set API key
gh secret set ANTHROPIC_API_KEY

# 3. Create a PR with prompt changes to see it in action!
```

## 📋 How It Works

1. **You**: Create a PR with prompt changes
2. **Expert Bank**: Detects domain, runs A/B tests
3. **You**: Get detailed evaluation report as PR comment
4. **Result**: Merge with confidence or iterate based on feedback

## 🎯 What You Get

Example evaluation on your PR:

```
🏦 Prompt Expert Bank - Evaluation Report

Security Command Analysis Expert
Timestamp: 2024-01-20T15:30:00Z

Previous Performance:        New Performance:
- Detection Rate: 33.3%     - Detection Rate: 100.0% ✅
- False Positives: 66.7%    - False Positives: 0.0% ✅
- Context Aware: 0.0%       - Context Aware: 100.0% ✅
- Overall Score: 15.8%      - Overall Score: 84.4% ✅

✅ APPROVE - Improvement: +68.6%
Ready to merge ✅
```

## 🛠️ Setup Options

### Basic Setup
Use the quick start above - it's all you need!

### Advanced Setup
For custom paths or multiple environments:

```yaml
name: Prompt Evaluation
on:
  pull_request:
    paths:
      - '**/*prompt*.md'
      - 'agents/**'      # Your custom paths
      
jobs:
  evaluate-prompts:
    uses: whichguy/prompt-expert-bank/.github/workflows/evaluate-prompts.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number }}
      repository: ${{ github.repository }}
    secrets:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## 📊 Available Experts

| Domain | Detection Keywords | Status |
|--------|-------------------|---------|
| Security | `security`, `risk`, `safety` | ✅ Ready |
| Node.js | `node`, `nodejs`, `javascript`, `code review` | ✅ Ready |
| Data Analysis | `data`, `analysis`, `analytics` | 🚧 Coming Soon |
| Financial | `financial`, `finance`, `budget` | 🚧 Coming Soon |

## 🤝 Contributing

To add a new expert:
1. Copy `expert-templates/expert-template.js` to `experts/[domain]-expert.js`
2. Implement test scenarios and evaluation logic
3. Submit a PR

## 📝 License

MIT License

## 🆘 Support

- [Issues](https://github.com/whichguy/prompt-expert-bank/issues)
- [Example Implementation](https://github.com/whichguy/security-prompt-test)

---

*Better outputs, not better prompts.*