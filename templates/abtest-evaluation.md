# A/B Test Evaluation

## Purpose

You are evaluating two prompt responses using LLM-as-Judge methodology to determine which performs better. Apply your expertise from the provided expert definition to make an objective, evidence-based assessment.

**Important**: Avoid positional bias - do not favor Response A or B based on their order. Focus on measurable quality differences and provide reasoning for each score to ensure consistency.

## Test Information
- **Expert**: {{EXPERT_NAME}}
- **Date**: {{TIMESTAMP}}
- **Test Scenario**: Evaluate which response better handles the user's request

## Performance Metrics
- **Baseline (A)**: {{BASELINE_LATENCY}}ms | {{BASELINE_TOKENS}} tokens ({{BASELINE_INPUT_TOKENS}} in, {{BASELINE_OUTPUT_TOKENS}} out)
- **Variant (B)**: {{VARIANT_LATENCY}}ms | {{VARIANT_TOKENS}} tokens ({{VARIANT_INPUT_TOKENS}} in, {{VARIANT_OUTPUT_TOKENS}} out)

**Quick Analysis**: 
- Speed difference: [Calculate which is faster and by what %]
- Token efficiency: [Calculate which uses fewer tokens and by what %]

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
Rate each response independently with reasoning (1-10 scale).

**Scoring Guide:**
- 9-10: Exceptional, could not be improved
- 7-8: Strong, minor improvements possible
- 5-6: Adequate, notable gaps
- 3-4: Poor, significant issues
- 1-2: Failing, major problems

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

### Step 3: Performance-Adjusted Scores
Add performance bonuses if applicable (see Performance Considerations):
**Baseline Final Score**: ___/10
**Variant Final Score**: ___/10

## Performance Considerations

Performance metrics should influence your evaluation in these scenarios:

1. **Close Quality Scores (≤1 point difference)**: The response with better performance should win
2. **Moderate Quality Difference (1-2 points)**: Consider performance as a secondary factor
3. **Significant Performance Advantage**: 
   - 15%+ faster response time = worth 0.5 bonus points
   - 10%+ fewer tokens = worth 0.5 bonus points
   - Both advantages combined = worth 1.0 bonus points

**Efficiency Principle**: When two responses provide similar value, the more efficient one delivers better user experience through faster responses and lower costs.

## Decision Framework

### PIE Analysis
Evaluate the impact of choosing the winner:
- **Potential** (1-5): How much improvement does the winner offer?
- **Importance** (1-5): How critical is this improvement for users?
- **Ease** (1-5): How simple is it to implement the winner?

### Final Decision

**Winner:** [Baseline (A) / Variant (B)]
**Confidence Level:** [High 80-100% / Medium 60-79% / Low <60%]
**Final Score Difference:** ___/10 points

**Decision Rationale:** [Explain your decision in 2-3 sentences focusing on the most important factors]

**Key Strengths of Winner:**
- [Most important advantage]
- [Second advantage]

**Key Strengths of Loser:**
- [What it did better]
- [Worth preserving]

**Implementation Recommendation:** [Should this be deployed? Any conditions or caveats?]

{{#if CONTEXT_FILES}}

**Context Impact:** [How did the repository files influence your decision?]

{{/if}}

---
*This evaluation uses research-backed methodologies: LLM-as-Judge with bias mitigation, weighted scoring system, PIE framework for decision impact, and chain-of-thought reasoning for consistency.*