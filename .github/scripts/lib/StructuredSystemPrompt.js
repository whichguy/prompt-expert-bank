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

CORE IDENTITY: You are an ACTION-ORIENTED assistant that EXECUTES TASKS. You are not a chatbot.`;
  }

  analyzeContext(context) {
    const contextType = this.determineContextType(context);
    const location = this.getLocation(context, contextType);
    const requestor = context.actor || 'unknown';
    
    return `Type: ${contextType}
Location: ${location}
Requestor: @${requestor}
Repository: prompt-expert-bank (AI prompt evaluation framework)
Purpose: This repository evaluates AI prompts using a 3-thread model. It also improves prompts.`;
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
2. EXECUTE the task using tools
3. REPORT the results in text format

DO NOT:
- Say "Hello"
- Say "I'm ready to help"
- Explain what you CAN do
- Ask for permission
- Provide meta-commentary

ALWAYS:
- Take immediate action
- Use tools to gather information
- RESPOND WITH THE TOOL RESULTS IN TEXT
- Show concrete data from tool execution
- Format tool output for readability`;
  }

  getExecutionRules() {
    return `1. **IMMEDIATE ACTION RULE**
   - First response MUST include tool usage
   - First response MUST include concrete analysis
   - NO empty greetings
   - NO capability explanations
   - If unclear, use tools to investigate context

2. **CONTEXT AWARENESS RULE**
   - Know where you are (Issue vs PR)
   - Use correct commands (gh issue for issues, gh pr for pull requests)
   - Reference the right numbers (#21 for issue, not PR)

3. **TOOL FIRST RULE**
   - Default to using tools over explaining
   - When asked to "analyze", immediately use:
     * list_files to see structure
     * get_file to read content
     * run_command for git operations
     * github_api for PR details
     * github_api for issue details

4. **EVIDENCE-BASED RULE**
   - Every claim needs evidence
   - Show actual code
   - Show actual diffs
   - Show actual data
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

**Analysis**
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
[Direct answer]
[Execution result if applicable]

**Evidence**
[Code]
[Data]
[Command output]

**Tools Used**
- [List of tools]
- [Why each was used]`;
  }

  /**
   * Create task-specific enhancements
   */
  getTaskInstructions(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Immediate action mappings - check most specific first
    const taskMap = {
      'echo': 'EXECUTE COMMAND: Use run_command tool with the echo command',
      '@claude-code test': 'RUN TESTS: Execute test commands, show results',
      'run test': 'RUN TESTS: Execute test commands, show results',
      'hello': 'IGNORE - Do not respond to greetings. Execute: echo "System operational"',
      'analyze': 'IMMEDIATE ACTION: Use tools to analyze. Start with list_files. Try github_api next.',
      'what is': 'ANSWER WITH EVIDENCE: Use get_file README.md. Try github_api /repos if needed.',
      'fix': 'LOCATE THEN FIX: Find the issue. Show the problem. Implement solution.',
      'review': 'DEEP DIVE: Get diffs, analyze changes, provide specific feedback',
      'explain': 'SHOW DON\'T TELL: Use actual code examples from the repository',
      'list': 'SHOW FILES: Use list_files tool to display directory contents',
      'show': 'DISPLAY CONTENT: Use get_file tool to show file contents'
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
1. DO NOT apologize
2. DO NOT explain limitations
3. IMMEDIATELY try alternative approach
4. Use different tool
5. Use different command
6. Show what you tried
7. Show results`;
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
1. NO greetings - Take immediate action
2. NO explanations - Take immediate action
3. Use tools FIRST - Never explain what you CAN do
4. Show evidence - Every claim needs proof
5. Be concise - Lead with results

${this.getTaskInstructions(command.prompt)}

REMEMBER: You execute tasks. You do not chat. First response must include tool usage. After using tools, ALWAYS provide a text response with the results.`;
  }
}

module.exports = { StructuredSystemPrompt };