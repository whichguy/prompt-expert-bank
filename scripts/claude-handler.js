#!/usr/bin/env node

/**
 * Claude Handler - Simple @claude mention handler
 * Handles @claude mentions in GitHub comments
 */

const { ErrorHandler } = require('./error-handler');

async function main() {
  const handler = new ErrorHandler({
    pr: process.env.PR_NUMBER,
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
    const comment = process.env.COMMENT_BODY;

    handler.log('info', `Processing @claude request for PR/Issue #${prNumber}`);

    // Import dependencies
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const { Octokit } = await import('@octokit/rest');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Extract the user's request from the comment
    const request = comment.replace(/@claude/gi, '').trim();

    // Build context
    let context = '';
    let fileContents = {};
    
    if (prNumber) {
      try {
        // Try to get PR details
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

        // Fetch content for mentioned files
        for (const file of files) {
          if (request.includes(file.filename) || request.includes(file.filename.split('/').pop())) {
            try {
              const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path: file.filename,
                ref: pr.head.ref
              });
              
              if (!Array.isArray(data) && data.content) {
                fileContents[file.filename] = Buffer.from(data.content, 'base64').toString('utf-8');
              }
            } catch (e) {
              handler.log('warn', `Could not fetch ${file.filename}: ${e.message}`);
            }
          }
        }

        context = `PR #${prNumber}: ${pr.title}
State: ${pr.state}
Base: ${pr.base.ref}
Head: ${pr.head.ref}

Files changed: ${files.length}
${files.map(f => `- ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')}`;
      } catch (e) {
        // Might be an issue, not a PR
        const { data: issue } = await octokit.issues.get({
          owner,
          repo,
          issue_number: prNumber
        });

        context = `Issue #${prNumber}: ${issue.title}
State: ${issue.state}`;
      }
    }

    // Call Claude
    let promptContent = `You are responding to a GitHub comment.

Context:
${context}

User request: "${request}"`;

    // Add file contents if available
    if (Object.keys(fileContents).length > 0) {
      promptContent += '\n\nFile Contents:';
      for (const [filename, content] of Object.entries(fileContents)) {
        promptContent += `\n\n--- ${filename} ---\n${content}`;
      }
    }

    promptContent += '\n\nPlease provide a helpful response. Be concise and specific.';

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: promptContent
      }]
    });

    const responseText = response.content[0].text;

    // Post response as comment
    if (prNumber) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: responseText
      });
    }

    handler.log('info', 'Successfully posted Claude response');

  } catch (error) {
    handler.log('error', error.message);
    
    // Try to post error comment
    try {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      const prNumber = process.env.PR_NUMBER;
      
      if (prNumber) {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: parseInt(prNumber),
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