#!/usr/bin/env node

const fs = require('fs');

async function main() {
  // Use dynamic imports for ES modules
  const { Anthropic } = await import('@anthropic-ai/sdk');
  const { Octokit } = await import('@octokit/rest');

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const prNumber = parseInt(process.env.PR_NUMBER);
  const expert = process.env.EXPERT;
  const instructions = process.env.INSTRUCTIONS;

  console.log(`Processing @prompt-expert command for ${expert} expert`);
  console.log(`Instructions: ${instructions}`);

  // Check if this is a repo-path evaluation request
  if (instructions && instructions.includes('--repo-path=')) {
    console.log('Detected --repo-path parameter, running evaluation with context...');
    
    // Extract repo path
    const repoPathMatch = instructions.match(/--repo-path=["']?([^"'\s]+)["']?/);
    const repoPath = repoPathMatch ? repoPathMatch[1] : null;
    
    if (repoPath) {
      // Run evaluation with context
      const { execSync } = require('child_process');
      
      try {
        const output = execSync(`node .github/scripts/evaluate-with-context.js`, {
          env: {
            ...process.env,
            REPO_PATH: repoPath,
            CUSTOM_EXPERT: expert,
            OWNER: owner,
            REPO: repo,
            PR_NUMBER: prNumber.toString()
          },
          stdio: 'inherit'
        });
        
        console.log('Evaluation completed successfully');
        return;
      } catch (evalError) {
        console.error('Error running evaluation:', evalError);
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `❌ Error running evaluation with context: ${evalError.message}`
        });
        process.exit(1);
      }
    }
  }

  try {
    // Load expert definition
    let expertContent;
    try {
      // Try to fetch from prompt-expert-bank repo
      const expertUrl = `https://raw.githubusercontent.com/whichguy/prompt-expert-bank/main/expert-definitions/${expert}-expert.md`;
      const expertResponse = await fetch(expertUrl);
      
      if (expertResponse.ok) {
        expertContent = await expertResponse.text();
        console.log(`Successfully loaded ${expert} expert definition`);
      } else {
        console.log(`Could not fetch expert definition from ${expertUrl}, using fallback`);
        expertContent = `You are a ${expert} expert providing analysis and guidance.`;
      }
    } catch (err) {
      console.log(`Error fetching expert definition: ${err.message}, using fallback`);
      expertContent = `You are a ${expert} expert providing analysis and guidance.`;
    }
    
    // Load PR context
    const prContext = JSON.parse(fs.readFileSync('pr-context.json', 'utf-8'));
    
    // Read changed files content
    const fileContents = {};
    for (const file of prContext.files) {
      if (file.filename.endsWith('.md') || file.filename.endsWith('.txt')) {
        try {
          fileContents[file.filename] = fs.readFileSync(file.filename, 'utf-8');
        } catch (err) {
          console.log(`Could not read ${file.filename}`);
        }
      }
    }
    
    // Call Claude with all context
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `## YOUR ROLE
You are evaluating git file contents from a pull request. You will act as the expert defined below to review these changes and take appropriate actions.

## EXPERT DEFINITION
${expertContent}

## CONTEXT: GIT PULL REQUEST INFORMATION
You are reviewing changes in a Git pull request. The following data shows what files have been modified, added, or deleted in this PR:

### Pull Request Metadata
${JSON.stringify(prContext.pr, null, 2)}

### Changed Files (Git Diff Patches)
${JSON.stringify(prContext.files, null, 2)}

### Recent Comments
${JSON.stringify(prContext.comments.slice(-5), null, 2)}

### Current File Contents
${JSON.stringify(fileContents, null, 2)}

## USER REQUEST
The user has requested the following:
"${instructions}"

## YOUR TASK
Based on your expertise and the user's request:

1. Analyze the current PR and files
2. Apply the requested improvements or changes
3. Output the complete updated file content with all improvements applied
4. Format your response as:

### Summary
Brief summary of changes made

### Updated File: [filename]
\`\`\`markdown
[Complete updated file content]
\`\`\`

Make sure to maintain the existing structure and intent of the prompt while implementing the requested improvements.`
      }]
    });

    const claudeResponse = response.content[0].text;
    console.log('Claude response received');
    
    // Extract filename and content from Claude's response
    const fileMatch = claudeResponse.match(/### Updated File: (.+?)\n```(?:markdown)?\n([\s\S]+?)\n```/);
    
    if (fileMatch) {
      const filename = fileMatch[1].trim();
      const updatedContent = fileMatch[2].trim();
      
      // Write the updated file
      fs.writeFileSync(filename, updatedContent);
      console.log(`Updated ${filename}`);
      
      // Commit and push changes
      const { execSync } = require('child_process');
      
      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
      execSync(`git add ${filename}`);
      execSync(`git commit -m "Apply @prompt-expert improvements from ${expert} expert"`);
      execSync('git push');
      
      console.log('Changes committed and pushed');
      
      // Post success comment
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: `✅ @prompt-expert improvements applied successfully!

**Expert:** ${expert}
**File updated:** ${filename}

The changes have been committed to this PR. Please review the updated prompt.`
      });
    } else {
      console.error('Could not extract file content from Claude response');
      
      // Post error comment
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: `❌ Failed to apply @prompt-expert improvements. Could not parse the response format.`
      });
    }
  } catch (error) {
    console.error('Error:', error);
    
    // Post error comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `❌ Error applying @prompt-expert improvements: ${error.message}`
    });
    
    process.exit(1);
  }
}

main().catch(console.error);