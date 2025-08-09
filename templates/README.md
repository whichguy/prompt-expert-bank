# Template System Documentation

## Overview

The template system provides structured, reusable MD templates for ABTest evaluations and thread-based prompt testing. Templates use `{{VARIABLE}}` syntax for variable substitution and support conditional content blocks.

## Available Templates

### 1. `abtest-prompt.md`
**Purpose**: Main ABTest comparison prompt for direct baseline vs variant evaluation  
**Variables**:
- `{{EXPERT_CONTENT}}` - Expert role definition content
- `{{CONTEXT_FILES}}` - Boolean for conditional context display
- `{{CONTEXT_NAMES}}` - Comma-separated list of context file names  
- `{{BASELINE_CONTENT}}` - Baseline prompt content
- `{{VARIANT_CONTENT}}` - Variant prompt content

**Usage**:
```javascript
const variables = {
  EXPERT_CONTENT: expertDef.content,
  CONTEXT_FILES: context.length > 0,
  CONTEXT_NAMES: context.map(f => f.name).join(', '),
  BASELINE_CONTENT: baseline.content,
  VARIANT_CONTENT: variant.content
};

const prompt = await templateHelper.processTemplate('templates/abtest-prompt.md', variables);
```

### 2. `thread-evaluation.md`
**Purpose**: ThreadA/ThreadB individual prompt execution with repository context  
**Variables**:
- `{{PROMPT_CONTENT}}` - The prompt definition being tested
- `{{TEST_SCENARIO}}` - Test scenario description
- `{{CONTEXT_AVAILABLE}}` - Boolean for conditional context sections
- `{{CONTEXT_CONTENT}}` - Formatted repository files and content

**Usage**:
```javascript
const variables = TemplateHelper.createThreadVariables(
  promptContent,
  testScenario, 
  formattedRepoContext
);

const threadPrompt = await templateHelper.processTemplate('templates/thread-evaluation.md', variables);
```

### 3. `expert-comparison.md` 
**Purpose**: ThreadC expert comparison of ThreadA vs ThreadB responses
**Variables**:
- `{{EXPERT_CONTENT}}` - Expert role definition
- `{{TEST_SCENARIO}}` - The test scenario that was evaluated
- `{{RESPONSE_A_CONTENT}}` - ThreadA response text
- `{{RESPONSE_B_CONTENT}}` - ThreadB response text  
- `{{RESPONSE_A_LABEL}}` - Label for Response A (e.g., "Baseline")
- `{{RESPONSE_B_LABEL}}` - Label for Response B (e.g., "Variant")
- `{{DOMAIN}}` - Expert domain (e.g., "programming", "technical")
- `{{ITERATION_CONTEXT}}` - Optional iteration context for multi-round testing
- `{{CONTEXT_NOTE}}` - Note about repository context availability

**Usage**:
```javascript
const variables = TemplateHelper.createComparisonVariables({
  expertContent: expert.content,
  testScenario,
  responseA: threadA.content[0].text,
  responseB: threadB.content[0].text,
  labelA: 'Baseline',
  labelB: 'Variant',
  contextNote: `Both responses had access to ${context.length} repository files.`
});

const comparisonPrompt = await templateHelper.processTemplate('templates/expert-comparison.md', variables);
```

### 4. `abtest-evaluation.md`
**Purpose**: Results documentation template (legacy, pre-thread system)
**Variables**: Configuration metadata and verdict documentation

## Template Syntax

### Variable Substitution
- `{{VARIABLE_NAME}}` - Replaced with provided variable value
- Variables are case-sensitive
- Undefined variables are replaced with empty strings

### Conditional Blocks
```markdown
{{#if VARIABLE_NAME}}
Content shown when VARIABLE_NAME is truthy
{{else}}
Content shown when VARIABLE_NAME is falsy or undefined
{{/if}}
```

### Supported Conditions
- String values: Non-empty strings are truthy
- Boolean values: `true` is truthy, `false` is falsy
- Numbers: Non-zero numbers are truthy
- Arrays/Objects: Non-empty are truthy

## TemplateHelper Utility

### Methods

#### `processTemplate(templatePath, variables)`
Load template and perform variable substitution and conditional processing.

#### `createThreadVariables(promptContent, testScenario, contextContent)`
Helper to create standard variables for thread evaluation templates.

#### `createComparisonVariables(config)`
Helper to create standard variables for expert comparison templates.

### Configuration
```javascript
const templateHelper = new TemplateHelper({
  octokit: octokitInstance,
  owner: 'repoOwner',
  repo: 'repoName'
});
```

## ABTest Integration

### Simple Comparison (Legacy)
```javascript
const result = await abtest.run({
  expert: 'expert-definitions/programming-expert.md',
  promptA: 'prompts/baseline.md',
  promptB: 'prompts/variant.md',
  context: ['repo-files/src/main.js', 'repo-files/README.md']
});
```

### Thread-Based Evaluation (Enhanced)
```javascript
const result = await abtest.run({
  expert: 'expert-definitions/programming-expert.md', 
  promptA: 'prompts/baseline.md',
  promptB: 'prompts/variant.md',
  context: ['repo-files/src/main.js', 'repo-files/README.md'],
  testScenario: 'Analyze the code quality and suggest improvements'
});

// Returns enhanced results with thread responses
console.log(result.threads.baseline);   // ThreadA response
console.log(result.threads.variant);    // ThreadB response  
console.log(result.threads.comparison); // ThreadC expert analysis
```

## Repository Context Handling

When GitHub repository files/folders are provided:

1. **Context Loading**: Files are fetched from GitHub API and cached
2. **Context Formatting**: Files are formatted as structured markdown with syntax highlighting
3. **Thread Distribution**: **Both ThreadA and ThreadB receive identical repository context**
4. **Expert Awareness**: ThreadC knows both threads had the same context for fair comparison

### Context Format
```markdown
### filename.js
```javascript
// file contents here
```

### utils/helper.js  
```javascript
// helper file contents
```
```

This ensures both baseline and variant prompts are evaluated against the same codebase context, providing fair and accurate comparison results.

## Best Practices

1. **Variable Naming**: Use UPPER_CASE for template variables
2. **Context Limits**: Keep repository context under 50 files for performance  
3. **Test Scenarios**: Write specific, actionable test scenarios
4. **Expert Definitions**: Ensure expert content matches the domain being tested
5. **Template Caching**: TemplateHelper automatically caches loaded templates
6. **Error Handling**: All template operations include fallback behavior