# ABTest Comparison Template

## Expert Comparison Analysis

You are the expert defined by this prompt:
{{EXPERT_DEFINITION}}

Your task is to compare two prompt evaluations and provide a clear verdict.

---

## Iteration Context
{{ITERATION_CONTEXT}}

---

## Prompt Versions Being Compared

### Version A ({{VERSION_A_IDENTIFIER}})
- **File**: {{PROMPT_A_PATH}}
- **Reference**: {{VERSION_A_REF}}
- **Aggregate Score**: {{SCORE_A}}
- **Strengths**: {{STRENGTHS_A}}
- **Weaknesses**: {{WEAKNESSES_A}}

### Version B ({{VERSION_B_IDENTIFIER}})
- **File**: {{PROMPT_B_PATH}}
- **Reference**: {{VERSION_B_REF}}
- **Aggregate Score**: {{SCORE_B}}
- **Strengths**: {{STRENGTHS_B}}
- **Weaknesses**: {{WEAKNESSES_B}}

---

## Detailed Evaluation Results

### Structural Analysis
{{STRUCTURAL_COMPARISON}}

### Domain Expertise Analysis
{{DOMAIN_COMPARISON}}

### Effectiveness Analysis
{{EFFECTIVENESS_COMPARISON}}

---

## Your Task

Based on the evaluation data above, provide:

### 1. Detailed Comparison
Compare the two versions focusing on:
- Key differences in approach
- Trade-offs between versions
- Use case suitability
- Overall improvement or regression

### 2. Clear Verdict

You MUST provide ONE of these three verdicts:

#### DEPLOY (Version B is Superior)
Choose this when:
- Version B scores ≥8.5/10 OR
- Version B shows significant improvement (>1.0 score difference) OR
- Version B addresses critical issues from Version A

#### IMPROVE (Version B Needs Refinement)
Choose this when:
- Version B scores 6.0-8.4/10 AND
- Shows promise but has specific weaknesses AND
- Improvements are achievable

#### REJECT (Keep Version A)
Choose this when:
- Version B scores <6.0/10 OR
- Version B introduces regressions OR
- Version A is clearly superior

{{LENIENCY_INSTRUCTION}}

---

## Required Output Format

### Comparison Analysis
[Your detailed comparison here]

### === EVALUATION RESULT ===
**DECISION**: [DEPLOY/IMPROVE/REJECT]
**WINNER**: [A or B]
**CONFIDENCE**: [high/medium/low]
**SCORE DIFFERENCE**: {{SCORE_DIFFERENCE}}

**REASONING**:
[Your detailed reasoning for the decision]

**PRODUCTION RECOMMENDATION**:
[YES/NO with explanation]

{{#if IMPROVE}}
**IMPROVEMENTS NEEDED**:
- [Specific improvement 1]
- [Specific improvement 2]
- [Additional improvements as needed]
{{/if}}
### === END RESULT ===