const { Anthropic } = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function processCommand() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  const domain = process.env.DOMAIN;
  const suggestion = process.env.SUGGESTION;
  const issueNumber = parseInt(process.env.ISSUE_NUMBER);
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const author = process.env.COMMENT_AUTHOR;
  
  console.log(`Processing command for domain: ${domain}`);
  console.log(`Suggestion: ${suggestion}`);
  
  try {
    // Get PR files
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: issueNumber
    });
    
    const promptFiles = files.filter(f => 
      f.filename.includes('prompt') && 
      (f.filename.endsWith('.md') || f.filename.endsWith('.txt'))
    );
    
    if (promptFiles.length === 0) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: '❌ No prompt files found in this PR'
      });
      return;
    }
    
    // Process the first prompt file
    const targetFile = promptFiles[0];
    const currentContent = await fs.readFile(targetFile.filename, 'utf-8');
    
    // Load expert definition if available
    let expertContext = '';
    try {
      const expertPath = path.join(__dirname, '..', 'expert-definitions', `${domain}-expert.md`);
      expertContext = await fs.readFile(expertPath, 'utf-8');
      console.log(`Loaded ${domain} expert definition`);
    } catch (err) {
      console.log(`Using generic ${domain} expert context`);
      expertContext = `You are a ${domain} expert focused on improving prompts in this domain.`;
    }
    
    // Use Claude to implement the suggestion
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a prompt engineering expert. Your task is to improve a prompt based on specific suggestions.

## Expert Context
${expertContext}

## Current Prompt
${currentContent}

## Requested Improvement
"${suggestion}"

Please rewrite the entire prompt incorporating the requested suggestion. Make sure to:
1. Maintain the overall structure and purpose
2. Fully implement the requested suggestion
3. Keep the prompt clear and effective

Return ONLY the complete updated prompt content, no explanations.`
      }]
    });
    
    const updatedContent = response.content[0].text;
    
    // Write the updated content
    await fs.writeFile(targetFile.filename, updatedContent);
    
    // Commit and push changes
    execSync('git config user.name "PromptExpert Bot"');
    execSync('git config user.email "promptexpert[bot]@users.noreply.github.com"');
    execSync(`git add ${targetFile.filename}`);
    execSync(`git commit -m "PromptExpert: Implement ${domain} improvements

Suggestion: ${suggestion}

Requested by: @${author}"`);
    execSync('git push');
    
    // Post success comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `✅ **PromptExpert Implementation Complete**

**Domain**: ${domain}
**File Updated**: \`${targetFile.filename}\`
**Suggestion Applied**: "${suggestion}"

The prompt has been updated with your requested improvements. The evaluation workflow will now re-run to assess the changes.

Requested by: @${author}`
    });
    
  } catch (error) {
    console.error('Error:', error);
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `❌ PromptExpert encountered an error: ${error.message}`
    });
    process.exit(1);
  }
}

processCommand();