#!/usr/bin/env node

/**
 * Simplified Prompt Expert Handler
 * Clean error handling and logging without overcomplication
 */

const { SimpleErrorHandler } = require('./lib/SimpleErrorHandler');

async function main() {
  const handler = new SimpleErrorHandler({
    pr: process.env.PR_NUMBER,
    repo: process.env.GITHUB_REPOSITORY
  });

  try {
    // Validate required environment variables
    const required = ['GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'GITHUB_REPOSITORY', 'PR_NUMBER', 'EXPERT'];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }

    handler.log('info', 'Starting prompt expert handler');

    // Parse inputs
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const prNumber = parseInt(process.env.PR_NUMBER);
    const expert = process.env.EXPERT;
    const instructions = process.env.INSTRUCTIONS || '';

    if (!owner || !repo) {
      throw new Error('Invalid GITHUB_REPOSITORY format');
    }

    if (isNaN(prNumber)) {
      throw new Error('Invalid PR_NUMBER');
    }

    handler.log('info', `Processing ${expert} expert for PR #${prNumber}`);

    // Dynamic imports
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const { Octokit } = await import('@octokit/rest');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    // Handle repo-path evaluation
    if (instructions.includes('--repo-path=')) {
      await handleRepoPathEvaluation(handler, instructions, {
        owner, repo, prNumber, expert
      });
      return;
    }

    // Load expert definition with fallback
    const expertContent = await handler.tryWithFallback(
      async () => {
        const url = `https://raw.githubusercontent.com/whichguy/prompt-expert-bank/main/expert-definitions/${expert}-expert.md`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        handler.log('info', `Loaded ${expert} expert from GitHub`);
        return await response.text();
      },
      async () => {
        handler.log('warn', `Using fallback expert definition for ${expert}`);
        return `You are a ${expert} expert providing analysis and guidance.`;
      },
      'Loading expert definition'
    );

    // Load PR context
    const prContext = await handler.wrap(
      async () => {
        const fs = require('fs').promises;
        const content = await fs.readFile('pr-context.json', 'utf-8');
        return JSON.parse(content);
      },
      'Failed to load PR context'
    );

    // Process with Claude
    const response = await handler.wrap(
      async () => {
        handler.log('info', 'Calling Claude API');
        return await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: buildPrompt(expertContent, prContext, instructions)
          }]
        });
      },
      'Claude API call failed'
    );

    const claudeResponse = response.content[0].text;
    handler.log('info', 'Claude response received');

    // Extract and apply changes
    const fileMatch = claudeResponse.match(/### Updated File: (.+?)\n```(?:markdown)?\n([\s\S]+?)\n```/);
    
    if (!fileMatch) {
      throw new Error('Could not parse Claude response - expected file format not found');
    }

    const filename = fileMatch[1].trim();
    const updatedContent = fileMatch[2].trim();

    // Apply changes
    await applyChanges(handler, {
      filename,
      content: updatedContent,
      expert,
      owner,
      repo,
      prNumber,
      octokit
    });

    handler.log('info', 'Successfully applied prompt expert improvements');

  } catch (error) {
    handler.log('error', 'Fatal error in prompt expert handler', {
      error: error.message,
      stack: error.stack
    });

    // Try to post error to GitHub
    try {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      const prNumber = parseInt(process.env.PR_NUMBER);
      
      if (owner && repo && !isNaN(prNumber)) {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `❌ Prompt expert failed: ${error.message}`
        });
      }
    } catch (commentError) {
      handler.log('error', 'Failed to post error comment', {
        error: commentError.message
      });
    }

    handler.exit(1);
  }
}

/**
 * Handle repo-path evaluation
 */
async function handleRepoPathEvaluation(handler, instructions, context) {
  const match = instructions.match(/--repo-path=["']?([^"'\s]+)["']?/);
  if (!match) {
    throw new Error('Invalid --repo-path format');
  }

  const repoPath = match[1];
  handler.log('info', `Running evaluation with repo path: ${repoPath}`);

  const { execSync } = require('child_process');
  
  await handler.wrap(
    async () => {
      execSync('node .github/scripts/evaluate-with-context.js', {
        env: {
          ...process.env,
          REPO_PATH: repoPath,
          CUSTOM_EXPERT: context.expert,
          OWNER: context.owner,
          REPO: context.repo,
          PR_NUMBER: context.prNumber.toString()
        },
        stdio: 'inherit'
      });
    },
    'Evaluation with context failed'
  );
}

/**
 * Build Claude prompt
 */
function buildPrompt(expertContent, prContext, instructions) {
  // Read file contents for markdown/text files
  const fs = require('fs');
  const fileContents = {};
  
  for (const file of prContext.files || []) {
    if (file.filename && (file.filename.endsWith('.md') || file.filename.endsWith('.txt'))) {
      try {
        fileContents[file.filename] = fs.readFileSync(file.filename, 'utf-8');
      } catch (err) {
        // Ignore read errors
      }
    }
  }

  return `## YOUR ROLE
You are evaluating git file contents from a pull request as the expert defined below.

## EXPERT DEFINITION
${expertContent}

## PULL REQUEST CONTEXT
### PR Metadata
${JSON.stringify(prContext.pr, null, 2)}

### Changed Files
${JSON.stringify(prContext.files, null, 2)}

### Current File Contents
${JSON.stringify(fileContents, null, 2)}

## USER REQUEST
"${instructions}"

## YOUR TASK
1. Analyze the PR and files
2. Apply requested improvements
3. Output complete updated file content

Format your response as:
### Summary
Brief summary of changes

### Updated File: [filename]
\`\`\`markdown
[Complete updated content]
\`\`\``;
}

/**
 * Apply changes to files
 */
async function applyChanges(handler, context) {
  const fs = require('fs').promises;
  const { execSync } = require('child_process');

  // Write file
  await handler.wrap(
    async () => {
      await fs.writeFile(context.filename, context.content);
      handler.log('info', `Updated ${context.filename}`);
    },
    `Failed to write ${context.filename}`
  );

  // Git operations
  await handler.wrap(
    async () => {
      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
      execSync(`git add ${context.filename}`);
      execSync(`git commit -m "Apply @prompt-expert improvements from ${context.expert} expert"`);
      execSync('git push');
      handler.log('info', 'Changes committed and pushed');
    },
    'Git operations failed'
  );

  // Post success comment
  await handler.wrap(
    async () => {
      await context.octokit.issues.createComment({
        owner: context.owner,
        repo: context.repo,
        issue_number: context.prNumber,
        body: `✅ Prompt expert improvements applied!

**Expert:** ${context.expert}
**File updated:** ${context.filename}

Changes have been committed to this PR.`
      });
    },
    'Failed to post success comment'
  );
}

// Run main with error handling
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});