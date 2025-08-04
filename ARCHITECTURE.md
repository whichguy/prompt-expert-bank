# Prompt Expert Bank Architecture

## 📁 Directory Structure

```
prompt-expert-bank/
├── .github/
│   └── workflows/
│       ├── evaluate-prompts.yml    # Main reusable workflow for prompt evaluation
│       └── validate-experts.yml    # Validates JavaScript expert modules (CI/CD)
│
├── experts/                        # Expert evaluation logic
│   └── security-expert.js         # Security domain expert
│
├── test-scenarios/                 # Test cases for each expert
│   ├── security-tests.js          # Test scenarios for security expert
│   └── test-scenario-template.js  # Template for new test scenarios
│
├── examples/                       # Example implementations
│   ├── sample-security-prompt-v1.md # "Before" prompt example
│   ├── sample-security-prompt-v2.md # "After" prompt example
│   └── workflow-template.yml      # Template workflow for repositories
│
├── expert-templates/               # Templates for new experts
│   └── expert-template.js         # JavaScript expert creation template
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

1. Copy `expert-templates/expert-template.js` to `experts/[domain]-expert.js`
2. Create test scenarios in `test-scenarios/[domain]-tests.js`
3. Define evaluation metrics and scoring logic in the expert
4. Ensure domain detection keywords are documented
5. The expert will automatically load its test scenarios

## 📊 Current Experts

| Expert | Status | Test Scenarios |
|--------|--------|----------------|
| Security | ✅ Implemented | 8 scenarios |
| Programming & Code Review | ✅ Implemented | 15 scenarios |
| Financial | ✅ Implemented | 10 scenarios |
| Data Analysis | ✅ Implemented | 10 scenarios |
| General Purpose | ✅ Implemented | 12 scenarios |

## 🚀 Future Enhancements

1. Convert remaining markdown experts to JavaScript
2. Add more domain-specific experts
3. Create expert validation tests
4. Build expert performance metrics dashboard