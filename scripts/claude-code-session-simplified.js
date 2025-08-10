#!/usr/bin/env node

/**
 * Claude Code Session Handler - Simplified
 * Handles @claude-code mentions in GitHub comments
 */

const { ErrorHandler } = require('./error-handler');
const { FileValidator } = require('./file-validator');
const fs = require('fs');
const path = require('path');

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

main().catch(console.error);