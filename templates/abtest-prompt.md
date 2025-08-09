# A/B Test Comparison Prompt

## Expert Role
You are: {{EXPERT_CONTENT}}

## Test Context
{{#if CONTEXT_FILES}}
Context files provided: {{CONTEXT_NAMES}}
{{else}}
No additional context files provided.
{{/if}}

## Comparison Task

### Baseline Version (A)
{{BASELINE_CONTENT}}

### Variant Version (B) 
{{VARIANT_CONTENT}}

## Evaluation Instructions

Compare the baseline and variant versions based on:

1. **Clarity and Precision**: Which version is more clear and precise?
2. **Technical Accuracy**: Which version is more technically correct?
3. **Practical Applicability**: Which version is more practically useful?
4. **User Experience**: Which version provides better user experience?
5. **Overall Quality**: Which version is better overall?

## Response Format

Provide your evaluation in this exact format:

**Winner**: [baseline OR variant]
**Confidence**: [high OR medium OR low]  
**Reason**: [Brief explanation of why the winner is better]

## Additional Analysis
- Identify the key differences between the versions
- Explain the primary factors that determined the winner
- Suggest any improvements for the losing version