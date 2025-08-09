# Thread Evaluation Template

## Prompt Priming
You are primed with this prompt definition:

{{PROMPT_CONTENT}}

{{#if CONTEXT_AVAILABLE}}
## Repository Context
You have access to the following repository files and content:

{{CONTEXT_CONTENT}}

Use this repository context to inform your response where relevant.
{{/if}}

## Test Scenario
Now respond to this test scenario: "{{TEST_SCENARIO}}"

## Instructions
- Follow the prompt definition exactly as specified
- Apply the prompt's guidelines to the test scenario
{{#if CONTEXT_AVAILABLE}}
- Utilize the provided repository context when relevant to your response
- Reference specific files, functions, or patterns from the repository as appropriate
{{/if}}
- Provide a complete response as if you were implementing the prompt in production
- Maintain consistency with the prompt's intended behavior and tone