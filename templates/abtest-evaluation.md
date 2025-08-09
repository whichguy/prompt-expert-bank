# A/B Test Evaluation

## Task Definition

You are evaluating two prompt responses using LLM-as-Judge methodology. Your task is to determine which response performs better by applying the expertise defined below.

**Bias Mitigation Protocol**: 
- Evaluate each response independently before comparing
- Base scores on specific evidence, not general impressions
- The order (A vs B) must not influence your judgment
- Provide explicit reasoning for every score to ensure consistency

## Expert Context

{{EXPERT_DEFINITION}}

## Test Information
- **Expert**: {{EXPERT_NAME}}
- **Date**: {{TIMESTAMP}}
- **Evaluation Focus**: Determine which response better serves the user's specific needs

{{#if CONTEXT_FILES}}

## Repository Context
{{CONTEXT_FILE_COUNT}} repository files provided ({{CONTEXT_SIZE}} bytes total) - consider how well each response addresses the specific codebase.

{{/if}}

## Responses to Evaluate

### Baseline (A)
<baseline>
{{BASELINE_CONTENT}}
</baseline>

### Variant (B)
<variant>
{{VARIANT_CONTENT}}
</variant>

## Performance Metrics
- **Baseline (A)**: {{BASELINE_LATENCY}}ms | {{BASELINE_TOKENS}} tokens ({{BASELINE_INPUT_TOKENS}} in, {{BASELINE_OUTPUT_TOKENS}} out)
- **Variant (B)**: {{VARIANT_LATENCY}}ms | {{VARIANT_TOKENS}} tokens ({{VARIANT_INPUT_TOKENS}} in, {{VARIANT_OUTPUT_TOKENS}} out)

**Performance Delta**: 
- Speed: [State exact difference, e.g., "B is 23% faster" or "A is 150ms slower"]
- Tokens: [State exact difference, e.g., "A uses 30% fewer tokens" or "B uses 200 more tokens"]

---

## Evaluation Process

### Step 1: Define Domain-Specific Criteria

Using the expert definition above, generate specific evaluation criteria for this domain:

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

### Step 2: Disqualification Check

First, verify neither response contains disqualifying issues:

**Baseline (A)**: Pass ✓ or Fail ✗ - [If fail, quote the specific problematic content]
**Variant (B)**: Pass ✓ or Fail ✗ - [If fail, quote the specific problematic content]

*Any disqualification typically results in automatic rejection unless both responses fail.*

### Step 3: Individual Assessment

Score each response on a 1-10 scale. First state the score, then provide specific evidence from the response that justifies it.

**Scoring Calibration:**
- 9-10: Exceptional - Exceeds all requirements with innovative solutions
- 7-8: Strong - Meets all requirements with minor room for enhancement
- 5-6: Adequate - Meets core requirements but has notable gaps
- 3-4: Poor - Fails multiple requirements or has significant issues
- 1-2: Failing - Fundamentally flawed or potentially harmful

**Baseline (A):**
- Technical Accuracy: ___/10 - [Cite specific accurate/inaccurate statements]
- Domain Excellence: ___/10 - [Which excellence indicators are present/missing?]
- Clarity: ___/10 - [Specific examples of clear/unclear elements]
- Practical Use: ___/10 - [How would this work in real-world application?]
- User Experience: ___/10 - [How easy/difficult to understand and implement?]

**Variant (B):**
- Technical Accuracy: ___/10 - [Cite specific accurate/inaccurate statements]
- Domain Excellence: ___/10 - [Which excellence indicators are present/missing?]
- Clarity: ___/10 - [Specific examples of clear/unclear elements]
- Practical Use: ___/10 - [How would this work in real-world application?]
- User Experience: ___/10 - [How easy/difficult to understand and implement?]

### Step 4: Calculate Weighted Scores

Apply these weights to calculate final scores:
- Technical Accuracy: 25%
- Domain Excellence: 20%
- Clarity: 20%
- Practical Use: 20%
- User Experience: 15%

**Baseline Weighted Total**: ___/10
**Variant Weighted Total**: ___/10

### Step 5: Apply Performance Adjustments

Performance bonuses for significant advantages:
- 15%+ faster response time = +0.5 points
- 10%+ fewer tokens = +0.5 points
- Both advantages combined = +1.0 points

**Baseline Final Score**: ___/10
**Variant Final Score**: ___/10

**Note**: Performance primarily matters when quality scores are close (≤1 point difference). For responses of comparable quality, prefer the one with superior performance metrics.

---

## Final Decision

### Impact Assessment (PIE Framework)
Quantify the practical impact of your choice:
- **Potential** (1-5): Size of improvement over current state
- **Importance** (1-5): Criticality to user success
- **Ease** (1-5): Implementation simplicity (5=trivial, 1=complex)

### Winner Declaration

**Winner:** [State clearly: "Baseline (A)" or "Variant (B)"]
**Confidence Level:** [Choose one: High (80-100%) | Medium (60-79%) | Low (<60%)]
**Final Score Difference:** ___/10 points

### Decision Analysis

**Decision Rationale:** [In 2-3 sentences, state the primary differentiator and how it impacts the specific use case]

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