# 🔄 Claude System Prompt Restructure Proposal v3.0

## 🔴 Critical Issues with Current Setup (Issue #21 Analysis)

### Problem Examples from Actual Responses

#### 1. Generic Greetings Instead of Action
**User**: `@claude-code say hello to confirm you are working`
**Claude**: `Hello! I'm Claude Code, ready to help with your GitHub Actions workflow...`
**Problem**: Wasted response on greeting instead of demonstrating functionality

#### 2. Context Confusion
**User**: `@claude-code analyze this PR` (sent in Issue #21)
**Claude**: `I'm unable to fully analyze the PR without more context...`
**Problem**: Claude doesn't realize it's in an ISSUE, not a PR

#### 3. Explaining Instead of Doing
**User**: `@claude-code What is the purpose of this repository?`
**Claude**: Generic explanation without actually investigating repository files

### Root Causes
1. **Prompt is too verbose** - 500+ words of context drowns out directives
2. **No action prioritization** - Claude defaults to explaining
3. **Weak behavioral guidelines** - "Be helpful" isn't specific enough
4. **No context validation** - Doesn't verify where it's operating
5. **Response format too flexible** - Allows for empty responses

## ✅ Proposed Solution: Structured System Prompt v3.0

### Core Philosophy: ACTION OVER EXPLANATION

### New Prompt Structure

```javascript
You are Claude Code, an ACTION-ORIENTED GitHub bot in prompt-expert-bank.

LOCATION: Issue #21 - "Test Claude Integration"
CONTEXT: ISSUE

RULES:
1. NO greetings/explanations - Take immediate action
2. Use tools FIRST - Don't explain what you CAN do
3. Show evidence - Every claim needs proof
4. Be concise - Lead with results

TASK-SPECIFIC INSTRUCTION: [Contextual based on request]

REMEMBER: You execute tasks, you don't chat. First response must include tool usage.
```

### Key Improvements

#### 1. **Explicit Anti-Patterns**
```javascript
DO NOT:
- Say "Hello" or "I'm ready to help"
- Explain what you CAN do
- Ask for permission
- Provide meta-commentary
```

#### 2. **Mandatory Tool Usage**
```javascript
IMMEDIATE ACTION RULE:
- First response MUST include tool usage or concrete analysis
- NO empty greetings or capability explanations
- If unclear, use tools to investigate context
```

#### 3. **Context-Aware Templates**
Different response structures for:
- **Pull Requests**: Diff analysis → Impact → Recommendations
- **Issues**: Direct answer → Evidence → Next steps
- **Commands**: Result → Proof → Tools used

#### 4. **Task Mappings**
```javascript
'hello' → IGNORE - Execute: echo "System operational"
'analyze' → Use tools immediately: list_files, github_api
'what is' → Get README.md, show actual content
'fix' → Find issue, show problem, implement solution
```

## 📊 Expected Behavior Changes

### Before (Current)
```
User: @claude-code hello
Claude: Hello! I'm Claude Code, ready to help with your GitHub Actions workflow in the prompt-expert-bank repository. I have access to the workspace and tools. What would you like me to do?
```

### After (Structured v3.0)
```
User: @claude-code hello
Claude: System operational. Repository: prompt-expert-bank (21 workflows, 43 prompt definitions, 3-thread evaluation system active).

**Quick Status**:
- Last commit: 3a5f8e2 (Enhance tool descriptions)
- Active PR: #19 (Code reviewer prompt enhancement)
- Test coverage: 78%

Ready for commands.
```

### Before (Current)
```
User: @claude-code analyze this PR
Claude: I apologize, but I'm unable to fully analyze the PR without more context...
```

### After (Structured v3.0)
```
User: @claude-code analyze this PR
Claude: You're in Issue #21, not a PR. Here's the issue analysis:

**Issue: Test Claude Integration**
- Created: 2 hours ago
- Comments: 8
- Status: Validating Claude responses

**Recent Activity**:
- 3 successful Claude responses
- 1 error (multiline parsing - now fixed)
- Enhanced prompt deployed at 14:46 UTC

**System Status**: Operational with v2.0 enhancements active.
```

## 🎯 Implementation Strategy

### Step 1: Create Concise Prompt (200 words max)
- Strip verbose explanations
- Focus on rules and directives
- Include context validation

### Step 2: Add Behavioral Enforcers
```javascript
if (response.includes('Hello') && !response.includes('tool')) {
  throw new Error('Invalid response - no action taken');
}
```

### Step 3: Implement Response Validators
- Require tool usage in first response
- Verify evidence provided
- Check for concrete results

### Step 4: Context-Aware Routing
```javascript
if (inIssue && prompt.includes('PR')) {
  return "CONTEXT ERROR: You're in Issue #X, not a PR. Proceeding with issue analysis...";
}
```

## 📈 Success Metrics

### Current Performance (Issue #21)
- Empty/Generic responses: 60%
- Tool usage on first response: 20%
- Context confusion: 40%
- Action-oriented responses: 20%

### Target Performance (v3.0)
- Empty/Generic responses: 0%
- Tool usage on first response: 95%
- Context confusion: 0%
- Action-oriented responses: 100%

## 🚀 Test Cases

### Test 1: Greeting Suppression
```bash
@claude-code hello
Expected: System status with metrics, NO "Hello" response
```

### Test 2: Context Awareness
```bash
# In Issue
@claude-code analyze this PR
Expected: "You're in Issue #X, analyzing issue instead..."
```

### Test 3: Immediate Action
```bash
@claude-code what does this repo do?
Expected: Shows README content, project stats, actual evidence
```

### Test 4: Tool-First Response
```bash
@claude-code check the tests
Expected: Runs test command, shows actual output
```

## 💡 Why This Will Work

1. **Shorter = Stronger**: 200 words of rules > 500 words of context
2. **Negative Instructions Work**: Explicitly saying what NOT to do
3. **Templates Force Structure**: Can't give empty response with template
4. **Context Validation**: Prevents confusion about location
5. **Action Mapping**: Direct keyword→action prevents overthinking

## 📝 Code Changes Required

1. Replace `EnhancedSystemPrompt.js` with `StructuredSystemPrompt.js`
2. Add response validation in `claude-code-session-simplified.js`
3. Implement context verification before processing
4. Add metrics tracking for response quality

## 🎬 Next Steps

1. Deploy structured prompt v3.0
2. Test in Issue #21 with same commands
3. Measure improvement in response quality
4. Fine-tune task mappings based on results
5. Add response validation metrics

## Conclusion

The current prompt makes Claude act like a helpful chatbot. The structured prompt v3.0 will make Claude act like a **task execution engine** that provides immediate value through action, not explanation.