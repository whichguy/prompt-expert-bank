# A/B Test Evaluation

## Evaluation Purpose

You are conducting a systematic A/B test evaluation as an expert evaluator using the "LLM-as-Judge" methodology. Your task is to determine which of two prompt responses better achieves the intended outcome through objective, evidence-based assessment.

**Expert Context**: You will evaluate these responses through the lens of the expert persona defined in the provided expert file. Apply that domain expertise and evaluation standards throughout this assessment.

**Evaluation Framework**:
- **Baseline (A)**: The current or control version  
- **Variant (B)**: The proposed alternative version

**Your Role**: Provide objective, consistent evaluation while avoiding positional bias (don't favor A or B based on order). Focus on measurable quality differences and practical impact.

**Key Principle**: Balance content quality with performance efficiency. Better performance with equal quality should be acknowledged, but never let speed compromise accuracy or usefulness.

## Test Information
- **Expert**: {{EXPERT_NAME}}
- **Date**: {{TIMESTAMP}}

## Performance Metrics
- **Baseline Response**: {{BASELINE_LATENCY}}ms | {{BASELINE_TOKENS}} tokens ({{BASELINE_INPUT_TOKENS}} in, {{BASELINE_OUTPUT_TOKENS}} out)
- **Variant Response**: {{VARIANT_LATENCY}}ms | {{VARIANT_TOKENS}} tokens ({{VARIANT_INPUT_TOKENS}} in, {{VARIANT_OUTPUT_TOKENS}} out)

{{#if CONTEXT_FILES}}
## Context Provided
**{{CONTEXT_FILE_COUNT}} files loaded** ({{CONTEXT_SIZE}} bytes total)

*Repository files have been provided for context. Evaluate how well each response addresses the specific codebase, architecture, and project requirements evident in these files.*
{{/if}}

## Response Comparison

### Baseline Response (A)
<baseline>
{{BASELINE_CONTENT}}
</baseline>

### Variant Response (B)  
<variant>
{{VARIANT_CONTENT}}
</variant>

## Your Evaluation Task

**Evaluation Instructions**: Rate each response independently on these 4 dimensions using the 1-10 scale. Provide specific reasoning for each score to ensure consistency and reduce bias.

### Scoring Rubric (1-10 Scale):
- **8-10**: Excellent - Exceeds expectations, comprehensive and highly effective
- **6-7**: Good - Meets expectations with minor areas for improvement  
- **4-5**: Adequate - Basic requirements met but has notable gaps
- **1-3**: Poor - Fails to meet basic requirements, significant issues

### Evaluation Dimensions:

**1. Clarity (25% weight)**
How easily understood and well-structured is this response?
- Baseline Score: ___/10 | Reasoning: ___
- Variant Score: ___/10 | Reasoning: ___

**2. Technical Accuracy (30% weight)**  
Are technical details correct, complete, and following best practices?
- Baseline Score: ___/10 | Reasoning: ___
- Variant Score: ___/10 | Reasoning: ___

**3. Practical Use (25% weight)**
Can users immediately apply this guidance effectively?
- Baseline Score: ___/10 | Reasoning: ___
- Variant Score: ___/10 | Reasoning: ___

**4. User Experience (20% weight)**
How engaging, accessible, and user-friendly is this content?
- Baseline Score: ___/10 | Reasoning: ___
- Variant Score: ___/10 | Reasoning: ___

## Technical Performance Considerations

Use the performance metrics as tie-breakers in these scenarios:

1. **Close Evaluation (≤1 point difference)**: When content quality scores are very close, favor the response with **faster response time** and **fewer tokens** as it provides similar value more efficiently.

2. **Notable Performance Advantage**: If one response has **15%+ faster response time** OR **10%+ fewer tokens** while maintaining comparable content quality, consider this as a notable advantage worth mentioning in your decision.

## Statistical Analysis

**Weighted Composite Scores:**
- Baseline Total: ___/10 (Clarity×0.25 + Technical×0.30 + Practical×0.25 + UX×0.20)
- Variant Total: ___/10 (Clarity×0.25 + Technical×0.30 + Practical×0.25 + UX×0.20)
- **Difference**: ___/10 points

## Decision Framework

### PIE Analysis (Potential, Importance, Ease)
Rate the impact of choosing the winning version:
- **Potential for Improvement**: ___/5 (How much better is the winner?)
- **Importance to Users**: ___/5 (How critical is this improvement?)  
- **Ease of Implementation**: ___/5 (How simple to adopt the winner?)

### Final Verdict

**WINNER**: [Baseline/Variant]
**CONFIDENCE**: [High/Medium/Low] (**____%** confident)
**SCORE DIFFERENCE**: ___/10 points

**Primary Reasoning**: [Based on your scoring, explain the key factors that determined the winner]

**Trade-offs Considered**: [What advantages does the losing version have, if any?]

{{#if CONTEXT_FILES}}
**Repository Context Impact**: [How did the {{CONTEXT_FILE_COUNT}} files ({{CONTEXT_SIZE}} bytes) influence your evaluation? Did the winner better address the specific codebase needs?]
{{/if}}

**Recommendation**: [Should this change be implemented? Any conditions or considerations for deployment?]