#!/usr/bin/env node

/**
 * Prompt Expert Handler
 * Clean and simple implementation
 */

const { ErrorHandler } = require('./error-handler');

async function main() {
  const handler = new ErrorHandler({
    pr: process.env.PR_NUMBER,
    repo: process.env.GITHUB_REPOSITORY
  });

  try {
    // Validate environment
    const required = ['GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GITHUB_REPOSITORY', 'PR_NUMBER', 'EXPERT'];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing ${key}`);
      }
    }

    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const prNumber = parseInt(process.env.PR_NUMBER);
    const expert = process.env.EXPERT;
    const instructions = process.env.INSTRUCTIONS || '';

    handler.log('info', `Processing ${expert} expert for PR #${prNumber}`);

    // Import dependencies
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const { Octokit } = await import('@octokit/rest');
    const fs = require('fs').promises;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Load expert definition
    const expertContent = await handler.tryWithFallback(
      async () => {
        const url = `https://raw.githubusercontent.com/whichguy/prompt-expert-bank/main/expert-definitions/${expert}-expert.md`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      },
      async () => `You are a ${expert} expert providing analysis and guidance.`
    );

    // Load PR context
    const prContext = JSON.parse(await fs.readFile('pr-context.json', 'utf-8'));

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: buildPrompt(expertContent, prContext, instructions)
      }]
    });

    // Extract and apply changes
    const text = response.content[0].text;
    const match = text.match(/### Updated File: (.+?)\n```(?:markdown)?\n([\s\S]+?)\n```/);
    
    if (!match) {
      throw new Error('Could not parse response');
    }

    const [, filename, content] = match;
    
    // Apply changes
    await fs.writeFile(filename.trim(), content.trim());
    
    // Commit
    const { execSync } = require('child_process');
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync(`git add ${filename.trim()}`);
    execSync(`git commit -m "Apply ${expert} expert improvements"`);
    execSync('git push');

    // Post comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `✅ Applied ${expert} expert improvements to ${filename.trim()}`
    });

    handler.log('info', 'Success');

  } catch (error) {
    handler.log('error', error.message);
    
    // Try to post error comment
    try {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: parseInt(process.env.PR_NUMBER),
        body: `❌ Error: ${error.message}`
      });
    } catch (e) {
      // Ignore comment errors
    }
    
    handler.exit(1);
  }
}

function buildPrompt(expertContent, prContext, instructions) {
  return `You are: ${expertContent}

PR Context: ${JSON.stringify(prContext, null, 2)}

User Request: "${instructions}"

Analyze and improve the files. Output as:
### Summary
[changes made]

### Updated File: [filename]
\`\`\`markdown
[complete content]
\`\`\``;
}

main().catch(console.error);