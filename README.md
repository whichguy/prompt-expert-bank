# Prompt Expert Bank 🏦

Central repository of domain experts for evaluating LLM prompt outputs using result-focused A/B testing.

## 🎯 Philosophy

**Evaluate outputs, not prompts.** Our experts assess what prompts produce, not how they're written.

## 🚀 Quick Start

### Enable A/B Testing in Your Repository (2 minutes)

```bash
# In your repository:
curl -O https://raw.githubusercontent.com/whichguy/prompt-expert-bank/main/setup-ab-testing.sh
chmod +x setup-ab-testing.sh
./setup-ab-testing.sh

# Add your API key:
gh secret set ANTHROPIC_API_KEY
```

That's it! Now when you create a PR with prompt changes, the system will automatically:
- 🔍 Detect which prompts changed
- 🧠 Load the appropriate expert
- 🧪 Run A/B tests comparing outputs
- 📊 Post results to your PR

## 📊 Available Experts

| Expert | Domain | Key Competencies |
|--------|--------|------------------|
| [`financial_analysis_expert`](prompt-experts/financial_analysis_expert.md) | Financial advice, budgeting, investments | Mathematical accuracy (30%), Risk assessment (25%), Practical applicability (25%), Professional standards (20%) |
| [`gas_javascript_expert`](prompt-experts/gas_javascript_expert.md) | Google Apps Script, automation | GAS compatibility (35%), Code quality (25%), Performance (25%), Integration (15%) |
| [`data_analysis_expert`](prompt-experts/data_analysis_expert.md) | Data processing, analytics | Statistical accuracy (30%), Visualization (25%), Insights (25%), Technical implementation (20%) |
| [`general_purpose_expert`](prompt-experts/general_purpose_expert.md) | General technical content | Accuracy (30%), Completeness (25%), Clarity (25%), Efficiency (20%) |

## 📈 How It Works

1. **You make a prompt change** in your repository
2. **Create a pull request** 
3. **GitHub Action triggers** and loads the expert
4. **Expert evaluates outputs** (not prompt structure)
5. **Results posted to PR** with specific feedback

### Example PR Comment

```
## 🧪 A/B Test Results

**Recommendation:** ✅ APPROVE
**Confidence:** 92%

This prompt change improves output quality by 58%.

Key Improvements:
- Mathematical accuracy: 15% → 95% (now includes compound interest calculations)
- Risk assessment: 40% → 85% (added appropriate disclaimers)
- Actionable advice: "save more" → "transfer $650/month to 4.5% APY savings"

[View Full Report]
```

## 🔧 Configuration

Your repository's `.claude-ab-tests/config.yml`:

```yaml
version: "1.0"

expert_bank:
  repository: "whichguy/prompt-expert-bank"
  
expert_mapping:
  - pattern: "**/*financial*|**/*budget*"
    expert: "financial_analysis_expert"
    
  - pattern: "**/*gas*|**/*apps-script*"
    expert: "gas_javascript_expert"
    
  - pattern: "**"
    expert: "general_purpose_expert"
```

## ➕ Adding New Experts

1. Use the [expert template](expert-templates/expert_template.md)
2. Create a new file in `prompt-experts/`
3. Ensure competency weights total 100%
4. Include specific good/bad examples
5. Submit a PR

## 📊 Test Scenarios

Each expert has associated test scenarios in `test-scenarios/`:
- [`financial_scenarios.json`](test-scenarios/financial_scenarios.json) - Emergency funds, investments, budgets
- [`gas_scenarios.json`](test-scenarios/gas_scenarios.json) - Batch processing, error handling, triggers

## 🤝 Contributing

We welcome new experts! Please:
1. Fork this repository
2. Create your expert following the template
3. Add relevant test scenarios
4. Submit a pull request

## 📝 License

MIT License - Use freely in your projects!

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/whichguy/prompt-expert-bank/issues)
- **Discussions**: [GitHub Discussions](https://github.com/whichguy/prompt-expert-bank/discussions)

---

*Remember: Better outputs, not better prompts. Focus on what matters - the results!*
