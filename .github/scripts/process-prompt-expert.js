const { Anthropic } = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const ExpertLoader = require('../../scripts/expert-loader');

async function processCommand() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  // Support both domain and expert-path parameters
  const domain = process.env.DOMAIN;
  const expertPath = process.env.EXPERT_PATH; // New: custom expert path
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
    
    // Fetch current content from GitHub PR branch instead of local filesystem
    let currentContent;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: targetFile.filename,
        ref: `refs/pull/${issueNumber}/head`
      });
      currentContent = Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
      console.error(`Failed to fetch ${targetFile.filename} from GitHub: ${error.message}`);
      throw new Error(`Could not read prompt file from GitHub: ${targetFile.filename}`);
    }
    
    // Load expert definition using the ExpertLoader
    let expertContext = '';
    let expertName = domain;
    const expertLoader = new ExpertLoader({
      baseDir: path.join(__dirname, '..', '..')
    });
    
    try {
      await expertLoader.initialize();
      
      // Try to load expert by path or alias
      let expertSpec = expertPath || domain;
      console.log(`Loading expert: ${expertSpec}`);
      
      const expert = await expertLoader.loadExpert(expertSpec);
      expertContext = expert.content;
      
      // Log expert source
      if (expert.source === 'github') {
        console.log(`Loaded expert from GitHub: ${expert.repo}/${expert.path}`);
        expertName = `${expert.repo.split('/')[1]}-${domain}`;
      } else if (expert.source === 'alias') {
        console.log(`Loaded expert from alias: ${expertSpec}`);
      } else {
        console.log(`Loaded expert from: ${expert.source}`);
      }
    } catch (err) {
      console.log(`Error loading expert: ${err.message}`);
      console.log(`Using generic ${domain} expert context`);
      expertContext = `You are a ${domain} expert focused on improving prompts in this domain.`;
    }
    
    // Use Claude to implement the suggestion
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
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
    
    // Update file directly via GitHub API instead of local filesystem
    try {
      // First get the current file to get its SHA
      const { data: currentFile } = await octokit.repos.getContent({
        owner,
        repo,
        path: targetFile.filename,
        ref: `refs/pull/${issueNumber}/head`
      });
      
      // Update the file via GitHub API
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: targetFile.filename,
        message: `Prompt Expert: Implement ${domain} improvements

Suggestion: ${suggestion}

Requested by: @${author}`,
        content: Buffer.from(updatedContent).toString('base64'),
        sha: currentFile.sha,
        branch: `refs/heads/${process.env.GITHUB_HEAD_REF || `pull/${issueNumber}/head`}`
      });
      
      console.log(`Successfully updated ${targetFile.filename} via GitHub API`);
    } catch (error) {
      console.error(`Failed to update file via GitHub API: ${error.message}`);
      throw error;
    }
    
    // Post success comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `✅ **Prompt Expert Implementation Complete**

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
      body: `❌ Prompt Expert encountered an error: ${error.message}`
    });
    process.exit(1);
  }
}

processCommand();