# A/B Test Evaluation

## Evaluation Purpose

You are conducting a systematic A/B test evaluation to determine which of two prompt responses better achieves the intended outcome. This evaluation compares two versions:

- **Baseline (A)**: The current or control version
- **Variant (B)**: The proposed alternative version

Your role is to objectively assess both responses across multiple dimensions and select the superior version based on evidence. Consider both content quality and performance efficiency in your decision.

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

## Technical Performance Considerations

Use the performance metrics as tie-breakers in these scenarios:

1. **Close Evaluation (≤1 point difference)**: When content quality scores are very close, favor the response with **faster response time** and **fewer tokens** as it provides similar value more efficiently.

2. **Notable Performance Advantage**: If one response has **15%+ faster response time** OR **10%+ fewer tokens** while maintaining comparable content quality, consider this as a notable advantage worth mentioning in your decision.

## Decision

**Winner:** [Baseline/Variant]
**Confidence:** [High/Medium/Low] 
**Main Reason:** [Why did this version win?]

{{#if CONTEXT_FILES}}
**Context Impact:** [How did the {{CONTEXT_FILE_COUNT}} repository files influence your decision?]
{{/if}}