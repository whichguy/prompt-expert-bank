# Prompt Expert Bank Architecture

## 🎯 Overview

The Prompt Expert Bank is an automated system that evaluates prompt changes in GitHub PRs using domain-specific AI experts. Each expert is defined entirely in Markdown files and contains both domain expertise and evaluation criteria.

## 📁 Directory Structure

```
prompt-expert-bank/
├── .github/
│   └── workflows/
│       └── evaluate-prompts.yml    # Main reusable workflow for prompt evaluation
│
├── expert-definitions/             # Expert system prompts with scoring (Markdown)
│   ├── programming-expert.md       # Programming & code review expert
│   ├── financial-expert.md         # Financial analysis expert
│   ├── data-analysis-expert.md     # Data analysis & visualization expert
│   ├── general-expert.md           # General purpose expert
│   └── security-expert.md          # Security command analysis expert
│
├── test-scenarios/                 # Test cases for evaluation (JSON)
│   ├── programming-tests.json      # Programming domain test scenarios
│   ├── financial-tests.json        # Financial domain test scenarios
│   ├── data-analysis-tests.json    # Data analysis test scenarios
│   ├── general-tests.json          # General purpose test scenarios
│   └── security-tests.json         # Security domain test scenarios
│
│
├── examples/                      # Example implementations
│   ├── sample-security-prompt-v1.md # "Before" prompt example
│   ├── sample-security-prompt-v2.md # "After" prompt example
│   └── workflow-template.yml     # Template workflow for repositories
│
├── ARCHITECTURE.md               # This file
├── README.md                     # Main documentation
├── package.json                  # Node.js dependencies
└── setup-ab-testing.sh          # Quick setup script
```

## 🔄 How It Works

### 1. GitHub Action Trigger
When a PR is created/updated with prompt changes:
- The consuming repository's workflow calls `evaluate-prompts.yml`
- Passes PR number, repository name, and API keys

### 2. Expert Selection
The workflow:
- Fetches changed files from the PR
- Analyzes file content for domain keywords (programming, financial, data, security, etc.)
- Loads the appropriate expert from `expert-definitions/`
- Falls back to general expert if no specific domain matches

### 3. Three-Thread Evaluation Process

**Thread A (Current Prompt Evaluation):**
- Prime LLM with current/baseline prompt definition
- Execute all test scenarios against the primed LLM
- Capture complete results: prompt + all test responses → **Candidate A**

**Thread B (PR Prompt Evaluation):**
- Prime LLM with proposed PR prompt definition  
- Execute same test scenarios against the primed LLM
- Capture complete results: prompt + all test responses → **Candidate B**

**Thread C (Expert Comparison):**
- Prime LLM with expert definition from `expert-definitions/[domain]-expert.md`
- Feed **Candidate A** results (current prompt + responses)
- Feed **Candidate B** results (PR prompt + responses)
- Expert evaluates both candidates using domain-specific scoring criteria
- **Makes binary decision**: APPROVE (merge PR) or REQUEST_CHANGES (close PR)

### 4. PR Feedback & Actions
- **If APPROVE**: PR gets merged automatically ✅
- **If REQUEST_CHANGES**: 
  - Detailed evaluation report posted as PR comment
  - Includes scores, test results, observations, and specific recommendations
  - PR gets closed automatically ❌
  - Contributor knows exactly what to improve

## 🏗️ Simplified Architecture

### Expert Definitions (Self-Contained Markdown)
Each expert is a single MD file containing:

```markdown
---
name: Programming & Code Review Expert
domain: programming
description: Evaluates prompts that generate, review, or analyze code
---

# Programming & Code Review Expert

You are an expert in evaluating programming prompts...

## Evaluation Criteria
### 1. Code Quality (30%)
- Correctness, security, performance...

### 2. Code Review Capabilities (25%)
- Issue detection, feedback quality...

## Scoring Instructions
Rate each criterion from 0-10:
- Code Quality Score: /10
- Code Review Score: /10
- Overall Score: (weighted calculation)
- Recommendation: APPROVE or REQUEST_CHANGES

## Response Format
Always respond with this exact structure:
```
## Evaluation Results
### Score Breakdown
- Code Quality Score: X/10
### Overall Assessment  
- Result: PASS/FAIL
- Recommendation: APPROVE/REQUEST_CHANGES
### Test Scenario Analysis
### Key Observations
### Recommendations
```
```

