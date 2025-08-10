#!/usr/bin/env node

/**
 * PR Comparison Script - Runs A/B test between main and PR branch prompts
 */

const { ABTest } = require('./scripts/abtest');
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

// Test code with security issues for the code review
const TEST_CODE = `
function updateUserProfile(userId, data) {
  const query = "UPDATE users SET name='" + data.name + "' WHERE id=" + userId;
  db.execute(query);
  console.log("User updated: " + userId);
  return { success: true };
}
`;

async function runComparison() {
  console.log('🔬 A/B Test: Code Reviewer Prompt Comparison\n');
  console.log('=' .repeat(60) + '\n');
  
  try {
    const abTest = new ABTest({
      octokit,
      anthropic,
      owner: 'whichguy',
      repo: 'prompt-expert-bank'
    });

    // Configuration matching the PR request
    const config = {
      expert: 'experts/code-review-expert.md',
      promptA: 'prompts/code-reviewer-baseline.md',
      promptB: 'prompts/code-reviewer-improved.md',
      context: [
        'scripts/abtest.js',
        'templates/abtest-evaluation.md'
      ],
      testScenario: `Review this JavaScript function and provide feedback:\n\n\`\`\`javascript\n${TEST_CODE}\n\`\`\``
    };

    console.log('📋 Configuration:');
    console.log('- Expert:', config.expert);
    console.log('- Baseline (A):', config.promptA);
    console.log('- Variant (B):', config.promptB);
    console.log('- Context Files:', config.context.length);
    console.log('\n📝 Code to Review:');
    console.log(TEST_CODE);
    console.log('\n⏳ Running A/B test evaluation...\n');

    const result = await abTest.run(config);

    if (result.success) {
      console.log('✅ Evaluation Complete!\n');
      console.log('=' .repeat(60));
      console.log('🏆 RESULTS');
      console.log('=' .repeat(60) + '\n');
      
      console.log(`Winner: ${result.winner === 'variant' ? '🎉 IMPROVED VERSION (B)' : '😐 BASELINE VERSION (A)'}`);
      console.log(`Confidence: ${result.confidence.toUpperCase()}\n`);
      
      if (result.threads) {
        console.log('📊 Performance Metrics:');
        if (result.metrics) {
          const baseline = result.metrics.baseline;
          const variant = result.metrics.variant;
          
          console.log('\nBaseline (A):');
          console.log(`  - Response Time: ${baseline.latency}ms`);
          console.log(`  - Tokens Used: ${baseline.totalTokens} (${baseline.inputTokens} in, ${baseline.outputTokens} out)`);
          
          console.log('\nVariant (B):');
          console.log(`  - Response Time: ${variant.latency}ms`);
          console.log(`  - Tokens Used: ${variant.totalTokens} (${variant.inputTokens} in, ${variant.outputTokens} out)`);
          
          // Calculate improvements
          const speedDiff = ((baseline.latency - variant.latency) / baseline.latency * 100).toFixed(1);
          const tokenDiff = ((baseline.totalTokens - variant.totalTokens) / baseline.totalTokens * 100).toFixed(1);
          
          console.log('\n📈 Comparison:');
          if (speedDiff > 0) {
            console.log(`  ⚡ Variant is ${speedDiff}% FASTER`);
          } else {
            console.log(`  🐢 Variant is ${Math.abs(speedDiff)}% slower`);
          }
          
          if (tokenDiff > 0) {
            console.log(`  💰 Variant uses ${tokenDiff}% FEWER tokens`);
          } else {
            console.log(`  📝 Variant uses ${Math.abs(tokenDiff)}% more tokens`);
          }
        }
        
        // Save detailed results
        const fs = require('fs');
        const outputDir = 'test-results';
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir);
        }
        
        // Save full evaluation
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const evalPath = `${outputDir}/pr-comparison-${timestamp}.md`;
        
        const fullReport = `# Code Reviewer Prompt A/B Test Results

## Test Configuration
- Date: ${new Date().toISOString()}
- Expert: ${config.expert}
- Baseline: ${config.promptA}
- Variant: ${config.promptB}

## Test Code
\`\`\`javascript
${TEST_CODE}
\`\`\`

## Results Summary
- **Winner**: ${result.winner === 'variant' ? 'IMPROVED VERSION (Variant B)' : 'BASELINE VERSION (A)'}
- **Confidence**: ${result.confidence}

## Performance Metrics
${JSON.stringify(result.metrics, null, 2)}

## Full Evaluation

${result.threads.evaluation}

## Response A (Baseline)
${result.threads.baseline}

## Response B (Variant)
${result.threads.variant}
`;
        
        fs.writeFileSync(evalPath, fullReport);
        console.log(`\n📄 Full report saved to: ${evalPath}`);
        
        // Extract key insights from evaluation
        console.log('\n🔍 Key Insights from Evaluation:');
        const evalText = result.threads.evaluation.toLowerCase();
        
        if (evalText.includes('security')) {
          console.log('  ✓ Security considerations were evaluated');
        }
        if (evalText.includes('sql injection')) {
          console.log('  ✓ SQL injection vulnerability was assessed');
        }
        if (evalText.includes('feedback') && evalText.includes('constructive')) {
          console.log('  ✓ Feedback quality and tone were compared');
        }
        if (evalText.includes('actionable')) {
          console.log('  ✓ Actionability of suggestions was considered');
        }
      }
      
      console.log('\n' + '=' .repeat(60));
      console.log('📌 RECOMMENDATION');
      console.log('=' .repeat(60) + '\n');
      
      if (result.winner === 'variant' && result.confidence !== 'low') {
        console.log('✅ The improved version shows significant advantages.');
        console.log('   Recommend MERGING this PR to enhance code review quality.');
      } else if (result.winner === 'baseline') {
        console.log('⚠️  The baseline version performed better.');
        console.log('   Consider revising the improvements before merging.');
      } else {
        console.log('🤔 Results are inconclusive (low confidence).');
        console.log('   Additional testing or refinement may be needed.');
      }
      
    } else {
      console.error('❌ Test failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the comparison
console.log('🚀 Starting PR Comparison Test\n');
runComparison().then(() => {
  console.log('\n✨ Comparison complete!');
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});