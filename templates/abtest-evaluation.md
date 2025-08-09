# A/B Test Evaluation Framework

## Test Configuration
- **Expert**: {{EXPERT_NAME}}
- **Test Type**: {{TEST_TYPE}}
- **Timestamp**: {{TIMESTAMP}}
- **Hypothesis**: {{HYPOTHESIS}}

## Pre-Test Setup

### Success Criteria
{{#if SUCCESS_CRITERIA}}
**Primary Success Metrics:**
{{SUCCESS_CRITERIA}}
{{else}}
- Response quality improvement
- Technical accuracy enhancement
- User experience optimization
{{/if}}

### Statistical Framework
- **Confidence Level**: 95%
- **Expected Effect Size**: {{EFFECT_SIZE_EXPECTATION}}
- **Evaluation Method**: LLM-as-Judge with structured scoring

## Context Analysis

{{#if CONTEXT_FILES}}
### Repository Context
Files loaded for evaluation context:
{{#each CONTEXT_FILES}}
- **{{this.name}}** ({{this.type}}) - {{this.size}} bytes
{{/each}}

**Context Statistics:**
- Total files: {{CONTEXT_FILES.length}}
- Total size: {{TOTAL_CONTEXT_SIZE}}
- Primary languages: {{DETECTED_LANGUAGES}}
{{else}}
No additional context provided for this evaluation.
{{/if}}

{{#if CONTEXT_METRICS}}
### Context Metrics
- Code complexity: {{CONTEXT_METRICS.complexity}}
- Documentation coverage: {{CONTEXT_METRICS.documentation_ratio}}
- Test coverage indicators: {{CONTEXT_METRICS.test_indicators}}
{{/if}}

## Baseline vs Variant Analysis

### Baseline (Version A)
```
{{BASELINE_CONTENT}}
```

**Baseline Characteristics:**
- Word count: {{BASELINE_WORD_COUNT}}
- Structure: {{BASELINE_STRUCTURE_TYPE}}
- Key elements: {{BASELINE_KEY_ELEMENTS}}

### Variant (Version B)
```
{{VARIANT_CONTENT}}
```

**Variant Characteristics:**
- Word count: {{VARIANT_WORD_COUNT}}
- Structure: {{VARIANT_STRUCTURE_TYPE}}
- Key elements: {{VARIANT_KEY_ELEMENTS}}

## Evaluation Framework

### Primary Evaluation Dimensions

#### 1. Clarity and Comprehension (Weight: 25%)
- **Readability**: How easily understood is the content?
- **Structure**: Is the information logically organized?
- **Precision**: Are instructions specific and unambiguous?

**Baseline Score (1-10):** {{BASELINE_CLARITY_SCORE}}
**Variant Score (1-10):** {{VARIANT_CLARITY_SCORE}}

#### 2. Technical Accuracy (Weight: 30%)
- **Correctness**: Are technical details accurate?
- **Completeness**: Are all necessary technical aspects covered?
- **Best Practices**: Does it follow established conventions?

**Baseline Score (1-10):** {{BASELINE_TECHNICAL_SCORE}}
**Variant Score (1-10):** {{VARIANT_TECHNICAL_SCORE}}

#### 3. Practical Applicability (Weight: 25%)
- **Actionability**: Can users immediately apply the guidance?
- **Context Relevance**: Does it address the specific use case?
- **Implementation Ease**: How difficult is it to execute?

**Baseline Score (1-10):** {{BASELINE_PRACTICAL_SCORE}}
**Variant Score (1-10):** {{VARIANT_PRACTICAL_SCORE}}

#### 4. User Experience (Weight: 20%)
- **Engagement**: Is the content engaging and motivating?
- **Accessibility**: Is it accessible to the target audience?
- **Cognitive Load**: Does it minimize mental effort required?

**Baseline Score (1-10):** {{BASELINE_UX_SCORE}}
**Variant Score (1-10):** {{VARIANT_UX_SCORE}}

### Context-Aware Evaluation

{{#if CONTEXT_FILES}}
#### Code Quality Considerations
- **Code Readability**: How well does each version help with code understanding?
- **Maintainability**: Which version promotes better long-term code maintenance?
- **Error Prevention**: Which version is more likely to prevent implementation errors?

#### Repository-Specific Factors
- **Project Scale**: Appropriateness for project size ({{CONTEXT_METRICS.project_scale}})
- **Technology Stack**: Alignment with detected technologies ({{DETECTED_LANGUAGES}})
- **Architecture Patterns**: Consistency with existing patterns
{{/if}}

### Statistical Analysis

#### Weighted Composite Scores
- **Baseline Total**: {{BASELINE_COMPOSITE_SCORE}}/10
- **Variant Total**: {{VARIANT_COMPOSITE_SCORE}}/10
- **Difference**: {{SCORE_DIFFERENCE}} points
- **Effect Size**: {{CALCULATED_EFFECT_SIZE}}

#### Confidence Assessment
- **Statistical Significance**: {{STATISTICAL_SIGNIFICANCE}}
- **Practical Significance**: {{PRACTICAL_SIGNIFICANCE}}
- **Sample Adequacy**: {{SAMPLE_ADEQUACY}}

## Expert Analysis

### Qualitative Assessment
{{QUALITATIVE_ANALYSIS}}

### Key Differentiators
**Baseline Strengths:**
{{BASELINE_STRENGTHS}}

**Baseline Weaknesses:**
{{BASELINE_WEAKNESSES}}

**Variant Strengths:**
{{VARIANT_STRENGTHS}}

**Variant Weaknesses:**
{{VARIANT_WEAKNESSES}}

### Context-Specific Insights
{{#if CONTEXT_FILES}}
Based on analysis of the provided repository context:
{{CONTEXT_SPECIFIC_INSIGHTS}}
{{/if}}

## Decision Framework

### PIE Analysis (Potential, Importance, Ease)
- **Potential for Improvement**: {{PIE_POTENTIAL}}/5
- **Importance to Users**: {{PIE_IMPORTANCE}}/5  
- **Ease of Implementation**: {{PIE_EASE}}/5
- **PIE Score**: {{PIE_TOTAL_SCORE}}/15

### Risk Assessment
- **Implementation Risk**: {{IMPLEMENTATION_RISK}}
- **Performance Impact**: {{PERFORMANCE_IMPACT}}
- **Maintenance Burden**: {{MAINTENANCE_BURDEN}}

## Final Verdict

**WINNER**: {{WINNER}}
**CONFIDENCE**: {{CONFIDENCE}}
**CONFIDENCE SCORE**: {{CONFIDENCE_PERCENTAGE}}%

### Rationale
{{RATIONALE}}

### Supporting Evidence
1. **Quantitative**: {{QUANTITATIVE_EVIDENCE}}
2. **Qualitative**: {{QUALITATIVE_EVIDENCE}}
3. **Context-Specific**: {{CONTEXT_EVIDENCE}}

### Recommendations

#### Immediate Actions
{{IMMEDIATE_RECOMMENDATIONS}}

#### Future Improvements
{{FUTURE_IMPROVEMENTS}}

#### Monitoring Metrics
{{#if SUCCESS_CRITERIA}}
Track the following metrics to validate the decision:
{{MONITORING_METRICS}}
{{else}}
- User satisfaction scores
- Task completion rates  
- Error reduction rates
- Implementation time
{{/if}}

---

**Evaluation completed by**: {{EXPERT_NAME}}
**Evaluation method**: LLM-as-Judge with statistical framework
**Template version**: 2.0 (Enhanced)