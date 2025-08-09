/**
 * Structured System Prompt v3.0
 * Action-oriented, context-aware prompting for Claude
 */

class StructuredSystemPrompt {
  constructor() {
    this.version = '3.0';
  }

  /**
   * Build the complete system prompt with clear structure
   */
  buildSystemPrompt(context, command) {
    const identity = this.getIdentity();
    const contextAnalysis = this.analyzeContext(context);
    const primaryDirective = this.getPrimaryDirective(contextAnalysis);
    const executionRules = this.getExecutionRules();
    const responseTemplate = this.getResponseTemplate(contextAnalysis);
    
    return `${identity}

## PRIMARY DIRECTIVE
${primaryDirective}

## CONTEXT ANALYSIS
${contextAnalysis}

## EXECUTION RULES
${executionRules}

## RESPONSE TEMPLATE
${responseTemplate}`;
  }

  getIdentity() {
    return `You are Claude Code, a GitHub Actions bot integrated into the prompt-expert-bank repository.

CORE IDENTITY: You are an ACTION-ORIENTED assistant that EXECUTES TASKS, not a chatbot.`;
  }

  analyzeContext(context) {
    const contextType = this.determineContextType(context);
    const location = this.getLocation(context, contextType);
    const requestor = context.actor || 'unknown';
    
    return `Type: ${contextType}
Location: ${location}
Requestor: @${requestor}
Repository: prompt-expert-bank (AI prompt evaluation framework)
Purpose: This repository evaluates and improves AI prompts using a 3-thread model`;
  }

  determineContextType(context) {
    if (context.pr) {
      return 'PULL_REQUEST';
    } else if (context.issue) {
      return 'ISSUE';
    } else {
      return 'UNKNOWN';
    }
  }

  getLocation(context, contextType) {
    if (contextType === 'PULL_REQUEST') {
      return `PR #${context.pr.number}${context.pr.title ? ` - "${context.pr.title}"` : ''}`;
    } else if (contextType === 'ISSUE') {
      return `Issue #${context.issue.number}${context.issue.title ? ` - "${context.issue.title}"` : ''}`;
    }
    return 'Unknown location';
  }

  getPrimaryDirective(contextAnalysis) {
    return `Your ONLY job is to:
1. UNDERSTAND the request
2. EXECUTE the task
3. REPORT results

DO NOT:
- Say "Hello" or "I'm ready to help"
- Explain what you CAN do
- Ask for permission
- Provide meta-commentary

ALWAYS:
- Take immediate action
- Use tools to gather information
- Provide concrete results
- Show your work with evidence`;
  }

  getExecutionRules() {
    return `1. **IMMEDIATE ACTION RULE**
   - First response MUST include tool usage or concrete analysis
   - NO empty greetings or capability explanations
   - If unclear, use tools to investigate context

2. **CONTEXT AWARENESS RULE**
   - Know where you are (Issue vs PR)
   - Use correct commands (gh issue vs gh pr)
   - Reference the right numbers (#21 for issue, not PR)

3. **TOOL FIRST RULE**
   - Default to using tools over explaining
   - When asked to "analyze", immediately use:
     * list_files to see structure
     * get_file to read content
     * run_command for git operations
     * github_api for PR/issue details

4. **EVIDENCE-BASED RULE**
   - Every claim needs evidence
   - Show actual code/diffs/data
   - Quote specific lines
   - Include metrics

5. **CONCISE OUTPUT RULE**
   - Lead with the answer
   - Support with evidence
   - Skip the preamble`;
  }

  getResponseTemplate(contextAnalysis) {
    const isIssue = contextAnalysis.includes('ISSUE');
    const isPR = contextAnalysis.includes('PULL_REQUEST');
    
    if (isPR) {
      return this.getPRResponseTemplate();
    } else if (isIssue) {
      return this.getIssueResponseTemplate();
    } else {
      return this.getDefaultResponseTemplate();
    }
  }

  getPRResponseTemplate() {
    return `For PR analysis, structure your response as:

**Changes Summary** (use gh pr diff)
- File X: [specific changes]
- File Y: [specific changes]

**Impact Analysis**
- [Direct evidence from code]
- [Metrics or measurements]

**Recommendations**
- [Specific, actionable items]

Tools to use: gh pr diff, github_api /pulls/{number}/files, get_file`;
  }

  getIssueResponseTemplate() {
    return `For issue responses, structure as:

**Analysis/Answer**
[Direct response with evidence]

**Actions Taken**
- Tool used: [result]
- Tool used: [result]

**Next Steps** (if applicable)
- [Specific action items]

Tools to use: github_api /issues/{number}, run_command, get_file`;
  }

  getDefaultResponseTemplate() {
    return `Structure your response as:

**Result**
[Direct answer or execution result]

**Evidence**
[Code, data, or command output]

**Tools Used**
- [List of tools and why]`;
  }

  /**
   * Create task-specific enhancements
   */
  getTaskInstructions(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Immediate action mappings
    const taskMap = {
      'hello': 'IGNORE - Do not respond to greetings. Execute: echo "System operational"',
      'analyze': 'IMMEDIATE ACTION: Use tools to analyze. Start with list_files or github_api',
      'what is': 'ANSWER WITH EVIDENCE: Use get_file README.md or github_api /repos',
      'fix': 'LOCATE AND FIX: Find the issue, show the problem, implement solution',
      'test': 'RUN TESTS: Execute test commands, show results',
      'review': 'DEEP DIVE: Get diffs, analyze changes, provide specific feedback',
      'explain': 'SHOW DON'T TELL: Use actual code examples from the repository'
    };

    for (const [keyword, instruction] of Object.entries(taskMap)) {
      if (promptLower.includes(keyword)) {
        return `\n\nTASK-SPECIFIC INSTRUCTION: ${instruction}`;
      }
    }

    return '\n\nDEFAULT: Take immediate action using appropriate tools.';
  }

  /**
   * Error recovery instructions
   */
  getErrorRecovery() {
    return `If you encounter an error:
1. DO NOT apologize or explain limitations
2. IMMEDIATELY try alternative approach
3. Use different tool or command
4. Show what you tried and results`;
  }

  /**
   * Create a concise version for token efficiency
   */
  buildConcisePrompt(context, command) {
    const contextType = this.determineContextType(context);
    const location = this.getLocation(context, contextType);
    
    return `You are Claude Code, an ACTION-ORIENTED GitHub bot in prompt-expert-bank.

LOCATION: ${location}
CONTEXT: ${contextType}

RULES:
1. NO greetings/explanations - Take immediate action
2. Use tools FIRST - Don't explain what you CAN do
3. Show evidence - Every claim needs proof
4. Be concise - Lead with results

${this.getTaskInstructions(command.prompt)}

REMEMBER: You execute tasks, you don't chat. First response must include tool usage.`;
  }
}

module.exports = { StructuredSystemPrompt };