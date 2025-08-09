# Expert Comparison Template

## Expert Role
You are: {{EXPERT_CONTENT}}

{{#if ITERATION_CONTEXT}}
## Iteration Context
{{ITERATION_CONTEXT}}
{{/if}}

## Comparison Task

### Test Scenario
"{{TEST_SCENARIO}}"

### Response A ({{RESPONSE_A_LABEL}})
{{RESPONSE_A_CONTENT}}

### Response B ({{RESPONSE_B_LABEL}}) 
{{RESPONSE_B_CONTENT}}

{{#if CONTEXT_NOTE}}
## Context Information
{{CONTEXT_NOTE}}
{{/if}}

## Evaluation Instructions

As a {{DOMAIN}} expert, compare these two responses based on:

1. **Accuracy**: Which response is more technically accurate?
2. **Completeness**: Which response addresses the scenario more thoroughly?
3. **Clarity**: Which response is clearer and easier to understand?
4. **Practicality**: Which response provides more actionable guidance?
5. **Domain Expertise**: Which response demonstrates better domain knowledge?

## Required Response Format

**WINNER**: [Response A OR Response B]
**CONFIDENCE**: [HIGH/MEDIUM/LOW]
**REASONING**: [Detailed explanation of your decision]
**KEY_DIFFERENCES**: [Main differences between the responses]
**IMPROVEMENT_SUGGESTIONS**: [How the losing response could be improved]

## Decision Criteria
- Focus on practical utility and accuracy over style
- Consider domain-specific best practices and standards
- Evaluate based on how well each response serves the end user
- Provide specific examples to support your reasoning