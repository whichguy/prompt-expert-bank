# Prompt Expert Bank

Central repository of domain experts for evaluating LLM prompt outputs using result-focused A/B testing.

## 🎯 Philosophy

**Evaluate outputs, not prompts.** Our experts assess what prompts produce, not how they're written.

## 📊 Available Experts

| Expert | Domain | Key Competencies |
|--------|--------|------------------|
| `financial_analysis_expert` | Financial advice, budgeting, investments | Mathematical accuracy, risk assessment, regulatory compliance |
| `gas_javascript_expert` | Google Apps Script, automation | GAS compatibility, performance, API usage |
| `data_analysis_expert` | Data processing, analytics | Statistical accuracy, visualization, insights |
| `general_purpose_expert` | General technical content | Accuracy, completeness, clarity |

## 🚀 Usage in Your Repositories

### 1. Add to your repo's `.claude-ab-tests/config.yml`:

```yaml
version: "1.0"

expert_bank:
  repository: "whichguy/prompt-expert-bank"
  
  expert_mapping:
    - pattern: "**/*financial*|**/*budget*"
      expert: "financial_analysis_expert"
      
    - pattern: "**/*gas*|**/*apps-script*"
      expert: "gas_javascript_expert"
      
    - pattern: "**/*data*|**/*analysis*"
      expert: "data_analysis_expert"
      
    - pattern: "**"
      expert: "general_purpose_expert"
```

### 2. Your workflow will automatically:
- Detect changed prompts
- Load appropriate expert from this bank
- Run A/B tests with result-focused evaluation
- Provide specific, actionable feedback

## 📈 Success Metrics

Our experts evaluate based on:
1. **Quality** - Does output meet professional standards?
2. **Specificity** - Are recommendations actionable?
3. **Accuracy** - Are calculations/code correct?
4. **Completeness** - Are edge cases handled?

## 🔧 Adding New Experts

Use `expert-templates/expert_template.md` to create new domain experts. Each expert must define:
- Weighted evaluation competencies (must total 100%)
- Good vs bad output examples
- Specific scoring criteria

---

*Focus on results, not methodology. Better outputs, not better prompts.*
