#!/usr/bin/env node

/**
 * Test script for ABTest functionality
 * Tests the evaluation template with programming prompts
 */

const { ABTest } = require('../../scripts/abtest');
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

// Initialize clients
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || process.env.GITHUB_PAT
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function runTest() {
  console.log('🧪 Testing ABTest functionality with programming prompts\n');
  console.log('Repository: whichguy/prompt-expert-bank');
  console.log('=====================================\n');

  try {
    // Initialize ABTest
    const abTest = new ABTest({
      octokit,
      anthropic,
      owner: 'whichguy',
      repo: 'prompt-expert-bank'
    });

    // Test configuration using repository paths
    const testConfig = {
      expert: 'experts/programming-expert.md',
      promptA: 'test-prompts/programming-baseline.md', 
      promptB: 'test-prompts/programming-variant.md',
      context: [
        'scripts/abtest.js',
        'scripts/template-helper.js',
        'templates/abtest-evaluation.md'
      ],
      testScenario: 'Create a robust email validation function'
    };

    console.log('📋 Test Configuration:');
    console.log('- Expert:', testConfig.expert);
    console.log('- Baseline Prompt:', testConfig.promptA);
    console.log('- Variant Prompt:', testConfig.promptB);
    console.log('- Context Files:', testConfig.context.length, 'files');
    console.log('- Test Scenario:', testConfig.testScenario);
    console.log('\n⏳ Running A/B test evaluation...\n');

    // Run the test
    const result = await abTest.run(testConfig);

    if (result.success) {
      console.log('✅ Test completed successfully!\n');
      console.log('📊 Results:');
      console.log('- Winner:', result.winner);
      console.log('- Confidence:', result.confidence);
      
      if (result.threads) {
        console.log('\n📝 Thread Responses Available:');
        console.log('- Baseline response length:', result.threads.baseline?.length || 0, 'chars');
        console.log('- Variant response length:', result.threads.variant?.length || 0, 'chars');
        console.log('- Evaluation length:', result.threads.evaluation?.length || 0, 'chars');
        
        // Save evaluation to file for review
        const fs = require('fs');
        const outputPath = 'test-results/evaluation-output.md';
        
        // Create test-results directory if it doesn't exist
        if (!fs.existsSync('test-results')) {
          fs.mkdirSync('test-results');
        }
        
        const output = `# A/B Test Evaluation Results
        
## Test Configuration
- **Date**: ${new Date().toISOString()}
- **Expert**: ${testConfig.expert}
- **Baseline**: ${testConfig.promptA}
- **Variant**: ${testConfig.promptB}
- **Winner**: ${result.winner}
- **Confidence**: ${result.confidence}

## Metrics
${JSON.stringify(result.metrics, null, 2)}

## Evaluation

${result.threads.evaluation}

## Baseline Response
${result.threads.baseline}

## Variant Response
${result.threads.variant}
`;
        
        fs.writeFileSync(outputPath, output);
        console.log('\n📄 Full evaluation saved to:', outputPath);
      }
      
      if (result.metrics) {
        console.log('\n⚡ Performance Metrics:');
        console.log('Baseline:', result.metrics.baseline);
        console.log('Variant:', result.metrics.variant);
      }
      
    } else {
      console.error('❌ Test failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error running test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runTest().then(() => {
  console.log('\n✨ Test complete!');
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});