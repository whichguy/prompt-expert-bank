const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const ExpertLoader = require('../../scripts/expert-loader');

const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const PR_NUMBER = parseInt(process.env.PR_NUMBER);
const REPO_CONTEXT_FILE = process.env.REPO_CONTEXT_FILE || 'repo_context.json';
const CUSTOM_EXPERT = process.env.CUSTOM_EXPERT; // New: custom expert specification

/**
 * Build context messages for Anthropic API with cache control
 */
function buildContextMessages(contextData) {
  const messages = [];
  
  // Add system context as a cacheable text block
  if (contextData.systemContext) {
    messages.push({
      type: 'text',
      text: contextData.systemContext,
      cache_control: {
        type: 'ephemeral'  // Cache this content
      }
    });
  }
  
  // Add image files if present
  if (contextData.mediaFiles) {
    for (const file of contextData.mediaFiles) {
      if (file.type === 'image') {
        messages.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mediaType,
            data: file.data
          },
          cache_control: {
            type: 'ephemeral'
          }
        });
        
        // Add caption for the image
        messages.push({
          type: 'text',
          text: `Image: ${file.paths[0]} [Hash: ${file.hash.substring(0, 8)}]`
        });
      }
      // Note: PDFs would need special handling - they're not directly supported by Anthropic
      // You'd need to convert them to images or extract text first
    }
  }
  
  return messages;
}

