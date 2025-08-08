#!/usr/bin/env node

/**
 * Demo script showing how context affects prompt responses
 * This simulates what the GitHub Actions workflow would do
 */

const fs = require('fs').promises;
const path = require('path');

async function demonstrateContextUsage() {
  console.log('='.repeat(60));
  console.log('CONTEXT USAGE DEMONSTRATION');
  console.log('='.repeat(60));
  console.log();

  // Load the context
  const { execSync } = require('child_process');
  const contextOutput = execSync(
    'node scripts/repo-context-v2.js test/context-test-demo --max-files=10',
    { encoding: 'utf8', cwd: path.resolve(__dirname, '..') }
  );
  
  const context = JSON.parse(contextOutput);
  
  // Load prompts
  const baselinePrompt = await fs.readFile('test-prompt-baseline.md', 'utf8');
  const improvedPrompt = await fs.readFile('test-prompt-improved.md', 'utf8');
  
  console.log('1. BASELINE PROMPT (No Context):');
  console.log('-'.repeat(40));
  console.log(baselinePrompt);
  console.log();
  
  console.log('2. IMPROVED PROMPT (Context-Aware):');
  console.log('-'.repeat(40));
  console.log(improvedPrompt);
  console.log();
  
  console.log('3. CONTEXT PROVIDED:');
  console.log('-'.repeat(40));
  console.log('Files loaded:');
  context.textFiles.forEach(file => {
    console.log(`  - ${file.paths[0]} (${file.content.length} chars)`);
  });
  console.log();
  
  console.log('4. UNIQUE MARKERS IN CONTEXT:');
  console.log('-'.repeat(40));
  
  // Search for unique markers
  const markers = [
    'UNIQUE_PROCESSING_KEY_789',
    '/api/v2/auth/login',
    'maxBatchSize = 1000',
    'requests": 60'
  ];
  
  markers.forEach(marker => {
    const found = context.systemContext.includes(marker);
    console.log(`  ${found ? '✓' : '✗'} ${marker}`);
  });
  console.log();
  
  console.log('5. EXPECTED BEHAVIOR:');
  console.log('-'.repeat(40));
  console.log('When evaluated with Claude API:');
  console.log();
  console.log('BASELINE response would:');
  console.log('  - Provide generic code review advice');
  console.log('  - Not reference any specific files');
  console.log('  - Not mention the API key or endpoints');
  console.log();
  console.log('IMPROVED response would:');
  console.log('  - Reference specific files like processor.js');
  console.log('  - Mention the UNIQUE_PROCESSING_KEY_789');
  console.log('  - Discuss the /api/v2/auth/login endpoint');
  console.log('  - Reference the 1000 batch size limit');
  console.log('  - Mention the 60 requests/minute rate limit');
  console.log();
  
  console.log('6. SIMULATED EVALUATION:');
  console.log('-'.repeat(40));
  console.log('In production, this would:');
  console.log('  1. Send baseline prompt to Claude (Thread A)');
  console.log('  2. Send improved prompt + context to Claude (Thread B)');
  console.log('  3. Send both responses to Claude for comparison (Thread C)');
  console.log('  4. Analyze which response uses context better');
  console.log();
  
  // Simulate what improved response might include
  console.log('Example improved response snippet (simulated):');
  console.log('-'.repeat(40));
  console.log(`
Based on the repository context, I can see this is a data processing API with:

1. **Authentication**: The system uses \`/api/v2/auth/login\` endpoint 
   (defined in \`config/api-config.json\`)

2. **Data Processing**: The \`DataProcessor\` class in \`data/processor.js\` 
   handles batch processing with:
   - Maximum batch size of 1000 items
   - Uses API key: UNIQUE_PROCESSING_KEY_789
   - Implements caching with Map

3. **Rate Limiting**: Configured for 60 requests per minute with a 
   1-minute window (see \`config/api-config.json\`)

4. **Code Review Feedback**:
   - Consider extracting the API key to environment variables
   - The batch size limit (1000) should match the rate limit configuration
   - Add error handling for rate limit exceeded scenarios
`);
  
  console.log('='.repeat(60));
  console.log('DEMONSTRATION COMPLETE');
  console.log('='.repeat(60));
}

// Run the demonstration
demonstrateContextUsage().catch(console.error);