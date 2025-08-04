# Prompt Expert Bank

Central bank of domain experts for LLM prompt evaluation and A/B testing.

## Overview

This repository contains specialized domain experts that evaluate and compare LLM prompts through systematic A/B testing. Each expert provides detailed analysis and recommendations for prompt improvements.

## Architecture

```
prompt-expert-bank/
├── experts/              # Domain expert definitions
├── evaluation/           # Evaluation frameworks and criteria
├── tests/               # Test scenarios and benchmarks
└── api/                 # API for external integrations
```

## How It Works

1. **Prompt Submission**: PRs in monitored repositories trigger evaluation
2. **A/B Testing**: Experts compare old vs new prompts using test scenarios
3. **Analysis**: Experts provide detailed metrics and recommendations
4. **Feedback**: Results are posted as PR comments with approval/rejection

## Integration

This system integrates with GitHub Actions to automatically evaluate prompt changes in pull requests.

## Expert Types

- **Security Expert**: Evaluates security-related prompts
- **Performance Expert**: Measures response time and efficiency
- **Accuracy Expert**: Tests correctness and edge cases
- **Clarity Expert**: Assesses prompt clarity and ambiguity

## API Usage

```javascript
const expertBank = require('prompt-expert-bank');

const results = await expertBank.evaluate({
  oldPrompt: "previous prompt text",
  newPrompt: "updated prompt text",
  domain: "security",
  testScenarios: ["scenario1", "scenario2"]
});
```