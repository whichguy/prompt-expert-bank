# Prompt Expert Bank

A comprehensive A/B testing framework for evaluating and improving AI prompts using GitHub Actions and Claude AI.

## 🚀 Quick Start

This repository provides automated prompt evaluation through GitHub comments. Simply mention `@prompt-expert` in a PR comment to trigger analysis.

## 📁 Repository Structure

```
prompt-expert-bank/
├── .github/workflows/
│   ├── claude-code.yml      # Anthropic's Claude Code workflow (@claude-code)
│   └── prompt-expert.yml    # Main prompt evaluation workflow (@prompt-expert)
├── experts/                 # Expert role definitions
│   ├── code-review-expert.md
│   └── programming-expert.md
├── prompts/                 # Prompt templates for testing
│   ├── code-reviewer-baseline.md
│   ├── code-reviewer-improved.md
│   └── code-reviewer.md
├── scripts/                 # Core functionality
│   ├── abtest.js           # A/B testing framework
│   ├── claude-code-session-simplified.js
│   ├── error-handler.js
│   ├── file-validator.js   # Validates file paths in comments
│   ├── github-helper.js
│   ├── prompt-loader.js
│   ├── repo-context-v2.js
│   └── template-helper.js
├── templates/               # Evaluation templates
│   ├── abtest-evaluation.md
│   ├── abtest-prompt.md
│   ├── expert-comparison.md
│   └── thread-evaluation.md
├── tests/                   # Test files and scenarios
│   ├── fixtures/           # Test data
│   ├── scenarios/          # Test cases (JSON)
│   └── scripts/            # Test runners
└── docs/                   # Documentation
    └── SETUP_CUSTOM_BOT.md # Bot customization guide
```

## 🎯 Features

### A/B Testing Framework
- **LLM-as-Judge methodology**: Unbiased evaluation using expert definitions
- **Weighted scoring system**: Technical accuracy, domain excellence, clarity, practical use
- **Performance metrics**: Response time and token usage comparison
- **Bias mitigation**: Built-in positional bias warnings and consistency checks

### GitHub Integration
- **PR Comment Triggers**: Mention `@prompt-expert` to run evaluations
- **File Validation**: Automatic detection and correction of invalid file paths
- **Sparse Checkout**: Efficient workflow with minimal file access

### Expert System
- **Role-based evaluation**: Define expert personas for domain-specific assessment
- **Customizable criteria**: Security, performance, code quality, maintainability
- **Red flag detection**: Automatic identification of critical issues

## 💬 Usage Examples

### Basic Prompt Evaluation
```markdown
@prompt-expert evaluate prompts/code-reviewer-improved.md against baseline
```

### A/B Test with Custom Expert
```markdown
@prompt-expert run A/B test using experts/code-review-expert.md
Compare:
- Baseline: prompts/code-reviewer-baseline.md
- Improved: prompts/code-reviewer-improved.md
```

### Inline Test Code
```markdown
@prompt-expert analyze this code:
```javascript
function processPayment(amount, cardNumber) {
  const query = "INSERT INTO payments VALUES ('" + amount + "', '" + cardNumber + "')";
  database.execute(query);
}
```

## 🔧 Configuration

### Environment Variables
Required secrets in repository settings:
- `ANTHROPIC_API_KEY`: Claude API access
- `GITHUB_TOKEN`: Automatically provided by Actions

### Workflow Customization
Edit `.github/workflows/prompt-expert.yml` to:
- Modify trigger conditions
- Adjust Claude model settings
- Change evaluation templates

## 📊 Test Results

The framework provides comprehensive metrics:
- **Detection rates**: Issues found by each prompt
- **Quality scores**: 0-100 scale evaluation
- **Performance comparison**: Latency and token usage
- **Confidence levels**: Statistical significance of results

Example output:
```
Winner: Prompt B (95% confidence)
- SQL Injection Detection: 9/10 vs 3/10
- Actionable Feedback: 9/10 vs 4/10
- Total Score: 88/100 vs 28/100
- Improvement: +214%
```

## 🛠️ Development

### Running Tests Locally
```bash
# Install dependencies
npm install

# Run A/B test
node tests/scripts/run-real-abtest.js

# Test with specific prompts
node tests/scripts/test-abtest.js
```

### Adding New Experts
1. Create expert definition in `experts/`
2. Define evaluation criteria and red flags
3. Test with `@prompt-expert` mention

### Creating Templates
1. Add template to `templates/`
2. Use `{{VARIABLE}}` syntax for substitution
3. Update `templates/README.md`

## 🤖 Bot Customization

See `docs/SETUP_CUSTOM_BOT.md` for instructions on:
- Creating custom bot identity
- Setting up dedicated GitHub account
- Configuring avatar and profile

## 📈 Metrics and Monitoring

Track evaluation performance:
- Success/failure rates in Actions tab
- Response times in workflow logs
- Token usage in API responses

## 🔒 Security

- No hardcoded credentials
- Secrets managed through GitHub
- Input validation on all file paths
- SQL injection detection in test scenarios

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit PR with `@prompt-expert` evaluation

## 📞 Support

- Issues: [GitHub Issues](https://github.com/whichguy/prompt-expert-bank/issues)
- Discussions: [GitHub Discussions](https://github.com/whichguy/prompt-expert-bank/discussions)

---

Built with ❤️ using Claude AI and GitHub Actions