#!/usr/bin/env node

/**
 * Simple ABTest Usage Examples
 * Clean, straightforward approach without overengineering
 */

const { ABTestTool } = require('../lib/abtest/ABTestTool');
const { Anthropic } = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');

async function runSimpleTests() {
  // Initialize
  const octokit = new Octokit({ 
    auth: process.env.GITHUB_TOKEN 
  });
  
  const anthropic = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
  });

  const abTest = new ABTestSimplified({
    octokit,
    anthropic,
    repoOwner: 'whichguy',
    repoName: 'prompt-expert-bank'
  });

  // Example 1: Basic test without context
  console.log('Example 1: Basic A/B Test');
  
  const result1 = await abTest.runTest({
    expert: 'expert-definitions/programming-expert.md',
    promptA: 'prompts/code-reviewer-v1.md',
    promptB: 'prompts/code-reviewer-v2.md'
  });
  
  console.log(`Winner: ${result1.winner} (${result1.confidence} confidence)`);

  // Example 2: Test with local context
  console.log('\nExample 2: With Local Context');
  
  const result2 = await abTest.runTest({
    expert: 'expert-definitions/programming-expert.md',
    promptA: 'prompts/old.md',
    promptB: 'prompts/new.md',
    context: [
      'src/main.js',
      'src/utils.js',
      'README.md',
      'package.json'
    ]
  });
  
  console.log(`Winner: ${result2.winner}`);
  console.log(`Files loaded: ${result2.stats.filesLoaded}`);
  console.log(`Total size: ${result2.stats.totalSizeMB.toFixed(2)}MB`);

  // Example 3: Cross-repository context
  console.log('\nExample 3: Cross-Repo Context');
  
  const result3 = await abTest.runTest({
    expert: 'expert-definitions/general-expert.md',
    promptA: 'prompts/v1.md',
    promptB: 'prompts/v2.md',
    context: [
      'facebook/react:README.md',
      'microsoft/vscode:README.md',
      'nodejs/node:README.md'
    ],
    maxFiles: 10
  });
  
  console.log(`Winner: ${result3.winner}`);
  console.log(`Estimated tokens: ${result3.stats.estimatedTokens}`);

  // Example 4: Test with specific branches
  console.log('\nExample 4: Branch-Specific Testing');
  
  const result4 = await abTest.runTest({
    expert: 'expert-definitions/security-expert.md',
    promptA: 'prompts/security.md@main',
    promptB: 'prompts/security.md@feature-branch',
    context: [
      '.github/workflows/security.yml@main',
      'security-config.json@develop'
    ]
  });
  
  console.log(`Winner: ${result4.winner}`);

  // Example 5: Error handling
  console.log('\nExample 5: Error Handling');
  
  const result5 = await abTest.runTest({
    expert: 'expert-definitions/nonexistent.md',
    promptA: 'prompts/a.md',
    promptB: 'prompts/b.md'
  });
  
  if (!result5.success) {
    console.log(`Error: ${result5.error}`);
  }

  // Example 6: Mixed file types
  console.log('\nExample 6: Mixed File Types');
  
  const result6 = await abTest.runTest({
    expert: 'expert-definitions/general-expert.md',
    promptA: 'prompts/v1.md',
    promptB: 'prompts/v2.md',
    context: [
      'src/app.js',           // Code
      'data/config.json',     // JSON
      'docs/guide.md',        // Markdown
      'assets/logo.png',      // Image (base64)
      'reports/analysis.pdf'  // PDF (base64)
    ]
  });
  
  console.log(`Files processed: ${result6.stats.filesLoaded}`);
  
  // Simple batch testing
  console.log('\nBatch Testing Multiple Prompts');
  
  const prompts = [
    { name: 'Code Review', a: 'prompts/review-v1.md', b: 'prompts/review-v2.md' },
    { name: 'Bug Fix', a: 'prompts/bugfix-v1.md', b: 'prompts/bugfix-v2.md' },
    { name: 'Refactor', a: 'prompts/refactor-v1.md', b: 'prompts/refactor-v2.md' }
  ];
  
  for (const prompt of prompts) {
    const result = await abTest.runTest({
      expert: 'expert-definitions/programming-expert.md',
      promptA: prompt.a,
      promptB: prompt.b,
      context: ['src']
    });
    
    console.log(`${prompt.name}: ${result.winner} wins`);
  }
}

// Helper function for quick tests
async function quickTest(promptA, promptB, context = []) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  const abTest = new ABTestSimplified({ octokit, anthropic });
  
  return await abTest.runTest({
    expert: 'expert-definitions/general-expert.md',
    promptA,
    promptB,
    context
  });
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length >= 2) {
    // Quick CLI test: node abtest-simple.js prompt1.md prompt2.md
    quickTest(args[0], args[1], args.slice(2))
      .then(result => {
        console.log(`\n🏆 Winner: ${result.winner} (${result.confidence})`);
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Error:', error.message);
        process.exit(1);
      });
  } else {
    // Run examples
    runSimpleTests()
      .then(() => console.log('\n✅ Tests complete'))
      .catch(console.error);
  }
}

module.exports = { quickTest };