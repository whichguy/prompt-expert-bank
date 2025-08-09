# A/B Test Evaluation

## Purpose

You are evaluating two prompt responses to determine which performs better. Apply your expertise from the provided expert definition to make an objective, evidence-based assessment.

## Test Information
- **Expert**: {{EXPERT_NAME}}
- **Date**: {{TIMESTAMP}}

## Performance Metrics
- **Baseline Response**: {{BASELINE_LATENCY}}ms | {{BASELINE_TOKENS}} tokens ({{BASELINE_INPUT_TOKENS}} in, {{BASELINE_OUTPUT_TOKENS}} out)
- **Variant Response**: {{VARIANT_LATENCY}}ms | {{VARIANT_TOKENS}} tokens ({{VARIANT_INPUT_TOKENS}} in, {{VARIANT_OUTPUT_TOKENS}} out)

{{#if CONTEXT_FILES}}
## Context
{{CONTEXT_FILE_COUNT}} repository files provided ({{CONTEXT_SIZE}} bytes total) - consider how well each response addresses the specific codebase.
{{/if}}

## Responses

### Baseline (A)
<baseline>
{{BASELINE_CONTENT}}
</baseline>

### Variant (B)
<variant>
{{VARIANT_CONTENT}}
</variant>

## Evaluation

Rate each response (1-10 scale):

**Baseline:**
- Clarity: ___/10
- Technical Accuracy: ___/10  
- Practical Use: ___/10
- User Experience: ___/10

**Variant:**
- Clarity: ___/10
- Technical Accuracy: ___/10
- Practical Use: ___/10
- User Experience: ___/10

## Performance Considerations

If responses are close in quality (≤1 point difference), favor the one with better performance metrics:
- 15%+ faster response time OR 10%+ fewer tokens = notable advantage

## Decision

**Winner:** [Baseline/Variant]
**Confidence:** [High/Medium/Low]
**Reason:** [Why did this version win?]

{{#if CONTEXT_FILES}}
**Context Impact:** [How did the repository files influence your decision?]
{{/if}}