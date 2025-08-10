# Templates Directory

This directory contains templates used by the Prompt Expert GitHub Actions workflow for A/B testing and prompt evaluation.

## Active Templates

### 1. `abtest-evaluation.md`
**Purpose**: Main template for comprehensive A/B test evaluation
**Used by**: `scripts/abtest.js`, GitHub Actions workflow
**Features**:
- LLM-as-Judge methodology with bias mitigation
- Weighted scoring system
- Domain-specific criteria evaluation
- Performance metrics comparison
- PIE framework for impact assessment

### 2. `abtest-prompt.md`
**Purpose**: Template for generating A/B test prompts
**Used by**: `scripts/abtest.js`
**Features**:
- Structured prompt generation
- Variable substitution support
- Context integration

### 3. `expert-comparison.md`
**Purpose**: Compare multiple expert definitions
**Used by**: `scripts/template-helper.js`
**Features**:
- Side-by-side expert comparison
- Capability assessment
- Domain coverage analysis

### 4. `thread-evaluation.md`
**Purpose**: Evaluate conversation threads and multi-turn interactions
**Used by**: Thread analysis workflows
**Features**:
- Conversation flow analysis
- Context retention evaluation
- Response consistency checking

## Template Variables

Templates use Handlebars-style variables for dynamic content:

- `{{EXPERT_DEFINITION}}` - Expert role and capabilities
- `{{BASELINE_PROMPT}}` - Baseline prompt for comparison
- `{{VARIANT_PROMPT}}` - Variant/improved prompt
- `{{TEST_SCENARIO}}` - Test case or scenario
- `{{BASELINE_RESPONSE}}` - Response from baseline
- `{{VARIANT_RESPONSE}}` - Response from variant
- `{{BASELINE_LATENCY}}` - Performance metric
- `{{VARIANT_LATENCY}}` - Performance metric

## Usage Example

```javascript
const { loadTemplate } = require('./scripts/template-helper');

const evaluationTemplate = loadTemplate('abtest-evaluation');
const filled = evaluationTemplate.replace('{{EXPERT_DEFINITION}}', expertDef);
```

## Workflow Integration

The GitHub Actions workflow (`prompt-expert.yml`) uses these templates when:
1. Evaluating prompt changes in PRs
2. Running A/B tests on prompt improvements
3. Comparing expert definitions
4. Analyzing conversation quality

## Adding New Templates

1. Create a new `.md` file in this directory
2. Use Handlebars notation for variables: `{{VARIABLE_NAME}}`
3. Update this README with the template's purpose
4. Add template loading in relevant scripts

## Template Best Practices

- Keep templates focused on a single evaluation type
- Use clear, descriptive variable names
- Include bias mitigation instructions for LLM judges
- Provide scoring rubrics where applicable
- Document expected inputs and outputs