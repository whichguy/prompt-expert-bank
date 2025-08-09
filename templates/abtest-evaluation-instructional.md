# A/B Test Evaluation Framework

## Test Configuration
- **Expert Role**: {{EXPERT_NAME}}
- **Test Conducted**: {{TIMESTAMP}}
- **Evaluation Method**: LLM-as-Judge with structured analysis

## Test Hypothesis
Analyze the baseline and variant responses to determine which better achieves the intended outcome. Consider the specific context and use case when making your evaluation.

## Technical Metrics (Auto-Generated)
- **Baseline Response Time**: {{BASELINE_LATENCY}}ms
- **Variant Response Time**: {{VARIANT_LATENCY}}ms
- **Baseline Tokens**: {{BASELINE_TOKENS}} ({{BASELINE_INPUT_TOKENS}} in, {{BASELINE_OUTPUT_TOKENS}} out)
- **Variant Tokens**: {{VARIANT_TOKENS}} ({{VARIANT_INPUT_TOKENS}} in, {{VARIANT_OUTPUT_TOKENS}} out)
- **Context Size**: {{CONTEXT_SIZE}} bytes across {{CONTEXT_FILE_COUNT}} files

## Context Analysis

{{#if CONTEXT_FILES}}
**Repository Context Provided:**
{{#each CONTEXT_FILES}}
- **{{this.name}}** ({{this.size}} bytes, {{this.type}})
{{/each}}

Based on this context, evaluate how well each response:
1. Addresses the specific codebase and project requirements
2. Accounts for the existing architecture and patterns
3. Considers the scale and complexity of the project
4. Aligns with the technology stack in use
{{else}}
**No repository context provided.** Evaluate responses based on general applicability and best practices.
{{/if}}

## Response Analysis

### Baseline Response (Version A)
```
{{BASELINE_CONTENT}}
```

**Your Analysis Instructions:**
Evaluate this response on the following dimensions and provide specific scores:

1. **Clarity & Comprehension (1-10)**: How easily understood and well-structured is this response?
2. **Technical Accuracy (1-10)**: Are the technical details correct and complete?
3. **Practical Applicability (1-10)**: Can users immediately apply this guidance?
4. **User Experience (1-10)**: How engaging and accessible is this content?

### Variant Response (Version B)  
```
{{VARIANT_CONTENT}}
```

**Your Analysis Instructions:**
Apply the same evaluation criteria to this response:

1. **Clarity & Comprehension (1-10)**: Rate readability and organization
2. **Technical Accuracy (1-10)**: Assess correctness and completeness
3. **Practical Applicability (1-10)**: Judge actionability and relevance
4. **User Experience (1-10)**: Evaluate engagement and accessibility

## Comparative Analysis Instructions

### Quantitative Comparison
Create a scoring table comparing both responses:

| Dimension | Baseline (A) | Variant (B) | Difference | Winner |
|-----------|--------------|-------------|------------|---------|
| Clarity & Comprehension | [Score] | [Score] | [+/-] | [A/B] |
| Technical Accuracy | [Score] | [Score] | [+/-] | [A/B] |
| Practical Applicability | [Score] | [Score] | [+/-] | [A/B] |
| User Experience | [Score] | [Score] | [+/-] | [A/B] |
| **Weighted Total** | [Score]/10 | [Score]/10 | [+/-] | [A/B] |

*Weights: Technical Accuracy 30%, Clarity 25%, Practical 25%, UX 20%*

### Qualitative Assessment
Provide detailed analysis addressing:

**Baseline Strengths:** What does Version A do particularly well?

**Baseline Weaknesses:** Where does Version A fall short?

**Variant Strengths:** What makes Version B effective?

**Variant Weaknesses:** What are Version B's limitations?

**Key Differentiators:** What are the most important differences between the responses?

{{#if CONTEXT_FILES}}
**Context-Specific Insights:** How do the responses differ in addressing the specific repository context and requirements?
{{/if}}

### Statistical Analysis
Based on your scoring:

**Effect Size:** Calculate the practical significance of the difference
- Small effect: 0-1 point difference
- Medium effect: 1-3 point difference  
- Large effect: 3+ point difference

**Confidence Assessment:** Rate your confidence in the evaluation
- High: Clear winner with substantial differences
- Medium: Moderate preference with some trade-offs
- Low: Close call with minimal differences

## Decision Framework

### PIE Analysis
Rate each factor from 1-5:

**Potential for Improvement:** How much better is the winning response?
**Importance to Users:** How critical is this improvement to user success?
**Ease of Implementation:** How simple would it be to adopt the winning approach?

### Risk Assessment
Consider potential downsides of choosing the variant:
- Implementation complexity
- Maintenance requirements
- Performance implications
- User adoption challenges

## Final Verdict

**WINNER:** [Response A or Response B]
**CONFIDENCE:** [High/Medium/Low]
**CONFIDENCE PERCENTAGE:** [60-100%]

### Rationale
Provide a clear explanation for your decision including:
1. **Primary deciding factors**
2. **Quantitative evidence** (scores and metrics)
3. **Qualitative insights** (specific examples and observations)
4. **Context considerations** (how repository context influenced the decision)

### Recommendations

**Immediate Action:** What should be implemented based on this test?

**Future Testing:** What additional A/B tests would be valuable?

**Success Metrics:** How should the impact of this decision be measured?

---

**Evaluation Guidelines:**
- Be objective and evidence-based in your scoring
- Provide specific examples to support your ratings
- Consider both immediate and long-term implications
- Account for the target audience and use case
- Balance quantitative scores with qualitative insights