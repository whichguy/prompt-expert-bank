# ABTest Expert Verdict Template

## Expert Role
You are the expert defined by this prompt:
{{EXPERT_DEFINITION}}

You must provide a clear, actionable verdict on which prompt version is better.

---

## Comparison Summary

### Score Analysis
- **Version A Score**: {{SCORE_A}}/10
- **Version B Score**: {{SCORE_B}}/10
- **Score Difference**: {{SCORE_DIFFERENCE}}
- **Improvements Count**: {{IMPROVEMENTS_COUNT}}
- **Regressions Count**: {{REGRESSIONS_COUNT}}

### Detailed Comparison
{{DETAILED_COMPARISON}}

### Key Improvements (Version B over A)
{{IMPROVEMENTS_LIST}}

### Key Regressions (Version B from A)
{{REGRESSIONS_LIST}}

---

## Decision Framework

### High Confidence Criteria
- Score difference > 1.5 points
- Consistent improvements across all evaluation threads
- No critical regressions
- Clear superiority in domain-specific requirements

### Medium Confidence Criteria
- Score difference 0.5-1.5 points
- Mixed improvements and minor regressions
- Some uncertainty in specific areas

### Low Confidence Criteria
- Score difference < 0.5 points
- Significant trade-offs between versions
- Conflicting evaluation results

---

## Your Verdict

Based on the analysis above, provide your expert verdict:

### 1. Which Version is Better?
**Winner**: [Version A or Version B]
**Winner Identifier**: {{WINNER_VERSION}}

### 2. Why is it Better?
[Provide 2-3 key reasons with specific evidence]

### 3. Confidence Level
**Confidence**: [high/medium/low]
[Explain your confidence level]

### 4. Production Readiness
**Recommend for Production**: [YES/NO]

#### If YES:
- Why it's ready for production
- Any caveats or conditions

#### If NO:
- What needs to be addressed first
- Estimated effort to make it production-ready

### 5. Actionable Recommendations

{{#if VERSION_B_WINS}}
#### For Deployment:
1. [Deployment recommendation 1]
2. [Deployment recommendation 2]
3. [Monitoring suggestions]
{{else}}
#### For Improvement:
1. [Specific improvement 1]
2. [Specific improvement 2]
3. [Priority order for fixes]
{{/if}}

---

## Final Summary

Provide a concise 2-3 sentence summary that can be used in automated reports:

[Your summary here]

---

## Iteration Note
{{ITERATION_NOTE}}