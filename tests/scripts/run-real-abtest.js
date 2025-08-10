#!/usr/bin/env node

/**
 * Real A/B Test - Runs actual comparison between prompts
 */

const { ABTest } = require('../../scripts/abtest');
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize clients
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || process.env.GITHUB_PAT
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Test code with security issues
const TEST_CODE = `
function updateUserProfile(userId, data) {
  const query = "UPDATE users SET name='" + data.name + "' WHERE id=" + userId;
  db.execute(query);
  console.log("User updated: " + userId);
  return { success: true };
}
`;

async function runRealTest() {
  console.log('🔬 REAL A/B Test: Code Reviewer Prompt Comparison\n');
  console.log('=' .repeat(60) + '\n');
  
  try {
    // Read local files directly
    const baselinePrompt = fs.readFileSync('prompts/code-reviewer-baseline.md', 'utf8');
    const improvedPrompt = fs.readFileSync('prompts/code-reviewer-improved.md', 'utf8');
    const expertDef = fs.readFileSync('experts/code-review-expert.md', 'utf8');
    const evaluationTemplate = fs.readFileSync('templates/abtest-evaluation.md', 'utf8');
    
    console.log('📋 Files Loaded:');
    console.log('- Baseline prompt: ' + baselinePrompt.split('\n').length + ' lines');
    console.log('- Improved prompt: ' + improvedPrompt.split('\n').length + ' lines');
    console.log('- Expert definition: ' + expertDef.split('\n').length + ' lines');
    console.log('- Evaluation template: ' + evaluationTemplate.split('\n').length + ' lines\n');
    
    console.log('📝 Test Scenario - Code with Security Issues:');
    console.log(TEST_CODE);
    console.log('\n⏳ Running REAL A/B test with Claude API...\n');
    
    // Create test scenario
    const testScenario = `Review this JavaScript function and provide feedback:\n\n\`\`\`javascript\n${TEST_CODE}\n\`\`\``;
    
    // Run baseline prompt
    console.log('🔵 Testing BASELINE prompt...');
    const baselineStart = Date.now();
    const baselineResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: baselinePrompt + '\n\n' + testScenario
        }
      ]
    });
    const baselineLatency = Date.now() - baselineStart;
    const baselineResult = baselineResponse.content[0].text;
    
    console.log('✓ Baseline complete (' + baselineLatency + 'ms)\n');
    
    // Run improved prompt
    console.log('🟢 Testing IMPROVED prompt...');
    const improvedStart = Date.now();
    const improvedResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: improvedPrompt + '\n\n' + testScenario
        }
      ]
    });
    const improvedLatency = Date.now() - improvedStart;
    const improvedResult = improvedResponse.content[0].text;
    
    console.log('✓ Improved complete (' + improvedLatency + 'ms)\n');
    
    // Prepare evaluation
    console.log('🧪 Running expert evaluation...');
    
    // Build evaluation prompt
    let evalPrompt = evaluationTemplate
      .replace('{{EXPERT_DEFINITION}}', expertDef)
      .replace('{{TEST_SCENARIO}}', testScenario)
      .replace('{{BASELINE_RESPONSE}}', baselineResult)
      .replace('{{VARIANT_RESPONSE}}', improvedResult)
      .replace('{{BASELINE_PROMPT}}', baselinePrompt)
      .replace('{{VARIANT_PROMPT}}', improvedPrompt)
      .replace(/{{BASELINE_LATENCY}}/g, baselineLatency.toString())
      .replace(/{{VARIANT_LATENCY}}/g, improvedLatency.toString())
      .replace(/{{BASELINE_INPUT_TOKENS}}/g, baselineResponse.usage.input_tokens.toString())
      .replace(/{{BASELINE_OUTPUT_TOKENS}}/g, baselineResponse.usage.output_tokens.toString())
      .replace(/{{BASELINE_TOTAL_TOKENS}}/g, (baselineResponse.usage.input_tokens + baselineResponse.usage.output_tokens).toString())
      .replace(/{{VARIANT_INPUT_TOKENS}}/g, improvedResponse.usage.input_tokens.toString())
      .replace(/{{VARIANT_OUTPUT_TOKENS}}/g, improvedResponse.usage.output_tokens.toString())
      .replace(/{{VARIANT_TOTAL_TOKENS}}/g, (improvedResponse.usage.input_tokens + improvedResponse.usage.output_tokens).toString());
    
    const evalStart = Date.now();
    const evaluationResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: evalPrompt
        }
      ]
    });
    const evalLatency = Date.now() - evalStart;
    const evaluation = evaluationResponse.content[0].text;
    
    console.log('✓ Evaluation complete (' + evalLatency + 'ms)\n');
    
    // Display results
    console.log('=' .repeat(60));
    console.log('📊 PERFORMANCE METRICS');
    console.log('=' .repeat(60) + '\n');
    
    console.log('Baseline (A):');
    console.log(`  - Response Time: ${baselineLatency}ms`);
    console.log(`  - Tokens: ${baselineResponse.usage.input_tokens + baselineResponse.usage.output_tokens} total`);
    console.log(`    (${baselineResponse.usage.input_tokens} in, ${baselineResponse.usage.output_tokens} out)`);
    
    console.log('\nImproved (B):');
    console.log(`  - Response Time: ${improvedLatency}ms`);
    console.log(`  - Tokens: ${improvedResponse.usage.input_tokens + improvedResponse.usage.output_tokens} total`);
    console.log(`    (${improvedResponse.usage.input_tokens} in, ${improvedResponse.usage.output_tokens} out)`);
    
    const speedDiff = ((baselineLatency - improvedLatency) / baselineLatency * 100).toFixed(1);
    const tokenDiff = ((baselineResponse.usage.input_tokens + baselineResponse.usage.output_tokens - 
                       improvedResponse.usage.input_tokens - improvedResponse.usage.output_tokens) / 
                       (baselineResponse.usage.input_tokens + baselineResponse.usage.output_tokens) * 100).toFixed(1);
    
    console.log('\n📈 Comparison:');
    if (parseFloat(speedDiff) > 0) {
      console.log(`  ⚡ Improved is ${speedDiff}% FASTER`);
    } else {
      console.log(`  🐢 Improved is ${Math.abs(parseFloat(speedDiff))}% slower`);
    }
    
    if (parseFloat(tokenDiff) > 0) {
      console.log(`  💰 Improved uses ${tokenDiff}% FEWER tokens`);
    } else {
      console.log(`  📝 Improved uses ${Math.abs(parseFloat(tokenDiff))}% more tokens`);
    }
    
    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const reportPath = path.join(outputDir, `real-abtest-${timestamp}.md`);
    const fullReport = `# Real A/B Test Results

## Test Configuration
- Date: ${new Date().toISOString()}
- Model: claude-3-5-sonnet-20241022
- Temperature: 0.3 (responses), 0.2 (evaluation)

## Test Code
\`\`\`javascript
${TEST_CODE}
\`\`\`

## Performance Metrics

### Baseline (A)
- Response Time: ${baselineLatency}ms
- Total Tokens: ${baselineResponse.usage.input_tokens + baselineResponse.usage.output_tokens}
- Input Tokens: ${baselineResponse.usage.input_tokens}
- Output Tokens: ${baselineResponse.usage.output_tokens}

### Improved (B)
- Response Time: ${improvedLatency}ms  
- Total Tokens: ${improvedResponse.usage.input_tokens + improvedResponse.usage.output_tokens}
- Input Tokens: ${improvedResponse.usage.input_tokens}
- Output Tokens: ${improvedResponse.usage.output_tokens}

## Response A (Baseline)
${baselineResult}

## Response B (Improved)
${improvedResult}

## Expert Evaluation
${evaluation}
`;
    
    fs.writeFileSync(reportPath, fullReport);
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    
    // Extract winner from evaluation
    console.log('\n' + '=' .repeat(60));
    console.log('🏆 EVALUATION SUMMARY');
    console.log('=' .repeat(60) + '\n');
    
    // Parse evaluation for winner
    const winnerMatch = evaluation.match(/\*\*Winner:\*\*\s*([^\n]+)/i);
    const confidenceMatch = evaluation.match(/\*\*Confidence:\*\*\s*([^\n]+)/i);
    const rationaleMatch = evaluation.match(/\*\*Decision Rationale:\*\*\s*([^\n]+)/i);
    
    if (winnerMatch) {
      console.log('Winner: ' + winnerMatch[1]);
    }
    if (confidenceMatch) {
      console.log('Confidence: ' + confidenceMatch[1]);
    }
    if (rationaleMatch) {
      console.log('\nRationale: ' + rationaleMatch[1]);
    }
    
    // Look for key strengths
    if (evaluation.includes('Key Strengths')) {
      console.log('\nKey Strengths Identified:');
      const strengthsSection = evaluation.split('Key Strengths')[1].split('**')[0];
      const strengths = strengthsSection.split('\n').filter(s => s.trim().startsWith('-'));
      strengths.slice(0, 3).forEach(s => console.log('  ' + s.trim()));
    }
    
    console.log('\n✨ Real A/B test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Starting REAL A/B Test (not simulated)\n');
runRealTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});