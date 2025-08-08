# Structured Response Options for Prompt Expert

## Option 1: Keep Current Natural Language (Current Implementation)
**Pros:**
- More readable for humans in PR comments
- Natural flow of expert analysis
- Already implemented and working

**Cons:**
- Parsing could fail if format varies
- Relies on specific text patterns

## Option 2: JSON Response Format
```json
{
  "decision": "SUGGEST",
  "score": 7.5,
  "analysis": "The prompt shows promise but needs enhancements...",
  "improvements": [
    "Add risk scoring system from 0-10",
    "Include alternative command suggestions",
    "Provide detailed examples for each risk category"
  ],
  "rationale": "While the basic structure is sound..."
}
```

**Implementation:**
```javascript
// In expert prompt:
content: `${expertDefinition}

[... evaluation instructions ...]

IMPORTANT: End your response with a JSON block in this exact format:
\`\`\`json
{
  "decision": "MERGE|REJECT|SUGGEST",
  "score": <0-10>,
  "improvements": ["improvement 1", "improvement 2"],
  "analysis": "your detailed analysis"
}
\`\`\``

// In parsing:
const jsonMatch = expertResponse.match(/```json\n([\s\S]+?)\n```/);
if (jsonMatch) {
  const result = JSON.parse(jsonMatch[1]);
  recommendation = result.decision === 'MERGE' ? 'APPROVE' : 
                  result.decision === 'REJECT' ? 'REQUEST_CHANGES' : 'SUGGEST';
  improvements = result.improvements || [];
}
```

## Option 3: Hybrid Approach (Recommended)
Keep natural language for readability but add structured section:

```javascript
content: `${expertDefinition}

[... evaluation instructions ...]

Provide your detailed analysis in natural language, then end with:

=== STRUCTURED DECISION ===
DECISION: SUGGEST
SCORE: 7.5/10
IMPROVEMENTS:
- Add risk scoring system
- Include alternative suggestions
- Provide more examples
=== END DECISION ===`
```

This gives us:
- Human-readable analysis
- Reliable parsing
- Clear structure without JSON complexity