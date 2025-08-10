#!/usr/bin/env node

/**
 * Claude Code Session Handler - Simplified
 * Handles @claude-code mentions in GitHub comments
 */

const { ErrorHandler } = require('./error-handler');
const { FileValidator } = require('./file-validator');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
    for (const [file, content] of Object.entries(validFileContents)) {
      console.log(`[DEBUG] File ${file}: ${content.length} chars`);
    }

    // Check if this is an A/B test request
    const isABTest = detectABTestRequest(request, validFileContents);
    console.log(`[DEBUG] A/B Test detected: ${isABTest}`);

    // Collect system information
    const systemInfo = collectSystemInfo();
    
    // Build context
    let context = '';
    let fileContents = {};
    
    if (isPR && prNumber) {
      // Get comprehensive PR details
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      // Get PR files with detailed changes
      const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      // Get repository information
      const { data: repoInfo } = await octokit.repos.get({
        owner,
        repo
      });

      // Get commit details for the PR
      const { data: commits } = await octokit.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber
      });

      // Get PR reviews if any
      let reviews = [];
      try {
        const { data: reviewsData } = await octokit.pulls.listReviews({
          owner,
          repo,
          pull_number: prNumber
        });
        reviews = reviewsData;
      } catch (e) {
        handler.log('debug', `Could not fetch reviews: ${e.message}`);
      }

      // Get issue comments (PR comments)
      let comments = [];
      try {
        const { data: commentsData } = await octokit.issues.listComments({
          owner,
          repo,
          issue_number: prNumber
        });
        comments = commentsData;
      } catch (e) {
        handler.log('debug', `Could not fetch comments: ${e.message}`);
      }

      // Load PR files from local workspace
      // Default: include all PR files unless request specifically mentions other files
      const shouldIncludeAllPRFiles = !files.some(file => request.includes(file.filename));
      
      for (const file of files) {
        // Include file if: specifically mentioned OR we're including all PR files by default
        const shouldIncludeFile = request.includes(file.filename) || shouldIncludeAllPRFiles;
        
        if (shouldIncludeFile) {
          try {
            const filePath = path.join(process.env.GITHUB_WORKSPACE, file.filename);
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf8');
              fileContents[file.filename] = content;
            } else {
              handler.log('warn', `PR file not found in workspace: ${file.filename}`);
            }
          } catch (e) {
            handler.log('warn', `Could not read PR file ${file.filename}: ${e.message}`);
          }
        }
      }

      // Build comprehensive context
      context = `### Repository Information
- **Repository**: ${owner}/${repo}
- **Description**: ${repoInfo.description || 'No description provided'}
- **Primary Language**: ${repoInfo.language || 'Not specified'}
- **Stars**: ${repoInfo.stargazers_count} ⭐
- **Forks**: ${repoInfo.forks_count}
- **Open Issues**: ${repoInfo.open_issues_count}
- **Default Branch**: ${repoInfo.default_branch}
- **Repository Created**: ${new Date(repoInfo.created_at).toLocaleDateString()}
- **Last Updated**: ${new Date(repoInfo.updated_at).toLocaleDateString()}
- **Size**: ${Math.round(repoInfo.size / 1024)} MB
- **License**: ${repoInfo.license ? repoInfo.license.name : 'Not specified'}

### Pull Request Overview
- **PR #${prNumber}**: ${pr.title}
- **Current State**: ${pr.state.toUpperCase()} ${pr.merged ? '(MERGED ✅)' : pr.draft ? '(DRAFT 📝)' : '(OPEN 🔄)'}
- **Author**: @${pr.user.login}${pr.user.name ? ` (${pr.user.name})` : ''}
- **Author Type**: ${pr.user.type}
- **Created**: ${new Date(pr.created_at).toLocaleString()}
- **Last Updated**: ${new Date(pr.updated_at).toLocaleString()}
${pr.merged_at ? `- **Merged**: ${new Date(pr.merged_at).toLocaleString()} by @${pr.merged_by?.login || 'unknown'}` : ''}
${pr.closed_at && !pr.merged_at ? `- **Closed**: ${new Date(pr.closed_at).toLocaleString()}` : ''}

### Branch Information
- **Base Branch**: \`${pr.base.ref}\` (${pr.base.sha.substring(0, 8)}) 
- **Head Branch**: \`${pr.head.ref}\` (${pr.head.sha.substring(0, 8)})
- **Base Repository**: ${pr.base.repo.full_name}
- **Head Repository**: ${pr.head.repo.full_name}
- **Mergeable State**: ${pr.mergeable_state}
- **Can Merge**: ${pr.mergeable ? 'Yes ✅' : 'No ❌'}
- **Rebaseable**: ${pr.rebaseable ? 'Yes' : 'No'}

### PR Metadata & Workflow
- **Labels**: ${pr.labels.length > 0 ? pr.labels.map(l => `\`${l.name}\``).join(', ') : 'None'}
- **Assignees**: ${pr.assignees.length > 0 ? pr.assignees.map(a => `@${a.login}`).join(', ') : 'None'}
- **Reviewers Requested**: ${pr.requested_reviewers.length > 0 ? pr.requested_reviewers.map(r => `@${r.login}`).join(', ') : 'None'}
- **Team Reviewers**: ${pr.requested_teams.length > 0 ? pr.requested_teams.map(t => `@${t.slug}`).join(', ') : 'None'}
- **Milestone**: ${pr.milestone ? `${pr.milestone.title} (Due: ${pr.milestone.due_on ? new Date(pr.milestone.due_on).toLocaleDateString() : 'No due date'})` : 'None'}
- **Linked Issues**: ${pr.body && pr.body.match(/#\d+/g) ? pr.body.match(/#\d+/g).join(', ') : 'None detected'}

### PR Description
${pr.body ? '```markdown\n' + pr.body.substring(0, 1000) + (pr.body.length > 1000 ? '\n... (truncated)' : '') + '\n```' : '_No description provided_'}

### Code Changes Analysis  
- **Total Files Modified**: ${files.length}
- **Lines Added**: ${files.reduce((sum, f) => sum + f.additions, 0)} (+)
- **Lines Removed**: ${files.reduce((sum, f) => sum + f.deletions, 0)} (-)
- **Net Change**: ${files.reduce((sum, f) => sum + f.additions - f.deletions, 0)} lines
- **Largest File**: ${files.length > 0 ? files.reduce((max, f) => f.changes > max.changes ? f : max, files[0])?.filename : 'N/A'} (${files.length > 0 ? Math.max(...files.map(f => f.changes)) : 0} changes)

### File Modification Details
${files.map(f => {
  const statusEmoji = {
    'added': '🆕',
    'modified': '✏️', 
    'removed': '🗑️',
    'renamed': '📝',
    'copied': '📄'
  };
  return `- **${f.filename}** ${statusEmoji[f.status] || '📄'} ${f.status.toUpperCase()}
  - Changes: +${f.additions} -${f.deletions} (${f.changes} total)
  - Status: ${f.status}${f.previous_filename ? ` (was: ${f.previous_filename})` : ''}`;
}).join('\n')}

### Commit History (${commits.length} commits)
${commits.slice(-5).map(c => 
  `- **${c.sha.substring(0, 8)}** by ${c.commit.author.name} <${c.commit.author.email}> 
  - Date: ${new Date(c.commit.author.date).toLocaleString()}
  - Message: "${c.commit.message.split('\\n')[0]}"${c.commit.message.split('\\n').length > 1 ? ' (+more)' : ''}`
).join('\n')}${commits.length > 5 ? `\n- ... (${commits.length - 5} more commits)` : ''}

### Reviews & Feedback (${reviews.length} reviews)
${reviews.length > 0 ? reviews.map(r => 
  `- **@${r.user.login}** - ${r.state} ${r.state === 'APPROVED' ? '✅' : r.state === 'CHANGES_REQUESTED' ? '❌' : '💬'}
  - Submitted: ${new Date(r.submitted_at).toLocaleString()}
  ${r.body ? `- Comment: "${r.body.substring(0, 150)}${r.body.length > 150 ? '...' : ''}"` : ''}
  - Commit: ${r.commit_id.substring(0, 8)}`
).join('\n') : '- No reviews submitted yet'}

### Discussion Activity (${comments.length} comments)
${comments.length > 0 ? 
  `- Total Comments: ${comments.length}
- Latest Comment: ${new Date(comments[comments.length - 1].updated_at).toLocaleString()} by @${comments[comments.length - 1].user.login}
- Most Active Commenter: @${comments.reduce((acc, comment) => {
    acc[comment.user.login] = (acc[comment.user.login] || 0) + 1;
    return acc;
  }, {})} (analysis)` : '- No comments yet'}

### GitHub Actions Context
- **Triggered Event**: ${process.env.GITHUB_EVENT_NAME}
- **Triggering Actor**: @${process.env.GITHUB_ACTOR}
- **Workflow Run ID**: ${process.env.GITHUB_RUN_ID}
- **Run Number**: #${process.env.GITHUB_RUN_NUMBER}
- **Job**: ${process.env.GITHUB_JOB || 'prompt-expert-response'}
- **Runner OS**: ${process.env.RUNNER_OS || 'Linux'}
- **Triggered At**: ${new Date().toISOString()}
- **Repository Reference**: ${process.env.GITHUB_REF}
- **SHA**: ${process.env.GITHUB_SHA?.substring(0, 8)}`;

    } else if (issueNumber) {
      // Get comprehensive issue details
      const { data: issue } = await octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });

      // Get repository information
      const { data: repoInfo } = await octokit.repos.get({
        owner,
        repo
      });

      // Get issue comments
      let comments = [];
      try {
        const { data: commentsData } = await octokit.issues.listComments({
          owner,
          repo,
          issue_number: issueNumber
        });
        comments = commentsData;
      } catch (e) {
        handler.log('debug', `Could not fetch comments: ${e.message}`);
      }

      context = `### Repository Information
- **Repository**: ${owner}/${repo}
- **Description**: ${repoInfo.description || 'No description provided'}
- **Primary Language**: ${repoInfo.language || 'Not specified'}
- **Stars**: ${repoInfo.stargazers_count} ⭐
- **Forks**: ${repoInfo.forks_count}
- **Open Issues**: ${repoInfo.open_issues_count}
- **Default Branch**: ${repoInfo.default_branch}

### Issue Details
- **Issue #${issueNumber}**: ${issue.title}
- **Current State**: ${issue.state.toUpperCase()} ${issue.state === 'open' ? '🔄' : '✅'}
- **Author**: @${issue.user.login}${issue.user.name ? ` (${issue.user.name})` : ''}
- **Created**: ${new Date(issue.created_at).toLocaleString()}
- **Last Updated**: ${new Date(issue.updated_at).toLocaleString()}
${issue.closed_at ? `- **Closed**: ${new Date(issue.closed_at).toLocaleString()}` : ''}

### Issue Metadata
- **Labels**: ${issue.labels.length > 0 ? issue.labels.map(l => `\`${l.name}\``).join(', ') : 'None'}
- **Assignees**: ${issue.assignees.length > 0 ? issue.assignees.map(a => `@${a.login}`).join(', ') : 'None'}
- **Milestone**: ${issue.milestone ? issue.milestone.title : 'None'}
- **Comments**: ${issue.comments} total
- **Reactions**: ${Object.entries(issue.reactions).filter(([key, value]) => key !== 'url' && key !== 'total_count' && value > 0).map(([key, value]) => `${key}: ${value}`).join(', ') || 'None'}

### Issue Description
${issue.body ? '```markdown\n' + issue.body.substring(0, 1000) + (issue.body.length > 1000 ? '\n... (truncated)' : '') + '\n```' : '_No description provided_'}

### Discussion Activity (${comments.length} comments)
${comments.length > 0 ? 
  `- Total Comments: ${comments.length}
- Latest Comment: ${new Date(comments[comments.length - 1].updated_at).toLocaleString()} by @${comments[comments.length - 1].user.login}
- First Comment: ${new Date(comments[0].updated_at).toLocaleString()} by @${comments[0].user.login}` : '- No comments yet'}

### GitHub Actions Context
- **Triggered Event**: ${process.env.GITHUB_EVENT_NAME}
- **Triggering Actor**: @${process.env.GITHUB_ACTOR}
- **Workflow Run ID**: ${process.env.GITHUB_RUN_ID}
- **Run Number**: #${process.env.GITHUB_RUN_NUMBER}
- **Job**: ${process.env.GITHUB_JOB || 'prompt-expert-response'}
- **Triggered At**: ${new Date().toISOString()}
- **Repository Reference**: ${process.env.GITHUB_REF}
- **SHA**: ${process.env.GITHUB_SHA?.substring(0, 8)}`;
    }

    // Build the prompt based on whether this is an A/B test
    let promptContent;
    
    if (isABTest) {
      promptContent = buildABTestPrompt(request, validFileContents, context, fileContents);
    } else {
      // Standard prompt for non-A/B test requests using template
      promptContent = buildStandardPrompt(request, validFileContents, context, fileContents, validation);
    }

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

/**
 * Detect if this is an A/B test request
 */
function detectABTestRequest(request, fileContents) {
  const keywords = [
    'a/b test', 'abtest', 'ab test', 'A/B test',
    'compare', 'baseline', 'improved',
    'evaluate', 'versus', ' vs ',
    'full report', 'scoring', 'verdict'
  ];
  
  const requestLower = request.toLowerCase();
  
  // Check for A/B test keywords
  const hasKeywords = keywords.some(keyword => requestLower.includes(keyword));
  
  // Check if we have the evaluation template loaded
  const hasTemplate = Object.keys(fileContents).some(file => 
    file.includes('abtest-evaluation.md')
  );
  
  // Check if we have baseline and improved prompts
  const hasPrompts = Object.keys(fileContents).some(file => 
    file.includes('baseline') || file.includes('improved')
  );
  
  return hasKeywords || hasTemplate || hasPrompts;
}

/**
 * Build A/B test prompt using the evaluation template
 */
function buildABTestPrompt(request, validFileContents, context, prFileContents) {
  // Load the A/B test template
  const templatePath = path.join(process.env.GITHUB_WORKSPACE, 'templates', 'abtest-evaluation.md');
  let template;
  
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`[ERROR] Could not load A/B test template: ${error.message}`);
    // Fallback to a simple A/B test prompt
    return buildFallbackABTestPrompt(request, validFileContents, context);
  }
  
  // Find baseline and improved prompts
  let baselinePrompt = '';
  let improvedPrompt = '';
  let expertDefinition = '';
  
  for (const [filename, content] of Object.entries(validFileContents)) {
    if (filename.includes('baseline')) {
      baselinePrompt = content;
    } else if (filename.includes('improved')) {
      improvedPrompt = content;
    } else if (filename.includes('expert')) {
      expertDefinition = content;
    }
  }
  
  // Replace template variables
  template = template.replace('{{EXPERT_DEFINITION}}', expertDefinition || 'No expert definition provided');
  template = template.replace('{{EXPERT_NAME}}', 'Code Review Expert');
  template = template.replace('{{TIMESTAMP}}', new Date().toISOString());
  template = template.replace('{{BASELINE_PROMPT}}', baselinePrompt || 'Baseline prompt not provided');
  template = template.replace('{{IMPROVED_PROMPT}}', improvedPrompt || 'Improved prompt not provided');
  template = template.replace('{{BASELINE_CONTENT}}', 'Please evaluate the baseline prompt');
  template = template.replace('{{IMPROVED_CONTENT}}', 'Please evaluate the improved prompt');
  
  // Add context about the request
  const fullPrompt = `${template}

## User Request
${request}

## GitHub Context
${context}

## Instructions
Please provide a comprehensive A/B test evaluation following the template structure above. Include:
1. Files loaded confirmation with sizes
2. Detection comparison matrix for any test code provided
3. Detailed scoring (0-100) with all criteria
4. Statistical confidence level
5. Final verdict and recommendation

Be thorough and specific in your analysis.`;
  
  return fullPrompt;
}

/**
 * Fallback A/B test prompt if template cannot be loaded
 */
function buildFallbackABTestPrompt(request, validFileContents, context) {
  let prompt = `You are evaluating an A/B test between two prompts.

User Request: ${request}

Context: ${context}

Files Provided:`;
  
  for (const [filename, content] of Object.entries(validFileContents)) {
    prompt += `\n\n--- ${filename} ---\n${content}`;
  }
  
  prompt += `\n\nPlease provide:
1. Comprehensive comparison of the prompts
2. Scoring on key criteria (0-100)
3. Detection capabilities for security issues
4. Final verdict with confidence level
5. Recommendation for the PR`;
  
  return prompt;
}

/**
 * Build standard prompt using the claude-response template
 */
function buildStandardPrompt(request, validFileContents, context, prFileContents, validation) {
  const templatePath = path.join(process.env.GITHUB_WORKSPACE, 'templates', 'claude-response.md');
  let template;
  
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`[ERROR] Could not load standard template: ${error.message}`);
    // Fallback to hardcoded prompt
    return buildFallbackStandardPrompt(request, validFileContents, context, prFileContents, validation);
  }
  
  // Build PR file contents string
  let prFileContentsStr = '';
  if (Object.keys(prFileContents).length > 0) {
    for (const [filename, content] of Object.entries(prFileContents)) {
      prFileContentsStr += `\n--- ${filename} ---\n${content}\n`;
    }
  }
  
  // Build requested file contents string
  let requestedFileContentsStr = '';
  if (Object.keys(validFileContents).length > 0) {
    for (const [filename, content] of Object.entries(validFileContents)) {
      requestedFileContentsStr += `\n--- ${filename} ---\n${content}\n`;
    }
  }
  
  // Build validation report
  let validationReport = '';
  const fileValidator = new FileValidator(process.env.GITHUB_WORKSPACE);
  if (validation && validation.invalid && validation.invalid.length > 0) {
    validationReport = fileValidator.generateReport(validation);
  }
  
  // Replace template variables
  template = template.replace('{{GITHUB_CONTEXT}}', context);
  template = template.replace('{{USER_REQUEST}}', request);
  
  // Handle conditional sections (simplified approach)
  if (prFileContentsStr) {
    template = template.replace('{{#if PR_FILE_CONTENTS}}', '');
    template = template.replace('{{/if}}', '');
    template = template.replace('{{PR_FILE_CONTENTS}}', prFileContentsStr);
  } else {
    // Remove PR file contents section
    template = template.replace(/{{#if PR_FILE_CONTENTS}}[\s\S]*?{{\/if}}/g, '');
  }
  
  if (requestedFileContentsStr) {
    template = template.replace('{{#if REQUESTED_FILE_CONTENTS}}', '');
    template = template.replace('{{/if}}', '');
    template = template.replace('{{REQUESTED_FILE_CONTENTS}}', requestedFileContentsStr);
  } else {
    // Remove requested file contents section
    template = template.replace(/{{#if REQUESTED_FILE_CONTENTS}}[\s\S]*?{{\/if}}/g, '');
  }
  
  if (validationReport) {
    template = template.replace('{{#if FILE_VALIDATION_REPORT}}', '');
    template = template.replace('{{/if}}', '');
    template = template.replace('{{FILE_VALIDATION_REPORT}}', validationReport);
  } else {
    // Remove validation report section
    template = template.replace(/{{#if FILE_VALIDATION_REPORT}}[\s\S]*?{{\/if}}/g, '');
  }
  
  return template;
}

/**
 * Fallback standard prompt if template cannot be loaded
 */
function buildFallbackStandardPrompt(request, validFileContents, context, prFileContents, validation) {
  let promptContent = `You are responding to a GitHub comment.

Context:
${context}

User request: "${request}"`;

  // Add file contents from PR if available
  if (Object.keys(prFileContents).length > 0) {
    promptContent += '\n\nPR File Contents:';
    for (const [filename, content] of Object.entries(prFileContents)) {
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
  const fileValidator = new FileValidator(process.env.GITHUB_WORKSPACE);
  if (validation && validation.invalid && validation.invalid.length > 0) {
    promptContent += '\n\n' + fileValidator.generateReport(validation);
  }

  promptContent += '\n\nPlease provide a helpful response. If you can access the files mentioned, confirm that. Be concise and specific.';
  
  return promptContent;
}

/**
 * Collect system and runtime environment information
 */
function collectSystemInfo() {
  const startTime = Date.now();
  
  return {
    // Operating System
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    
    // Hardware
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100, // GB
    freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100, // GB
    cpuCount: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    
    // Runtime
    nodeVersion: process.version,
    uptime: Math.round(os.uptime()),
    loadAverage: os.loadavg(),
    
    // Process
    workingDirectory: process.cwd(),
    execPath: process.execPath,
    
    // Environment
    user: os.userInfo().username,
    homeDir: os.homedir(),
    tempDir: os.tmpdir(),
    
    // Timestamps
    sessionStart: new Date(startTime).toISOString(),
    systemBootTime: new Date(Date.now() - os.uptime() * 1000).toISOString()
  };
}

main().catch(console.error);