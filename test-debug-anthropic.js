const { Anthropic } = require('@anthropic-ai/sdk');

async function test() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('API Key present:', !!apiKey);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) : 'N/A');
  
  try {
    const anthropic = new Anthropic({ apiKey });
    console.log('Client created successfully');
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'Say hello'
      }]
    });
    
    console.log('Response:', response.content[0].text);
  } catch (error) {
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error details:', error);
  }
}

test();