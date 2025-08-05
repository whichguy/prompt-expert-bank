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
| Programming & Code Review | `code`, `programming`, `javascript`, `python`, `java`, `api`, `function`, `algorithm`, `debug` | ✅ Ready |
| Data Analysis | `data`, `analysis`, `analytics`, `visualization` | ✅ Ready |
| Financial | `financial`, `finance`, `budget`, `investment` | ✅ Ready |
| General Purpose | All other prompts (fallback expert) | ✅ Ready |

## 🏗️ Architecture

The Prompt Expert Bank uses a modular architecture:

```
prompt-expert-bank/
├── expert-definitions/    # Markdown files with expert system prompts
├── test-scenarios/       # JSON files with test cases
├── lib/                  # Core implementation
│   ├── base-expert.js   # Base class for all experts
│   └── [domain]-expert.js # Domain-specific implementations
└── experts/              # Legacy experts (being phased out)
```

## 🤝 Contributing

To add a new expert:

1. Create an expert definition: `expert-definitions/[domain]-expert.md`
2. Create test scenarios: `test-scenarios/[domain]-tests.json`
3. Create expert implementation: `lib/[domain]-expert.js` (extends BaseExpert)
4. Submit a PR

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed information.

## 📝 License

MIT License

## 🆘 Support

- [Issues](https://github.com/whichguy/prompt-expert-bank/issues)
- [Example Implementation](https://github.com/whichguy/security-prompt-test)

---

*Better outputs, not better prompts.*