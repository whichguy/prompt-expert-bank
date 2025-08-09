# A/B Test Evaluation

## Purpose

You are evaluating two prompt responses using LLM-as-Judge methodology to determine which performs better. Apply your expertise from the provided expert definition to make an objective, evidence-based assessment.

**Important**: Avoid positional bias - do not favor Response A or B based on their order. Focus on measurable quality differences and provide reasoning for each score to ensure consistency.

## Expert Definition

{{EXPERT_DEFINITION}}

## Domain-Specific Evaluation Criteria

Based on your expertise and the domain context, identify:

**Critical Requirements** (Must-haves for this domain):
- [Identify 3-10 non-negotiable requirements specific to your domain]
- [Be comprehensive - list ALL critical standards that must be met]
- [Example: For security domain - "Must not expose sensitive data"]
- [Example: For medical domain - "Must include appropriate disclaimers"]
- [Example: For programming - "Must handle null/undefined inputs"]
- [Continue listing until all critical requirements are covered]

**Disqualifying Factors** (Automatic failure conditions):
- [List 3-10 factors that would immediately disqualify a response]
- [Be thorough - any of these should result in automatic rejection]
- [Example: Factually incorrect information that could cause harm]
- [Example: Violations of domain best practices or standards]
- [Example: Security vulnerabilities or data leaks]
- [Example: Missing critical error handling]
- [Continue listing all potential disqualifiers]

**Domain Excellence Indicators** (What exceptional looks like):
- [Define 3-10 characteristics of outstanding responses in your domain]
- [Comprehensive list of what makes a response truly excellent]
- [Example: For programming - "Includes error handling and edge cases"]
- [Example: For finance - "Addresses regulatory compliance"]
- [Example: Optimization for performance and scalability]
- [Example: Clear documentation and examples]
- [Continue listing excellence indicators]

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

### Step 0: Disqualification Check
Before scoring, check for any disqualifying factors:

**Baseline (A)**: [Pass/Fail] - [If fail, specify the disqualifying factor]
**Variant (B)**: [Pass/Fail] - [If fail, specify the disqualifying factor]

*If either response fails this check, it should automatically lose unless both fail.*

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
- Technical Accuracy: ___/10 - [Why this score? Consider domain standards]
- Practical Use: ___/10 - [Why this score? Consider domain context]
- User Experience: ___/10 - [Why this score?]
- Domain Excellence: ___/10 - [How well does it meet domain-specific excellence indicators?]

**Variant (B):**
- Clarity: ___/10 - [Why this score?]
- Technical Accuracy: ___/10 - [Why this score? Consider domain standards]
- Practical Use: ___/10 - [Why this score? Consider domain context]
- User Experience: ___/10 - [Why this score?]
- Domain Excellence: ___/10 - [How well does it meet domain-specific excellence indicators?]

### Step 2: Weighted Scoring
Calculate weighted totals using these weights:
- Technical Accuracy: 25%
- Domain Excellence: 20%
- Clarity: 20%
- Practical Use: 20%
- User Experience: 15%

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

**Decision Rationale:** [Explain your decision in 2-3 sentences focusing on the most important factors, including domain considerations]

**Critical Requirements Met:**
- Winner: [Which critical requirements were satisfied?]
- Loser: [Which critical requirements were missed, if any?]

**Key Strengths of Winner:**
- [Most important advantage]
- [Domain-specific strength]
- [Performance or quality advantage]

**Key Strengths of Loser:**
- [What it did better]
- [Worth preserving for future iterations]

**Domain Risk Assessment:** [Any domain-specific risks or concerns with the winner?]

**Implementation Recommendation:** [Should this be deployed? Any domain-specific conditions or caveats?]

{{#if CONTEXT_FILES}}

**Context Impact:** [How did the repository files influence your decision?]

{{/if}}

---
*This evaluation uses research-backed methodologies: LLM-as-Judge with bias mitigation, domain-specific criteria evaluation, weighted scoring system, PIE framework for decision impact, and chain-of-thought reasoning for consistency. Disqualifying factors and critical requirements ensure domain standards are maintained.*