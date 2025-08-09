#!/usr/bin/env node

/**
 * Claude Code Session Handler - Simplified
 * Handles @claude-code mentions in GitHub comments
 */

const { ErrorHandler } = require('./error-handler');

async function main() {
  const handler = new ErrorHandler({
    pr: process.env.PR_NUMBER,
    issue: process.env.ISSUE_NUMBER,
    repo: process.env.GITHUB_REPOSITORY
  });

  try {
    // Validate environment
    const required = ['GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GITHUB_REPOSITORY', 'COMMENT_BODY'];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing ${key}`);
      }
    }

    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const prNumber = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER) : null;
    const issueNumber = process.env.ISSUE_NUMBER ? parseInt(process.env.ISSUE_NUMBER) : null;
    const comment = process.env.COMMENT_BODY;
    const isPR = process.env.IS_PR === 'true';

    handler.log('info', `Processing Claude Code request for ${isPR ? `PR #${prNumber}` : `Issue #${issueNumber}`}`);

    // Import dependencies
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const { Octokit } = await import('@octokit/rest');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Extract the user's request from the comment
    const request = comment.replace(/@claude-code/gi, '').trim();

    // Build context
    let context = '';
    if (isPR && prNumber) {
      // Get PR details
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      // Get PR files
      const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      context = `PR #${prNumber}: ${pr.title}
State: ${pr.state}
Base: ${pr.base.ref}
Head: ${pr.head.ref}

Files changed: ${files.length}
${files.map(f => `- ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')}`;
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are responding to a GitHub comment.

Context:
${context}

User request: "${request}"

Please provide a helpful response. If you can access the files mentioned, confirm that. Be concise and specific.`
      }]
    });

    const responseText = response.content[0].text;

    // Post response as comment
    const targetNumber = prNumber || issueNumber;
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: targetNumber,
      body: responseText
    });

    handler.log('info', 'Successfully posted Claude Code response');

  } catch (error) {
    handler.log('error', error.message);
    
    // Try to post error comment
    try {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      const targetNumber = process.env.PR_NUMBER || process.env.ISSUE_NUMBER;
      
      if (targetNumber) {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: parseInt(targetNumber),
          body: `❌ Error: ${error.message}`
        });
      }
    } catch (e) {
      // Ignore comment errors
    }
    
    handler.exit(1);
  }
}

main().catch(console.error);