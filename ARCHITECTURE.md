# Prompt Expert Bank Architecture

## 📁 Directory Structure

```
prompt-expert-bank/
├── .github/
│   └── workflows/
│       ├── evaluate-prompts.yml    # Main reusable workflow for prompt evaluation
│       └── validate-experts.yml    # Validates JavaScript expert modules (CI/CD)
│
├── experts/                        # JavaScript expert implementations (THE MAIN DIRECTORY)
│   └── security-expert.js         # Security domain expert with embedded test scenarios
│
├── reference/                      # Reference materials (not used by system)
│   ├── prompt-experts/            # Original markdown expert definitions
│   │   ├── data_analysis_expert.md
│   │   ├── financial_analysis_expert.md
│   │   ├── gas_javascript_expert.md
│   │   └── general_purpose_expert.md
│   └── test-scenarios/            # Original JSON test scenarios
│       ├── financial_scenarios.json
│       └── gas_scenarios.json
│
├── examples/                       # Example implementations
│   ├── sample-security-prompt-v1.md # "Before" prompt example
│   └── sample-security-prompt-v2.md # "After" prompt example
│
├── expert-templates/               # Templates for new experts
│   └── expert_template.md         # Expert creation template
│
├── ARCHITECTURE.md                # This file
├── README.md                      # Main documentation
├── package.json                   # Node.js dependencies
└── setup-ab-testing.sh           # Quick setup script
```

## 🔄 How It Works

### 1. GitHub Action Trigger
When a PR is created/updated with prompt changes:
- The consuming repository's workflow calls `evaluate-prompts.yml`
- Passes PR number, repository name, and API keys

### 2. Expert Selection
The workflow:
- Fetches changed files from the PR
- Analyzes file content for domain keywords
- Loads the appropriate expert module

### 3. Evaluation Process
- Expert module defines test scenarios
- Both old and new prompts are tested
- Results are scored based on weighted metrics
- Comprehensive report is generated

### 4. PR Feedback
- Detailed evaluation report posted as PR comment
- Includes metrics, comparisons, and recommendations
- Provides actionable feedback for improvements

## 🎯 Design Principles

1. **Modular Experts**: Each domain has its own expert module
2. **Result-Focused**: Evaluates outputs, not prompt structure
3. **Reusable Workflow**: Single workflow used by all repositories
4. **Inline Execution**: Avoids complex module loading in Actions
5. **Comprehensive Reporting**: Detailed metrics and examples

## 🔧 Adding New Experts

1. Create new expert in `experts/` directory (JavaScript)
2. Include test scenarios within the expert module
3. Define evaluation metrics and scoring logic
4. Ensure domain detection keywords are documented

## 📊 Current Experts

| Expert | Implementation | Status |
|--------|---------------|--------|
| Security | ✅ JavaScript | Active |
| Financial | 📄 Markdown only | Needs JS implementation |
| Data Analysis | 📄 Markdown only | Needs JS implementation |
| GAS/JavaScript | 📄 Markdown only | Needs JS implementation |
| General Purpose | 📄 Markdown only | Needs JS implementation |

## 🚀 Future Enhancements

1. Convert remaining markdown experts to JavaScript
2. Add more domain-specific experts
3. Create expert validation tests
4. Build expert performance metrics dashboard