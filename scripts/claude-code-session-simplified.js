#!/usr/bin/env node

/**
 * Claude Code Session Handler - Simplified
 * Handles @claude-code mentions in GitHub comments
 */

const { ErrorHandler } = require('./error-handler');
const { FileValidator } = require('./file-validator');

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
    const request = comment.replace(/@claude-code/gi, '').replace(/@prompt-expert/gi, '').trim();
    
    // Validate file paths mentioned in the comment
    const fileValidator = new FileValidator(process.env.GITHUB_WORKSPACE);
    const validation = fileValidator.validateComment(comment);
    
    // Log file validation results
    console.log(`[DEBUG] Workspace: ${process.env.GITHUB_WORKSPACE}`);
    console.log(`[DEBUG] Valid files found: ${validation.valid.join(', ')}`);
    
    if (validation.invalid.length > 0) {
      handler.log('warning', `Invalid file paths detected: ${validation.invalid.join(', ')}`);
      if (Object.keys(validation.suggestions).length > 0) {
        handler.log('info', `Suggestions: ${JSON.stringify(validation.suggestions)}`);
      }
    }
    
    // Load valid files
    const validFileContents = fileValidator.loadFiles(validation);
    console.log(`[DEBUG] Loaded ${Object.keys(validFileContents).length} files`);

    // Build context
    let context = '';
    let fileContents = {};
    
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

      // Fetch content for mentioned files
      for (const file of files) {
        if (request.includes(file.filename)) {
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
    }

    // Call Claude
    let promptContent = `You are responding to a GitHub comment.

Context:
${context}

User request: "${request}"`;

    // Add file contents from PR if available
    if (Object.keys(fileContents).length > 0) {
      promptContent += '\n\nPR File Contents:';
      for (const [filename, content] of Object.entries(fileContents)) {
        promptContent += `\n\n--- ${filename} ---\n${content}`;
      }
    }
    
    // Add validated file contents
    if (Object.keys(validFileContents).length > 0) {
      promptContent += '\n\nRequested File Contents:';
      for (const [filename, content] of Object.entries(validFileContents)) {
        promptContent += `\n\n--- ${filename} ---\n${content}`;
      }
    }

    // Add file validation report if there were issues
    let validationReport = '';
    if (validation.invalid.length > 0) {
      validationReport = '\n\n' + fileValidator.generateReport(validation);
    }

    promptContent += '\n\nPlease provide a helpful response. If you can access the files mentioned, confirm that. Be concise and specific.' + validationReport;

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