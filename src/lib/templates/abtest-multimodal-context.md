# ABTest Multimodal Context Evaluation Template

## Context Priming Configuration

You are conducting an A/B test with the following multimodal context materials:

### Context Overview
- **Total Files**: {{TOTAL_FILES}}
- **Total Size**: {{TOTAL_SIZE}}
- **File Types**: {{FILE_TYPES_BREAKDOWN}}

### Multimodal Content Breakdown
{{#if HAS_IMAGES}}
#### Images ({{IMAGE_COUNT}})
{{#each IMAGES}}
- {{this.name}} ({{this.mimeType}}, {{this.size}})
{{/each}}
{{/if}}

{{#if HAS_PDFS}}
#### PDF Documents ({{PDF_COUNT}})
{{#each PDFS}}
- {{this.name}} ({{this.size}})
{{/each}}
{{/if}}

{{#if HAS_CODE}}
#### Code Files ({{CODE_COUNT}})
{{#each CODE_FILES}}
- {{this.name}} ({{this.language}})
  ```{{this.language}}
  {{this.preview}}
  ```
{{/each}}
{{/if}}

---

## Evaluation Framework

### Expert Definition
{{EXPERT_DEFINITION}}

### Test Scenario
You must evaluate how well each prompt handles the provided multimodal context. Consider:

1. **Context Awareness**: How well does the prompt utilize the provided files?
2. **Multimodal Handling**: Effectiveness with different file types (images, PDFs, code)
3. **Information Synthesis**: Ability to combine insights from multiple sources
4. **Practical Application**: How the prompt applies context to real tasks

---

## Prompt Versions

### Version A (Baseline)
{{PROMPT_A_CONTENT}}

### Version B (Variant)
{{PROMPT_B_CONTENT}}

---

## Evaluation Tasks

### Task 1: Context Utilization
Evaluate how each prompt version would handle a task that requires understanding the provided context materials.

**Test Query**: {{TEST_QUERY}}

### Task 2: Multimodal Integration
Assess how each prompt would integrate information from different file types.

**Integration Scenario**: {{INTEGRATION_SCENARIO}}

### Task 3: Code Comprehension
If code files are present, evaluate understanding and application.

{{#if HAS_CODE}}
**Code Task**: {{CODE_TASK}}
{{/if}}

---

## Required Output Format

### 1. Context Utilization Score
Rate each version's ability to leverage the provided context:

**Version A Context Score**: [0-10]
- Files referenced: [list]
- Context understanding: [assessment]

**Version B Context Score**: [0-10]
- Files referenced: [list]
- Context understanding: [assessment]

### 2. Multimodal Handling
Evaluate multimodal capabilities:

**Version A Multimodal Score**: [0-10]
- Image handling: [if applicable]
- PDF processing: [if applicable]
- Code comprehension: [if applicable]

**Version B Multimodal Score**: [0-10]
- Image handling: [if applicable]
- PDF processing: [if applicable]
- Code comprehension: [if applicable]

### 3. Overall Verdict

=== EVALUATION RESULT ===
WINNER: [Version A or Version B]
WINNER_IDENTIFIER: {{WINNER_VERSION}}
CONFIDENCE: [high/medium/low]
OVERALL_SCORE_A: [X]/10
OVERALL_SCORE_B: [X]/10

KEY_DIFFERENTIATORS:
- [Differentiator 1]
- [Differentiator 2]
- [Differentiator 3]

CONTEXT_UTILIZATION:
- Version A: [summary]
- Version B: [summary]

RECOMMENDATION: [DEPLOY/REVIEW/REJECT/ITERATE]
REASONING: [Detailed explanation]
=== END RESULT ===

---

## Iteration Context
{{#if IS_ITERATION}}
**Iteration Number**: {{ITERATION_COUNT}}
**Previous Feedback**: {{PREVIOUS_FEEDBACK}}
**Leniency Adjustment**: {{LENIENCY_NOTE}}
{{/if}}