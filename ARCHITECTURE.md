# Prompt Expert Bank Architecture

## 📁 Directory Structure

```
prompt-expert-bank/
├── .github/
│   └── workflows/
│       └── evaluate-prompts.yml    # Main reusable workflow for prompt evaluation
│
├── expert-definitions/             # Expert system prompts (Markdown)
│   └── [domain]-expert.md         # Domain-specific expert definitions
│
├── test-scenarios/                 # Test cases for evaluation (JSON)
│   └── [domain]-tests.json        # Domain-specific test scenarios
│
├── lib/                           # Core implementation (new architecture)
│   ├── base-expert.js            # Base class with shared evaluation logic
│   ├── expert-loader.js          # Dynamic expert loading system
│   ├── legacy-expert-adapter.js  # Adapter for old expert compatibility
│   └── [domain]-expert.js        # Domain-specific implementations
│
├── experts/                       # Legacy expert implementations
│   ├── [domain]-expert.js        # Old-style experts (being phased out)
│   └── index.js                  # Backward compatibility wrapper
│
├── examples/                      # Example implementations
│   ├── sample-security-prompt-v1.md # "Before" prompt example
│   ├── sample-security-prompt-v2.md # "After" prompt example
│   └── workflow-template.yml     # Template workflow for repositories
│
├── ARCHITECTURE.md               # This file
├── README.md                     # Main documentation
├── README_NEW_ARCHITECTURE.md    # New architecture guide
├── package.json                  # Node.js dependencies
└── setup-ab-testing.sh          # Quick setup script
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
- Loads the appropriate expert module (new or legacy)
- Falls back to general expert if no specific domain matches

### 3. Evaluation Process
- Expert loads test scenarios from JSON files
- Both old and new prompts are tested against scenarios
- Results are scored based on domain-specific metrics
- Comprehensive report is generated with A/B comparison

### 4. PR Feedback
- Detailed evaluation report posted as PR comment
- Includes metrics, comparisons, and recommendations
- Binary decision: APPROVE or REQUEST_CHANGES
- Optional auto-close for failed evaluations

## 🏗️ New Architecture

### Base Expert Class
All experts extend `BaseExpert` which provides:
- Test execution framework
- Report generation
- Metric calculation framework
- A/B comparison logic

### Expert Definitions (Markdown)
```markdown
---
name: Expert Name
domain: domain-key
description: What this expert evaluates
---

# Expert System Prompt

You are an expert in...
```

### Test Scenarios (JSON)
```json
{
  "scenarios": [
    {
      "name": "Test name",
      "input": "Test input",
      "expected": {
        "type": "expected-behavior",
        "customField": "value"
      }
    }
  ]
}
```

### Domain Expert Implementation
```javascript
class DomainExpert extends BaseExpert {
  constructor() {
    super(definitionPath, scenariosPath);
  }
  
  checkIfPassed(evaluation, expected) {
    // Domain-specific pass/fail logic
  }
  
  calculateMetrics(testResults) {
    // Domain-specific metrics
  }
}
```

## 🎯 Design Principles

1. **Separation of Concerns**: Expert prompts, test data, and logic are separate
2. **Result-Focused**: Evaluates outputs, not prompt structure
3. **Reusable Components**: Base class provides shared functionality
4. **Backward Compatible**: Supports both old and new expert formats
5. **Data-Driven Tests**: Test scenarios are JSON, easy to modify
6. **Binary Decisions**: Only APPROVE or REQUEST_CHANGES (no neutral)

## 🔧 Adding New Experts

### New Architecture (Recommended)
1. Create expert definition: `expert-definitions/[domain]-expert.md`
2. Create test scenarios: `test-scenarios/[domain]-tests.json`
3. Create implementation: `lib/[domain]-expert.js` (extends BaseExpert)
4. Expert is automatically detected and loaded

### Legacy Architecture (Still Supported)
1. Create expert: `experts/[domain]-expert.js`
2. Include test scenarios in the JavaScript file
3. Implement evaluatePrompts method

## 📊 Current Experts

| Expert | Status | Architecture | Test Scenarios |
|--------|--------|--------------|----------------|
| Security | ✅ Implemented | New | 10 scenarios |
| Programming | ✅ Implemented | Legacy | 15 scenarios |
| Financial | ✅ Implemented | Legacy | 10 scenarios |
| Data Analysis | ✅ Implemented | Legacy | 10 scenarios |
| General Purpose | ✅ Implemented | Legacy | 12 scenarios |

## 🔄 Migration Plan

1. **Phase 1**: Support both architectures (✅ Complete)
2. **Phase 2**: Convert all experts to new architecture (In Progress)
3. **Phase 3**: Deprecate legacy architecture
4. **Phase 4**: Remove legacy code

## 🚀 Future Enhancements

1. Convert remaining experts to new architecture
2. Add more domain-specific experts
3. Create expert validation framework
4. Build expert performance metrics dashboard
5. Support for multi-modal prompts (images, etc.)
6. Integration with more LLM providers