async function evaluate() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  console.log(`Evaluating PR #${PR_NUMBER} in ${OWNER}/${REPO}`);
  
  // Load repository context if REPO_PATH is specified
  let repoContext = null;
  let contextMessages = [];
  
  if (process.env.REPO_PATH) {
    console.log(`Loading repository context from: ${process.env.REPO_PATH}`);
    
    // Check if REPO_PATH is a GitHub URL or local path
    const { execSync } = require('child_process');
    let actualRepoPath = process.env.REPO_PATH;
    let tempDir = null;
    
    try {
      // Path interpretation:
      // - Starts with ./ or ../ = relative to prompt-expert repo
      // - Starts with / = absolute filesystem path
      // - Contains github.com = GitHub URL
      // - Format owner/repo = GitHub shorthand
      // - Otherwise = relative to prompt-expert repo (backward compatibility)
      
      if (actualRepoPath.startsWith('./') || actualRepoPath.startsWith('../')) {
        // Relative to prompt-expert repo
        actualRepoPath = path.resolve(process.cwd(), actualRepoPath);
        console.log(`Using local path relative to prompt-expert repo: ${actualRepoPath}`);
      } else if (actualRepoPath.startsWith('/')) {
        // Absolute filesystem path
        console.log(`Using absolute filesystem path: ${actualRepoPath}`);
      } else if (actualRepoPath.includes('github.com')) {
        // GitHub URL
        console.log('Detected GitHub repository URL, cloning...');
        
        // Extract owner and repo from URL
        const match = actualRepoPath.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
        if (match) {
          const [, owner, repo] = match;
          tempDir = `/tmp/repo-context-${Date.now()}`;
          
          // Clone the repository (shallow clone for speed)
          console.log(`Cloning ${owner}/${repo} to temporary directory...`);
          execSync(`git clone --depth 1 https://github.com/${owner}/${repo}.git ${tempDir}`, {
            stdio: 'inherit'
          });
          
          actualRepoPath = tempDir;
          console.log(`Repository cloned to: ${tempDir}`);
        }
      } else if (actualRepoPath.match(/^[a-zA-Z0-9][\w-]*\/[\w-]+$/)) {
        // GitHub shorthand format: owner/repo (must start with alphanumeric to avoid matching paths)
        const [owner, repo] = actualRepoPath.split('/');
        tempDir = `/tmp/repo-context-${Date.now()}`;
        
        console.log(`Cloning ${owner}/${repo} from GitHub...`);
        execSync(`git clone --depth 1 https://github.com/${owner}/${repo}.git ${tempDir}`, {
          stdio: 'inherit'
        });
        
        actualRepoPath = tempDir;
        console.log(`Repository cloned to: ${tempDir}`);
      } else {
        // Default: treat as relative to prompt-expert repo (backward compatibility)
        actualRepoPath = path.resolve(process.cwd(), actualRepoPath);
        console.log(`Using path relative to prompt-expert repo: ${actualRepoPath}`);
      }
      
      // Run repo-context-v2.js to generate context
      const contextOutput = execSync(`node scripts/repo-context-v2.js --repo-path="${actualRepoPath}" --format=json`, {
        encoding: 'utf8',
        cwd: path.join(__dirname, '..', '..')
      });
      
      // Write context to file for processing
      fs.writeFileSync(REPO_CONTEXT_FILE, contextOutput);
      console.log('Repository context generated successfully');
      
      // Clean up temp directory if we created one
      if (tempDir) {
        console.log('Cleaning up temporary directory...');
        execSync(`rm -rf ${tempDir}`, { stdio: 'ignore' });
      }
    } catch (contextError) {
      console.error('Error generating repository context:', contextError.message);
      
      // Clean up on error
      if (tempDir) {
        try {
          execSync(`rm -rf ${tempDir}`, { stdio: 'ignore' });
        } catch {}
      }
    }
  }
  
  if (fs.existsSync(REPO_CONTEXT_FILE)) {
    console.log('Loading repository context...');
    const contextData = fs.readFileSync(REPO_CONTEXT_FILE, 'utf8');
    
    try {
      // Parse JSON context from repo-context-v2.js
      repoContext = JSON.parse(contextData);
      
      // Safely access summary properties with defaults
      if (repoContext.summary) {
        console.log(`Repository context loaded: ${repoContext.summary.totalFiles || 0} files`);
        console.log(`- Text files: ${repoContext.summary.textFiles || 0}`);
        console.log(`- Image files: ${repoContext.summary.imageFiles || 0}`);
        console.log(`- PDF files: ${repoContext.summary.pdfFiles || 0}`);
        console.log(`- Total size: ${Math.round((repoContext.summary.totalSize || 0) / 1024)}KB`);
      } else {
        console.log('Repository context loaded (no summary available)');
      }
      
      // Build context messages for Anthropic API
      contextMessages = buildContextMessages(repoContext);
    } catch (e) {
      // Fallback to text context if not JSON
      console.log('Using legacy text context format');
      repoContext = { systemContext: contextData };
    }
  }
  
  try {
    // Track improvement iterations
    const { data: comments } = await octokit.issues.listComments({
      owner: OWNER,
      repo: REPO,
      issue_number: PR_NUMBER
    });
    
    // Count previous SUGGEST cycles
    const improvementCycles = comments.filter(comment => 
      comment.body.includes('Expert decision: SUGGEST') || 
      comment.body.includes('💡 SUGGEST - Improvements Needed')
    ).length;
    
    console.log(`Improvement cycles detected: ${improvementCycles}`);
    
    // Get PR files
    const { data: files } = await octokit.pulls.listFiles({
      owner: OWNER,
      repo: REPO,
      pull_number: PR_NUMBER
    });
    
    const promptFiles = files.filter(f => 
      f.filename.includes('prompt') && 
      (f.filename.endsWith('.md') || f.filename.endsWith('.txt'))
    );
    
    // Detect domain from filename and content, or use default
    let domain = 'programming'; // Default domain when no prompt files
    
    if (promptFiles.length > 0) {
      console.log(`Found ${promptFiles.length} prompt files in PR`);
      
      for (const file of promptFiles) {
        const newContent = await getFileContent(octokit, OWNER, REPO, file.filename, null, 'head');
        
        // Domain detection logic (same as original)
        if (file.filename.includes('security') || newContent.toLowerCase().includes('security')) {
          domain = 'security';
        } else if (file.filename.includes('code') || file.filename.includes('programming')) {
          domain = 'programming';
        } else if (file.filename.includes('data')) {
          domain = 'data-analysis';
        } else if (file.filename.includes('financial')) {
          domain = 'financial';
        } else {
          domain = 'general';
        }
      }
    } else {
      console.log('No prompt files found in PR, using context-only evaluation');
    }
    
    console.log(`Detected domain: ${domain}`);
    
    // Load expert using ExpertLoader
    let expertPrompt = '';
    let testScenarios = [];
    
    const expertLoader = new ExpertLoader({
      baseDir: path.join(__dirname, '..', '..')
    });
    
    try {
      await expertLoader.initialize();
      
      // Use custom expert if specified, otherwise use domain
      const expertSpec = CUSTOM_EXPERT || domain;
      console.log(`Loading expert: ${expertSpec}`);
      
      const expert = await expertLoader.loadExpert(expertSpec);
      expertPrompt = expert.content;
      
      // Log expert source for debugging
      if (expert.source === 'github') {
        console.log(`[EVALUATE] Loaded expert from GitHub: ${expert.repo}/${expert.path}`);
      } else if (expert.source === 'alias') {
        console.log(`[EVALUATE] Loaded expert from alias: ${expertSpec}`);
      } else {
        console.log(`[EVALUATE] Loaded expert from: ${expert.source}`);
      }
      
      // Load test scenarios (still from local files for now)
      const testsPath = path.join(__dirname, '..', '..', 'test-scenarios', `${domain}-tests.json`);
      try {
        const testsContent = fs.readFileSync(testsPath, 'utf8');
        const testsData = JSON.parse(testsContent);
        testScenarios = testsData.scenarios || [];
      } catch (testError) {
        console.log(`[EVALUATE] No test scenarios found for ${domain}, using defaults`);
        testScenarios = [{
          scenario: 'Write a function that reverses a string',
          input: 'Write a function that reverses a string'
        }];
      }
    } catch (error) {
      console.error(`[EVALUATE] Error loading expert: ${error.message}`);
      // Fallback to generic expert
      expertPrompt = `You are a ${domain} expert evaluator. Compare the two implementations and provide detailed analysis.`;
      testScenarios = [{
        scenario: 'Write a function that reverses a string',
        input: 'Write a function that reverses a string'
      }];
    }
    
    // Evaluate prompt files or context-only
    const results = [];
    
    // If no prompt files, create a synthetic evaluation using context
    const filesToEvaluate = promptFiles.length > 0 ? promptFiles : [{
      filename: 'context-evaluation',
      synthetic: true
    }];
    
    for (const file of filesToEvaluate) {
      console.log(file.synthetic ? 'Evaluating with repository context only...' : `Evaluating ${file.filename}...`);
      
      try {
        // Get old and new content
        let oldContent, newContent;
        
        if (file.synthetic) {
          // For context-only evaluation, create synthetic prompts
          oldContent = `You are a helpful assistant. Please help with the user's request.`;
          newContent = `You are a helpful assistant with access to repository context.
          
When responding to requests:
1. Reference specific files and code from the repository context when relevant
2. Use exact values, endpoints, and configurations from the provided files
3. Provide accurate, context-aware responses based on the repository structure`;
        } else {
          oldContent = await getFileContent(octokit, OWNER, REPO, file.filename, PR_NUMBER, 'base');
          newContent = await getFileContent(octokit, OWNER, REPO, file.filename, null, 'head');
        }
        
        // Select a test scenario
        let testScenario = 'Write a function that reverses a string';
        if (testScenarios.length > 0) {
          const test = testScenarios[Math.floor(Math.random() * testScenarios.length)];
          testScenario = test.input || test.scenario || testScenario;
        }
        
        // Build messages for Thread A and Thread B with context
        const threadAMessages = [];
        const threadBMessages = [];
        
        // Add context messages first (if available)
        if (contextMessages.length > 0) {
          console.log(`[EVALUATE] Injecting ${contextMessages.length} context messages into BOTH evaluation threads`);
          console.log(`[EVALUATE] Context includes files from: ${repoContext.summary ? repoContext.summary.totalFiles + ' files' : 'legacy format'}`);
          console.log(`[EVALUATE] Both Thread A and Thread B will receive the same repository context`);
          
          // Thread A gets context + old prompt
          threadAMessages.push({
            role: 'user',
            content: [
              ...contextMessages,
              {
                type: 'text',
                text: `\n\nYou are primed with this prompt definition:\n\n${oldContent}\n\nNow respond to this test scenario: "${testScenario}"`
              }
            ]
          });
          console.log(`[EVALUATE] Thread A prepared with repository context + baseline prompt`);
          
          // Thread B gets THE SAME context + new prompt
          threadBMessages.push({
            role: 'user',
            content: [
              ...contextMessages,
              {
                type: 'text',
                text: `\n\nYou are primed with this prompt definition:\n\n${newContent}\n\nNow respond to this test scenario: "${testScenario}"`
              }
            ]
          });
          console.log(`[EVALUATE] Thread B prepared with repository context + PR prompt`);
          console.log(`[EVALUATE] File IDs from repository context are shared between threads`);
        } else {
          console.log(`[EVALUATE] No repository context available, using standard evaluation`);
          // No context, use simple format
          threadAMessages.push({
            role: 'user',
            content: `You are primed with this prompt definition:\n\n${oldContent}\n\nNow respond to this test scenario: "${testScenario}"`
          });
          
          threadBMessages.push({
            role: 'user',
            content: `You are primed with this prompt definition:\n\n${newContent}\n\nNow respond to this test scenario: "${testScenario}"`
          });
        }
        
        // Thread A: Evaluate current prompt WITH repository context (same file IDs as Thread B)
        console.log(`[EVALUATE] Executing Thread A with ${contextMessages.length > 0 ? 'repository context' : 'no context'}`);
        const threadA = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: threadAMessages
        });
        
        // Thread B: Evaluate new prompt WITH repository context (same file IDs as Thread A)
        console.log(`[EVALUATE] Executing Thread B with ${contextMessages.length > 0 ? 'repository context' : 'no context'}`);
        const threadB = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: threadBMessages
        });
        
        // Thread C: Expert comparison with enhanced role definition and pairwise evaluation
        const contextNote = repoContext ? `

**Repository Context Available:**
- Repository files and structure were provided to BOTH implementations
- Both Thread A and Thread B had access to the SAME file IDs from ${repoContext.summary?.totalFiles || 0} files
- The SAME context (file IDs) was injected into both evaluation threads
- Evaluation should consider how well each prompt utilizes the available context
- File hashes: ${repoContext.cacheControl?.cacheKeys?.slice(0, 3).map(h => h.substring(0, 8)).join(', ')}${repoContext.cacheControl?.cacheKeys?.length > 3 ? '...' : ''}
` : '';
        
        const expertComparison = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [
            {
              role: 'user', 
              content: `## LLM ROLE DEFINITION
You are now assuming the role of a ${domain} domain expert evaluator. Your specific responsibilities are:

**Primary Role:** ${domain} Domain Expert Evaluator
**Core Function:** Conduct pairwise evaluation of prompt implementations using domain expertise
**Authority Level:** Senior expert with deep knowledge in ${domain} field
**Evaluation Approach:** Systematic, criteria-driven, evidence-based assessment

**Domain Expertise Context:**
${expertPrompt}

**Evaluation Mandate:** 
- Develop domain-specific evaluation criteria
- Conduct rigorous pairwise comparison
- Provide actionable recommendations based on ${domain} best practices
- Maintain objectivity while leveraging deep domain knowledge

Do you understand your role as a ${domain} domain expert evaluator?`
            },
            {
              role: 'assistant',
              content: `Yes, I understand. I am now functioning as a ${domain} domain expert evaluator with the mandate to:

1. Apply my deep ${domain} expertise to develop relevant evaluation criteria
2. Conduct systematic pairwise comparison of prompt implementations  
3. Provide evidence-based recommendations grounded in ${domain} best practices
4. Maintain objectivity while leveraging specialized domain knowledge

I am ready to evaluate the prompt implementations using rigorous ${domain} expert methodology.`
            },
            {
              role: 'user',
              content: `## EVALUATION TASK

**Methodology:** Pairwise evaluation using 2025 LLM evaluation best practices
**Approach:** Expert-developed criteria followed by systematic comparison

## TEST SCENARIO
"${testScenario}"

## PROMPT IMPLEMENTATIONS & RESPONSES

### Implementation A (Proposed - PR Candidate)
**Prompt Definition:**
${newContent}

**Response to Test Scenario:**
${threadB.content[0].text}

### Implementation B (Current - Baseline)
**Prompt Definition:**
${oldContent}  

**Response to Test Scenario:**
${threadA.content[0].text}

${contextNote}

## EXPERT EVALUATION PROCESS

**Phase 1: Criteria Development**
As a ${domain} expert, develop 4-6 specific evaluation criteria tailored to:
- The nature of this test scenario
- ${domain} domain standards and best practices  
- Practical value and real-world applicability
- Quality indicators specific to this task type

**Phase 2: Pairwise Comparison**
Systematically compare Implementation A vs Implementation B using your expert-developed criteria.

**Phase 3: Expert Recommendation**
Provide final recommendation based on your domain expertise and evaluation findings.

## REQUIRED OUTPUT FORMAT

### Expert Role Confirmation
**Acting as:** ${domain} Domain Expert Evaluator
**Evaluation Focus:** [Brief statement of what you'll prioritize as a ${domain} expert]

### Domain-Expert Developed Criteria
1. **[Criterion 1]:** [Description + Why critical for ${domain}]
2. **[Criterion 2]:** [Description + Why critical for ${domain}]  
3. **[Criterion 3]:** [Description + Why critical for ${domain}]
4. **[Criterion 4]:** [Description + Why critical for ${domain}]
[Additional criteria as needed]

### Systematic Pairwise Analysis
**Implementation A (Proposed) Assessment:**
- Criterion 1: [Score/Assessment + Evidence]
- Criterion 2: [Score/Assessment + Evidence]
- Criterion 3: [Score/Assessment + Evidence]
- Criterion 4: [Score/Assessment + Evidence]

**Implementation B (Current) Assessment:**  
- Criterion 1: [Score/Assessment + Evidence]
- Criterion 2: [Score/Assessment + Evidence]
- Criterion 3: [Score/Assessment + Evidence]
- Criterion 4: [Score/Assessment + Evidence]

### Expert Decision
**Pairwise Winner:** [Implementation A/Implementation B/TIE]
**Confidence Level:** [High/Medium/Low]
**Decisive Factor:** [Most important criterion that determined outcome]
**Expert Rationale:** [Your reasoning as a ${domain} expert]

**Final Recommendation:** [MERGE/REJECT/SUGGEST]
- MERGE: Implementation A (Proposed) is demonstrably superior
- REJECT: Implementation B (Current) is demonstrably superior
- SUGGEST: Implementation A shows promise but needs specific improvements

[If SUGGEST - Expert Improvement Recommendations:]
### ${domain} Expert Improvement Plan
1. **[Improvement 1]:** [Specific actionable change based on ${domain} expertise]
2. **[Improvement 2]:** [Specific actionable change based on ${domain} expertise]  
3. **[Improvement 3]:** [Specific actionable change based on ${domain} expertise]`
            }
          ]
        });
        
        const expertResponse = expertComparison.content[0].text;
        
        // Parse expert recommendation - Enhanced parsing for new format
        let recommendation = 'REJECT';
        
        // First try to parse the new structured format
        const finalRecommendationMatch = expertResponse.match(/\*\*Final Recommendation:\*\*\s*(MERGE|REJECT|SUGGEST)/);
        if (finalRecommendationMatch) {
          recommendation = finalRecommendationMatch[1];
        } else {
          // Fallback: try pairwise winner format
          const pairwiseWinnerMatch = expertResponse.match(/\*\*Pairwise Winner:\*\*\s*(Implementation A|Implementation B|TIE)/);
          if (pairwiseWinnerMatch) {
            if (pairwiseWinnerMatch[1] === 'Implementation A') {
              // Implementation A is PR - merge it
              recommendation = 'MERGE';
            } else if (pairwiseWinnerMatch[1] === 'Implementation B') {
              // Implementation B is baseline - reject PR
              recommendation = 'REJECT';
            } else {
              // TIE - suggest improvements
              recommendation = 'SUGGEST';
            }
          } else {
            // Legacy fallback
            if (expertResponse.includes('MERGE')) {
              recommendation = 'MERGE';
            } else if (expertResponse.includes('SUGGEST')) {
              recommendation = 'SUGGEST';
            }
          }
        }
        
        // Parse improvements if SUGGEST
        let improvements = [];
        if (recommendation === 'SUGGEST') {
          // Try new format first
          const newImprovementsMatch = expertResponse.match(/### .+ Expert Improvement Plan\n([\s\S]*?)(?:###|$)/);
          if (newImprovementsMatch) {
            improvements = newImprovementsMatch[1]
              .split('\n')
              .filter(line => line.trim() && line.includes('**'))
              .map(line => line.replace(/^\d+\.\s*\*\*.*?\*\*:\s*/, '').trim());
          } else {
            // Fallback to old format
            const oldImprovementsMatch = expertResponse.match(/### Specific Improvements Needed\n([\s\S]*?)(?:###|$)/);
            if (oldImprovementsMatch) {
              improvements = oldImprovementsMatch[1]
                .split('\n')
                .filter(line => line.trim())
                .map(line => line.replace(/^\d+\.\s*/, '').trim());
            }
          }
        }
        
        // Build context notification for the report
        const contextNotification = repoContext ? `
### 📁 Repository Context
Repository context was loaded and provided to both evaluation threads.
- Text files analyzed: ${repoContext.summary?.textFiles || 0}
- Image files included: ${repoContext.summary?.imageFiles || 0}
- PDF files included: ${repoContext.summary?.pdfFiles || 0}
- Total files: ${repoContext.summary?.totalFiles || 0}
- Context size: ${Math.round((repoContext.summary?.totalSize || 0) / 1024)}KB
- Unique content hashes: ${repoContext.summary?.uniqueHashes || 0}
This context was used to enhance the evaluation accuracy with cache control for efficiency.
` : '';
        
        results.push({
          file: file.filename,
          report: `### 🔍 Context-Enhanced Evaluation Results

${contextNotification}

**Test Scenario (${domain} domain):**
"${testScenario}"

**Thread A (Proposed Prompt + Repository Context):**
${threadB.content[0].text}

**Thread B (Current Prompt + Repository Context):**
${threadA.content[0].text}

**Thread C (Expert Analysis):**
${expertResponse}
`,
          recommendation: recommendation,
          improvements: improvements,
          oldContent: oldContent,
          newContent: newContent
        });
        
      } catch (error) {
        console.error(`Error evaluating ${file.filename}: ${error.message}`);
      }
    }
    
    // Post results as PR comment
    for (const result of results) {
      let commentBody = `## 🤖 Prompt Expert Evaluation${repoContext ? ' (Context-Enhanced)' : ''}

### 📄 File: ${result.file}

${result.report}`;
      
      if (result.recommendation === 'MERGE') {
        commentBody += `\n### ✅ APPROVED - Ready to Merge`;
        
        // Auto-merge approved PRs
        console.log('Expert decision: MERGE - Auto-merging PR...');
        try {
          await octokit.pulls.merge({
            owner: OWNER,
            repo: REPO,
            pull_number: PR_NUMBER,
            commit_title: `Prompt Expert: MERGE approved for ${result.file}`,
            commit_message: `Automatically merged after expert evaluation.\n\n✅ Expert decision: MERGE\n📄 File: ${result.file}\n📊 The new prompt implementation is superior and ready for production\n🤖 Merged by Prompt Expert system at ${new Date().toISOString()}`,
            merge_method: 'squash'
          });
          
          commentBody += `\n\n🎉 **PR automatically merged!**\n\n✅ Expert decision: **MERGE**\n🚀 The improved prompt is now live in the main branch.`;
        } catch (mergeError) {
          console.error('Failed to merge PR:', mergeError.message);
          commentBody += `\n\n⚠️ **Auto-merge failed**: ${mergeError.message}\n\nPlease merge manually - the evaluation was successful!`;
        }
      } else if (result.recommendation === 'SUGGEST') {
        commentBody += `\n### 💡 IMPROVEMENTS NEEDED\n\n`;
        result.improvements.forEach((imp, i) => {
          commentBody += `${i + 1}. ${imp}\n`;
        });
        
        // Auto-invoke @prompt-expert for improvements
        const suggestionText = result.improvements.length > 0 
          ? result.improvements.join(' ') 
          : 'Please review the expert analysis and implement the suggested improvements.';
          
        commentBody += `\n\n@prompt-expert ${domain} --suggest:"${suggestionText}"`;
      } else {
        commentBody += `\n### ❌ REJECTED - Does Not Meet Standards`;
      }
      
      await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: PR_NUMBER,
        body: commentBody
      });
      
      // Auto-close if rejected (and configured to do so)
      if (result.recommendation === 'REJECT' && process.env.AUTO_CLOSE_ON_FAIL === 'true') {
        await octokit.pulls.update({
          owner: OWNER,
          repo: REPO,
          pull_number: PR_NUMBER,
          state: 'closed'
        });
      }
    }
    
  } catch (error) {
    console.error('Evaluation error:', error);
    
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: PR_NUMBER,
      body: `❌ Evaluation failed: ${error.message}`
    });
  }
}

async function getFileContent(octokit, owner, repo, path, pr, ref) {
  try {
    if (pr && ref === 'base') {
      const { data: prData } = await octokit.pulls.get({
        owner: owner,
        repo: repo,
        pull_number: pr
      });
      
      const { data: file } = await octokit.repos.getContent({
        owner: owner,
        repo: repo,
        path: path,
        ref: prData.base.sha
      });
      
      return Buffer.from(file.content, 'base64').toString('utf8');
    } else {
      const { data: file } = await octokit.repos.getContent({
        owner: owner,
        repo: repo,
        path: path,
        ref: ref || 'HEAD'
      });
      
      return Buffer.from(file.content, 'base64').toString('utf8');
    }
  } catch (error) {
    console.log(`File ${path} not found in ${ref || 'current'} branch, using empty content`);
    return '';
  }
}

evaluate().catch(console.error);