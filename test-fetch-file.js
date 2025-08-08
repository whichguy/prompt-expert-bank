const { Octokit } = require('@octokit/rest');

async function test() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  try {
    const { data } = await octokit.repos.getContent({
      owner: 'whichguy',
      repo: 'prompt-expert-bank',
      path: 'test-prompt-improved.md',
      ref: 'test-full-context-evaluation'
    });
    
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    console.log('File found\! First 100 chars:', content.substring(0, 100));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
