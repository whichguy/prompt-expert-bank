# A/B Test Evaluation

## Purpose

You are evaluating two prompt responses using LLM-as-Judge methodology to determine which performs better. Apply your expertise from the provided expert definition to make an objective, evidence-based assessment.

**Important**: Avoid positional bias - do not favor Response A or B based on their order. Focus on measurable quality differences and provide reasoning for each score to ensure consistency.

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

### Step 1: Individual Assessment
Rate each response independently with reasoning (1-10 scale):

**Baseline (A):**
- Clarity: ___/10 - [Why this score?]
- Technical Accuracy: ___/10 - [Why this score?]
- Practical Use: ___/10 - [Why this score?]
- User Experience: ___/10 - [Why this score?]

**Variant (B):**
- Clarity: ___/10 - [Why this score?]
- Technical Accuracy: ___/10 - [Why this score?]
- Practical Use: ___/10 - [Why this score?]
- User Experience: ___/10 - [Why this score?]

### Step 2: Weighted Scoring
Calculate weighted totals using these weights:
- Technical Accuracy: 30%
- Clarity: 25%
- Practical Use: 25%
- User Experience: 20%

**Baseline Total**: ___/10
**Variant Total**: ___/10

## Performance Considerations

If responses are close in quality (≤1 point difference), favor the one with better performance metrics:
- 15%+ faster response time OR 10%+ fewer tokens = notable advantage

## Decision Framework

### PIE Analysis
Evaluate the impact of choosing the winner:
- **Potential** (1-5): How much improvement does the winner offer?
- **Importance** (1-5): How critical is this improvement for users?
- **Ease** (1-5): How simple is it to implement the winner?

### Final Decision

**Winner:** [Baseline/Variant]
**Confidence:** [High/Medium/Low] 
**Score Difference:** ___/10 points

**Primary Factors:** [What drove this decision? Consider quality scores, performance metrics, and PIE analysis]

**Trade-offs:** [What advantages does the losing version have?]

{{#if CONTEXT_FILES}}

**Context Impact:** [How did the repository files influence your decision?]

{{/if}}

---
*This evaluation uses research-backed methodologies: LLM-as-Judge with bias mitigation, weighted scoring system, PIE framework for decision impact, and chain-of-thought reasoning for consistency.*