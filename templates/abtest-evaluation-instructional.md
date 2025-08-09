# A/B Test Evaluation

## Test Information
- **Expert**: {{EXPERT_NAME}}
- **Date**: {{TIMESTAMP}}

## Performance Metrics
- **Baseline Response**: {{BASELINE_LATENCY}}ms | {{BASELINE_TOKENS}} tokens ({{BASELINE_INPUT_TOKENS}} in, {{BASELINE_OUTPUT_TOKENS}} out)
- **Variant Response**: {{VARIANT_LATENCY}}ms | {{VARIANT_TOKENS}} tokens ({{VARIANT_INPUT_TOKENS}} in, {{VARIANT_OUTPUT_TOKENS}} out)

{{#if CONTEXT_FILES}}
## Context Provided
**{{CONTEXT_FILE_COUNT}} files loaded** ({{CONTEXT_SIZE}} bytes total)
{{#each CONTEXT_FILES}}
- {{this.name}} ({{this.size}} bytes, {{this.type}})
{{/each}}

Based on this context, evaluate how well each response addresses the specific codebase.
{{/if}}

## Response Comparison

### Baseline Response (A)
```
{{BASELINE_CONTENT}}
```

### Variant Response (B)
```
{{VARIANT_CONTENT}}
```

## Your Evaluation Task

Rate each response on these 4 dimensions (1-10 scale):

**Baseline Scores:**
- Clarity: ___/10
- Technical Accuracy: ___/10  
- Practical Use: ___/10
- User Experience: ___/10

**Variant Scores:**
- Clarity: ___/10
- Technical Accuracy: ___/10
- Practical Use: ___/10
- User Experience: ___/10

## Decision

**Winner:** [Baseline/Variant]
**Confidence:** [High/Medium/Low] 
**Main Reason:** [Why did this version win?]

{{#if CONTEXT_FILES}}
**Context Impact:** [How did the {{CONTEXT_FILE_COUNT}} repository files influence your decision?]
{{/if}}