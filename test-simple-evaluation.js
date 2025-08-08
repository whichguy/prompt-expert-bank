#!/usr/bin/env node

const { Anthropic } = require('@anthropic-ai/sdk');

async function simpleTest() {
  const anthropic = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
  });
  
  console.log('Running simple evaluation test...');
  console.log('API Key present:', !!process.env.ANTHROPIC_API_KEY);
  
  const baseline = `You are a helpful assistant. Please help with the user's request.`;
  const improved = `You are an expert code reviewer with deep knowledge of software engineering best practices.
  
When reviewing code:
1. Analyze for potential bugs and edge cases
2. Check for security vulnerabilities
3. Evaluate performance implications
4. Suggest improvements for readability
5. Ensure proper error handling`;

  const testScenario = "Review this function: function add(a, b) { return a + b; }";
  
  try {
    // Thread A: Baseline
    console.log('\nExecuting Thread A (baseline)...');
    const threadA = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `${baseline}\n\nNow respond to: "${testScenario}"`
      }]
    });
    
    // Thread B: Improved
    console.log('Executing Thread B (improved)...');
    const threadB = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `${improved}\n\nNow respond to: "${testScenario}"`
      }]
    });
    
    console.log('\n=== Thread A Response ===');
    console.log(threadA.content[0].text.substring(0, 200) + '...');
    
    console.log('\n=== Thread B Response ===');
    console.log(threadB.content[0].text.substring(0, 200) + '...');
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('authentication')) {
      console.error('Make sure ANTHROPIC_API_KEY is set correctly');
    }
  }
}

simpleTest();