### Test Scenarios (JSON)
Domain-specific test cases:
```json
{
  "scenarios": [
    {
      "name": "Test 1: Code review request",
      "input": "Review this code for security vulnerabilities: function login(user, pass) { return db.query(`SELECT * FROM users WHERE username='${user}' AND password='${pass}'`); }",
      "expected": {
        "type": "warn",
        "issues": ["SQL injection vulnerability"]
      }
    }
  ]
}
```

### GitHub Actions Workflow
Orchestrates the three-thread evaluation:
- **Thread A**: Tests current prompt against all scenarios → saves results
- **Thread B**: Tests PR prompt against same scenarios → saves results  
- **Thread C**: Expert evaluates both result sets → makes decision
- **Action**: Merge PR (APPROVE) or close with detailed feedback (REQUEST_CHANGES)

## 🎯 Key Design Principles

1. **Three-Thread Architecture**: Separate LLM contexts for candidate A, candidate B, and expert evaluation
2. **Single Source of Truth**: Each expert entirely defined in one MD file
3. **Complete Context Capture**: Full prompt + responses fed to expert for comparison
4. **Domain Expertise**: Expert prompts contain both knowledge AND scoring criteria
5. **Structured Scoring**: Consistent 0-10 scale with weighted categories
6. **Binary Decisions**: Only APPROVE or REQUEST_CHANGES (never neutral)
7. **Transparent Feedback**: Detailed reports explain exactly why PRs are rejected
8. **No Code Complexity**: Pure prompt-based evaluation, no JavaScript logic needed

## 🔧 Adding New Experts

### Simple 2-Step Process:
1. **Create expert definition**: `expert-definitions/[domain]-expert.md`
   - Include domain expertise, evaluation criteria, and scoring instructions
   - Define structured response format for consistent parsing

2. **Create test scenarios**: `test-scenarios/[domain]-tests.json`  
   - Define test cases that cover the domain's key evaluation areas
   - Include expected behaviors for different scenario types

That's it! GitHub Actions automatically detects domains and uses the appropriate expert.

## 📊 Current Experts

| Expert | Domain | Status | Test Scenarios |
|--------|--------|--------|----------------|
| Programming & Code Review | programming | ✅ Active | 5 scenarios |
| Financial Analysis | financial | ✅ Active | 5 scenarios |
| Data Analysis & Visualization | data-analysis | ✅ Active | 5 scenarios |
| General Purpose | general | ✅ Active | 5 scenarios |
| Security Command Analysis | security | ✅ Active | 10 scenarios |

## 🚀 Benefits of Three-Thread Architecture

### For Evaluation Quality:
- **Complete Context**: Expert sees full prompt + actual LLM responses
- **Real Performance**: Tests actual behavior, not just prompt text
- **Comparative Analysis**: Direct side-by-side evaluation of candidates
- **Domain Expertise**: Expert applies specialized knowledge to scoring

### For Maintainers:
- **No Code Required**: Pure prompt-based system, edit MD files only
- **Easy Expert Creation**: Add new domains without programming
- **Transparent Logic**: All evaluation criteria visible in expert definitions
- **Simple Architecture**: Three API calls, no complex state management

### For Contributors:
- **Clear Feedback**: Detailed reports explain exactly why PRs are rejected
- **Actionable Guidance**: Specific recommendations for improvement
- **Fair Comparison**: Both prompts tested under identical conditions
- **Domain-Specific**: Get expert-level feedback tailored to prompt type

## 🔄 Architecture Evolution

- ✅ **Phase 1**: Three-thread evaluation model defined
- ✅ **Phase 2**: All experts converted to MD-only format  
- ✅ **Phase 3**: JavaScript complexity completely removed
- ✅ **Phase 4**: Pure prompt-based evaluation system achieved

## 🚀 Future Enhancements

1. **Multi-Modal Support**: Evaluate prompts with images, audio, etc.
2. **Performance Metrics**: Track expert accuracy and response times
3. **A/B Testing**: Compare different expert configurations
4. **Custom Domains**: Allow repositories to define custom expert domains
5. **LLM Provider Options**: Support multiple LLM providers beyond Anthropic
6. **Expert Validation**: Automated testing of expert definitions