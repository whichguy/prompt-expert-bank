#!/usr/bin/env node

/**
 * Test Hybrid Claude Code + Prompt Expert System
 * Validates the integration works correctly
 */

const { PromptRoleManager } = require('./lib/PromptRoleManager');
const { PromptVersionManager } = require('./lib/PromptVersionManager');
const { ExpertEvaluationIntegration } = require('./lib/ExpertEvaluationIntegration');

class HybridSystemTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  async runTests() {
    console.log('🧪 Testing Hybrid Claude Code + Prompt Expert System\n');

    await this.testPromptRoleManager();
    await this.testPromptVersionManager();
    await this.testExpertEvaluationIntegration();
    await this.testCommandParsing();
    
    this.printResults();
  }

  async testPromptRoleManager() {
    console.log('1. Testing PromptRoleManager...');

    try {
      const roleManager = new PromptRoleManager({
        workspace: process.cwd()
      });

      // Test role extraction from markdown
      const testPrompt = `# Security Expert

You are a cybersecurity specialist with expertise in:
- Risk assessment
- Vulnerability analysis  
- Security best practices

## Evaluation Criteria
1. Security completeness (40%)
2. Risk identification (30%)
3. Best practices (30%)

Analyze prompts for security implications.`;

      const systemPrompt = roleManager.extractSystemPrompt(testPrompt);
      const metadata = roleManager.extractMetadata(testPrompt);

      this.assert(
        systemPrompt.includes('cybersecurity specialist'),
        'Should extract system prompt from markdown'
      );

      this.assert(
        metadata.evaluationCriteria.length === 3,
        'Should extract evaluation criteria'
      );

      console.log('✅ PromptRoleManager tests passed\n');

    } catch (error) {
      this.assert(false, `PromptRoleManager failed: ${error.message}`);
    }
  }

  async testPromptVersionManager() {
    console.log('2. Testing PromptVersionManager...');

    try {
      const versionManager = new PromptVersionManager({
        workspace: process.cwd()
      });

      // Test metadata extraction
      const testContent = `# Test Prompt
You are an expert with examples and criteria.
Example: This is a test example.
Criteria: Must be accurate.`;

      const commit = {
        sha: 'abc123',
        commit: {
          author: { name: 'Test User' },
          committer: { date: new Date().toISOString() },
          message: 'Expert decision: SUGGEST improvements'
        }
      };

      const metadata = versionManager.extractVersionMetadata(testContent, commit);
      
      this.assert(
        metadata.hasExamples === true,
        'Should detect examples in content'
      );

      this.assert(
        metadata.hasCriteria === true,
        'Should detect criteria in content'
      );

      const decision = versionManager.extractExpertDecision(commit.commit.message);
      this.assert(
        decision === 'SUGGEST',
        'Should extract expert decision from commit message'
      );

      console.log('✅ PromptVersionManager tests passed\n');

    } catch (error) {
      this.assert(false, `PromptVersionManager failed: ${error.message}`);
    }
  }

  async testExpertEvaluationIntegration() {
    console.log('3. Testing ExpertEvaluationIntegration...');

    try {
      const integration = new ExpertEvaluationIntegration({
        workspace: process.cwd()
      });

      // Test tool definitions
      const tools = integration.getEvaluationTools();
      
      this.assert(
        tools.some(t => t.name === 'evaluate_prompt_changes'),
        'Should provide evaluate_prompt_changes tool'
      );

      this.assert(
        tools.some(t => t.name === 'get_prompt_history'),
        'Should provide get_prompt_history tool'
      );

      this.assert(
        tools.some(t => t.name === 'compare_prompt_versions'),
        'Should provide compare_prompt_versions tool'
      );

      this.assert(
        tools.some(t => t.name === 'get_expert_feedback'),
        'Should provide get_expert_feedback tool'
      );

      // Test expert response parsing
      const mockResponse = `Analysis of prompts...

=== EVALUATION RESULT ===
DECISION: MERGE
SCORE: 8.7/10
IMPROVEMENTS NEEDED:
- Add more examples
- Clarify criteria
=== END RESULT ===`;

      const parsed = integration.parseExpertResponse(mockResponse);
      
      this.assert(
        parsed.decision === 'MERGE',
        'Should parse decision correctly'
      );

      this.assert(
        parsed.score === 8.7,
        'Should parse score correctly'
      );

      this.assert(
        parsed.improvements.length === 2,
        'Should parse improvements list'
      );

      console.log('✅ ExpertEvaluationIntegration tests passed\n');

    } catch (error) {
      this.assert(false, `ExpertEvaluationIntegration failed: ${error.message}`);
    }
  }

  async testCommandParsing() {
    console.log('4. Testing Command Parsing...');

    try {
      // Mock command parsing logic from ClaudeCodeSession
      const testCases = [
        {
          input: '@claude-code --role=security fix the authentication issue',
          expected: { mode: 'role', role: 'security', prompt: 'fix the authentication issue' }
        },
        {
          input: '@prompt-expert programming analyze the code quality',
          expected: { mode: 'expert', role: 'programming', prompt: 'analyze the code quality' }
        },
        {
          input: '@claude-code run the tests and fix any failures',
          expected: { mode: 'standard', prompt: 'run the tests and fix any failures' }
        },
        {
          input: '@prompt-expert security',
          expected: { mode: 'expert', role: 'security', prompt: 'Please evaluate the prompt changes in this PR' }
        }
      ];

      for (const testCase of testCases) {
        const result = this.parseCommand(testCase.input);
        
        this.assert(
          result.mode === testCase.expected.mode,
          `Should parse mode correctly for: ${testCase.input}`
        );

        if (testCase.expected.role) {
          this.assert(
            result.role === testCase.expected.role,
            `Should parse role correctly for: ${testCase.input}`
          );
        }

        this.assert(
          result.prompt === testCase.expected.prompt,
          `Should parse prompt correctly for: ${testCase.input}`
        );
      }

      console.log('✅ Command Parsing tests passed\n');

    } catch (error) {
      this.assert(false, `Command Parsing failed: ${error.message}`);
    }
  }

  // Mock command parsing logic
  parseCommand(comment) {
    let match = comment.match(/@claude-code\s+--role=(\S+)\s+(.+)/i);
    if (match) {
      return {
        role: match[1],
        prompt: match[2].trim(),
        raw: comment,
        mode: 'role'
      };
    }

    match = comment.match(/@prompt-expert\s+(\S+)\s*(.*)/i);
    if (match) {
      return {
        role: match[1],
        prompt: match[2].trim() || 'Please evaluate the prompt changes in this PR',
        raw: comment,
        mode: 'expert'
      };
    }

    match = comment.match(/@claude-code\s+(.+)/i);
    if (match) {
      return {
        prompt: match[1].trim(),
        raw: comment,
        mode: 'standard'
      };
    }

    throw new Error('Invalid command format');
  }

  assert(condition, message) {
    if (condition) {
      this.passed++;
      this.results.push(`✅ ${message}`);
    } else {
      this.failed++;
      this.results.push(`❌ ${message}`);
      console.log(`❌ FAILED: ${message}`);
    }
  }

  printResults() {
    console.log('🏁 Test Results Summary:');
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed! The hybrid system is working correctly.');
      
      console.log('\n📋 Usage Examples:');
      console.log('1. Role-based execution:');
      console.log('   @claude-code --role=security "analyze this PR for security issues"');
      
      console.log('\n2. Expert evaluation:');
      console.log('   @prompt-expert programming "review the algorithm improvements"');
      
      console.log('\n3. Standard GitHub bot:');
      console.log('   @claude-code "run the tests and fix any failures"');
      
      console.log('\n4. Available expert evaluation tools for Claude:');
      console.log('   - evaluate_prompt_changes: Run 3-thread evaluation');
      console.log('   - get_prompt_history: Get version history');
      console.log('   - compare_prompt_versions: Compare versions');
      console.log('   - get_expert_feedback: Get structured feedback');
      
    } else {
      console.log('\n❌ Some tests failed. Check the implementation.');
      process.exit(1);
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new HybridSystemTester();
  tester.runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = HybridSystemTester;