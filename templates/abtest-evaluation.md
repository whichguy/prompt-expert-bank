# A/B Test Evaluation Template

## Test Configuration
- **Expert**: {{EXPERT_NAME}}
- **Test Type**: {{TEST_TYPE}}
- **Timestamp**: {{TIMESTAMP}}

## Evaluation

### Baseline (Version A)
{{BASELINE_CONTENT}}

### Variant (Version B)
{{VARIANT_CONTENT}}

## Context
{{#if CONTEXT_FILES}}
Files loaded for context:
{{#each CONTEXT_FILES}}
- {{this.name}} ({{this.type}})
{{/each}}
{{else}}
No additional context provided
{{/if}}

## Decision Criteria
1. Clarity and precision
2. Technical accuracy
3. Practical applicability
4. User experience

## Verdict
**Winner**: {{WINNER}}
**Confidence**: {{CONFIDENCE}}
**Rationale**: {{RATIONALE}}