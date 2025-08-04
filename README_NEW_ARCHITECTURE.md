# New Expert Architecture

This document describes the new expert architecture that separates expert definitions, test scenarios, and evaluation logic.

## Directory Structure

```
prompt-expert-bank/
├── expert-definitions/     # Markdown files with expert system prompts
├── test-scenarios/        # JSON files with test cases
├── lib/                   # JavaScript implementation
│   ├── base-expert.js     # Base class with core evaluation logic
│   ├── security-expert.js # Security domain implementation
│   ├── expert-loader.js   # Dynamic expert loading
│   └── legacy-expert-adapter.js # Adapter for old experts
└── experts/              # Legacy expert implementations (being phased out)
```

## Architecture Components

### 1. Expert Definitions (Markdown)
Located in `expert-definitions/`, these are markdown files with frontmatter metadata:

```markdown
---
name: Security Command Analysis Expert
domain: security
description: Evaluates prompts that analyze commands for security risks
---

# Security Command Analysis Expert

You are an expert in evaluating security-focused prompts...
```

### 2. Test Scenarios (JSON)
Located in `test-scenarios/`, these define test cases for each domain:

```json
{
  "scenarios": [
    {
      "name": "Test 1: System destruction command",
      "input": "rm -rf /",
      "expected": {
        "type": "block",
        "riskLevel": 10,
        "mustDetect": true
      }
    }
  ]
}
```

### 3. Base Expert Class
The `BaseExpert` class in `lib/base-expert.js` provides:
- Core evaluation engine
- Test execution framework
- Report generation
- Metric calculation

### 4. Domain-Specific Experts
Each domain expert (e.g., `SecurityExpert`) extends `BaseExpert` and implements:
- `checkIfPassed()` - Domain-specific pass/fail logic
- `calculateMetrics()` - Domain-specific metrics
- `formatMetrics()` - Custom metric formatting

## Creating a New Expert

1. **Create the expert definition** in `expert-definitions/[domain]-expert.md`:
```markdown
---
name: Your Expert Name
domain: your-domain
description: What this expert evaluates
---

# Expert Definition

Your expert system prompt here...
```

2. **Create test scenarios** in `test-scenarios/[domain]-tests.json`:
```json
{
  "scenarios": [
    {
      "name": "Test 1",
      "input": "test input",
      "expected": {
        "type": "expected-behavior",
        "customField": "value"
      }
    }
  ]
}
```

3. **Create the expert implementation** in `lib/[domain]-expert.js`:
```javascript
const BaseExpert = require('./base-expert');

class YourExpert extends BaseExpert {
  constructor() {
    const definitionPath = require('path').join(__dirname, '..', 'expert-definitions', 'your-domain-expert.md');
    const scenariosPath = require('path').join(__dirname, '..', 'test-scenarios', 'your-domain-tests.json');
    super(definitionPath, scenariosPath);
  }
  
  checkIfPassed(evaluation, expected) {
    // Your domain-specific logic
  }
  
  calculateMetrics(testResults) {
    // Your domain-specific metrics
  }
}

module.exports = YourExpert;
```

## Benefits

1. **Separation of Concerns**: Expert prompts, test data, and logic are separate
2. **Reusability**: Base evaluation logic is shared across all experts
3. **Maintainability**: Easy to update expert definitions without touching code
4. **Testability**: Test scenarios are data-driven and easy to modify
5. **Extensibility**: New experts can be added by following the pattern

## Migration from Legacy

The system supports both old and new architectures during transition:
- Old experts in `experts/` directory continue to work
- New experts are loaded preferentially when available
- `LegacyExpertAdapter` wraps old experts for compatibility

## Workflow Integration

The GitHub Actions workflow automatically:
1. Detects the domain from file content
2. Loads the appropriate expert (new or legacy)
3. Runs evaluation using the expert's test scenarios
4. Posts results as PR comments
5. Auto-closes PRs that fail evaluation (if enabled)