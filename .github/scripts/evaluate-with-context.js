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
const BASELINE_REPO = process.env.BASELINE_REPO; // Optional: GitHub repo for Thread A baseline (e.g., "owner/repo")

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
  
  // Get PR details including branch
  const { data: pr } = await octokit.pulls.get({
    owner: OWNER,
    repo: REPO,
    pull_number: PR_NUMBER
  });
  const BRANCH = pr.head.ref;
  
  // Load repository context if REPO_PATH is specified
  let repoContext = null;
  let contextMessages = [];
  let REPO_PATH = null;
  
  if (process.env.REPO_PATH) {
    REPO_PATH = process.env.REPO_PATH;
    console.log(`Loading repository context from: ${REPO_PATH}`);
    
    // Check if REPO_PATH is a GitHub URL or local path
    const { execSync } = require('child_process');
    let actualRepoPath = REPO_PATH;
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
      const contextOutput = execSync(`node scripts/repo-context-v2.js "${actualRepoPath}" --format=json`, {
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
    
    // Filter for prompt files - support text, markdown, PDFs, and images
    const promptFiles = files.filter(f => {
      const isPromptRelated = f.filename.includes('prompt') || 
                              f.filename.includes('instruction') || 
                              f.filename.includes('system') ||
                              f.filename.includes('spec') ||
                              f.filename.includes('requirement');
      
      const isSupportedType = f.filename.endsWith('.md') || 
                              f.filename.endsWith('.txt') ||
                              f.filename.endsWith('.pdf') ||
                              f.filename.endsWith('.png') ||
                              f.filename.endsWith('.jpg') ||
                              f.filename.endsWith('.jpeg') ||
                              f.filename.endsWith('.gif') ||
                              f.filename.endsWith('.webp');
      
      return isPromptRelated && isSupportedType;
    });
    
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
    let expertSpec = '';
    let expertLocation = '';
    
    const expertLoader = new ExpertLoader({
      baseDir: path.join(__dirname, '..', '..')
    });
    
    try {
      await expertLoader.initialize();
      
      // Use custom expert if specified, otherwise use domain
      expertSpec = CUSTOM_EXPERT || domain;
      console.log(`Loading expert: ${expertSpec}`);
      
      const expert = await expertLoader.loadExpert(expertSpec);
      expertPrompt = expert.content;
      
      // Store expert location for comment
      if (expert.source === 'github') {
        console.log(`[EVALUATE] Loaded expert from GitHub: ${expert.repo}/${expert.path}`);
        expertLocation = `https://github.com/${expert.repo}/blob/main/${expert.path}`;
      } else if (expert.source === 'local') {
        console.log(`[EVALUATE] Loaded expert from: local`);
        expertLocation = `expert-definitions/${expertSpec}-expert.md`;
      }
      
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
    
    // Process files for evaluation based on their PR status
    const filesToEvaluate = [];
    
    if (promptFiles.length > 0) {
      console.log(`Processing ${promptFiles.length} prompt files from PR`);
      
      for (const file of promptFiles) {
        console.log(`File: ${file.filename}, Status: ${file.status}, Previous: ${file.previous_filename || 'N/A'}`);
        
        // Each file in the PR gets evaluated
        // For modified files: base version is Thread A, head version is Thread B
        // For renamed files: content at old filename is Thread A, content at new filename is Thread B  
        // For added files: empty/generic baseline for Thread A, new content for Thread B
        filesToEvaluate.push({
          filename: file.filename,
          previousFilename: file.previous_filename,
          status: file.status,
          changes: file.changes,
          additions: file.additions,
          deletions: file.deletions
        });
      }
    } else {
      // No prompt files found, create synthetic evaluation
      console.log('No prompt files found in PR, using synthetic evaluation');
      filesToEvaluate.push({
        filename: 'context-evaluation',
        synthetic: true
      });
    }
    
    for (const file of filesToEvaluate) {
      if (file.synthetic) {
        console.log('Evaluating with repository context only...');
      } else {
        console.log(`Evaluating ${file.filename} (${file.status})...`);
      }
      
      try {
        // Get old and new content based on file status
        let oldContent, newContent;
        
        console.log(`[FILE] Processing: ${file.filename || 'synthetic'}`);
        console.log(`[FILE] Status: ${file.status || 'N/A'}`);
        console.log(`[FILE] Previous filename: ${file.previousFilename || 'N/A'}`);
        
        // Check if we should use an external baseline repo for Thread A
        const useExternalBaseline = BASELINE_REPO && !file.synthetic;
        if (useExternalBaseline) {
          console.log(`[FILE] Using external baseline repo: ${BASELINE_REPO}`);
        }
        
        if (file.synthetic) {
          // For context-only evaluation, create synthetic prompts
          oldContent = {
            type: 'text',
            content: `You are a helpful assistant. Please help with the user's request.`,
            filename: 'synthetic'
          };
          newContent = {
            type: 'text',
            content: `You are a helpful assistant with access to repository context.
          
When responding to requests:
1. Reference specific files and code from the repository context when relevant
2. Use exact values, endpoints, and configurations from the provided files
3. Provide accurate, context-aware responses based on the repository structure`,
            filename: 'synthetic'
          };
        } else if (useExternalBaseline) {
          // Use external baseline repo for Thread A
          console.log(`Using external baseline repo ${BASELINE_REPO} for Thread A`);
          oldContent = await getExternalFileContent(octokit, BASELINE_REPO, file.filename);
          
          // If file not found in external repo, fall back to default behavior
          if (!oldContent) {
            console.log(`File not found in external repo, falling back to default baseline`);
            if (file.status === 'modified') {
              oldContent = await getFileContent(octokit, OWNER, REPO, file.filename, PR_NUMBER, 'base');
            } else if (file.status === 'renamed' && file.previousFilename) {
              oldContent = await getFileContent(octokit, OWNER, REPO, file.previousFilename, PR_NUMBER, 'base');
            } else {
              oldContent = {
                type: 'text',
                content: `You are a helpful assistant. Please help with the user's request.`,
                filename: file.filename
              };
            }
          }
          
          // Thread B always gets the head version from the PR
          newContent = await getFileContent(octokit, OWNER, REPO, file.filename, null, 'head');
          console.log(`Comparing ${BASELINE_REPO}/${file.filename} vs PR head version`);
        } else if (file.status === 'modified') {
          // Modified file: get base version for Thread A, head version for Thread B
          oldContent = await getFileContent(octokit, OWNER, REPO, file.filename, PR_NUMBER, 'base');
          newContent = await getFileContent(octokit, OWNER, REPO, file.filename, null, 'head');
          console.log(`Modified file: comparing base vs head versions of ${file.filename}`);
        } else if (file.status === 'renamed') {
          // Renamed file: try to get content from old filename for Thread A
          if (file.previousFilename) {
            oldContent = await getFileContent(octokit, OWNER, REPO, file.previousFilename, PR_NUMBER, 'base');
          } else {
            oldContent = {
              type: 'text',
              content: `You are a helpful assistant. Please help with the user's request.`,
              filename: file.previousFilename || file.filename
            };
          }
          newContent = await getFileContent(octokit, OWNER, REPO, file.filename, null, 'head');
          console.log(`Renamed file: ${file.previousFilename || 'new'} -> ${file.filename}`);
        } else if (file.status === 'added') {
          // Added file: use generic baseline for Thread A, new content for Thread B
          oldContent = {
            type: 'text',
            content: `You are a helpful assistant. Please help with the user's request.`,
            filename: file.filename
          };
          newContent = await getFileContent(octokit, OWNER, REPO, file.filename, null, 'head');
          console.log(`Added file: using generic baseline vs ${file.filename}`);
        } else if (file.status === 'removed') {
          // Removed file: get base version for Thread A, use generic for Thread B
          oldContent = await getFileContent(octokit, OWNER, REPO, file.filename, PR_NUMBER, 'base');
          newContent = {
            type: 'text',
            content: `You are a helpful assistant. Please help with the user's request.`,
            filename: file.filename
          };
          console.log(`Removed file: ${file.filename} vs generic`);
        } else {
          // Fallback: try to get both versions
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
        
        // Build content messages for old and new content (handles multimodal)
        const oldContentMessages = buildContentMessage(oldContent, 'You are primed with this prompt definition');
        const newContentMessages = buildContentMessage(newContent, 'You are primed with this prompt definition');
        
        // Add context messages first (if available)
        if (contextMessages.length > 0) {
          console.log(`[EVALUATE] Injecting ${contextMessages.length} context messages into BOTH evaluation threads`);
          console.log(`[EVALUATE] Context includes files from: ${repoContext.summary ? repoContext.summary.totalFiles + ' files' : 'legacy format'}`);
          console.log(`[EVALUATE] Both Thread A and Thread B will receive the same repository context`);
          
          // Build content array for Thread A
          const threadAContent = [...contextMessages];
          
          // Add old content (can be text or multimodal)
          if (Array.isArray(oldContentMessages)) {
            threadAContent.push(...oldContentMessages);
          } else {
            threadAContent.push(oldContentMessages);
          }
          
          // Add test scenario
          threadAContent.push({
            type: 'text',
            text: `\n\nNow respond to this test scenario: "${testScenario}"`
          });
          
          threadAMessages.push({
            role: 'user',
            content: threadAContent
          });
          console.log(`[EVALUATE] Thread A prepared with repository context + baseline prompt`);
          
          // Build content array for Thread B
          const threadBContent = [...contextMessages];
          
          // Add new content (can be text or multimodal)
          if (Array.isArray(newContentMessages)) {
            threadBContent.push(...newContentMessages);
          } else {
            threadBContent.push(newContentMessages);
          }
          
          // Add test scenario
          threadBContent.push({
            type: 'text',
            text: `\n\nNow respond to this test scenario: "${testScenario}"`
          });
          
          threadBMessages.push({
            role: 'user',
            content: threadBContent
          });
          console.log(`[EVALUATE] Thread B prepared with repository context + PR prompt`);
          console.log(`[EVALUATE] File IDs from repository context are shared between threads`);
        } else {
          console.log(`[EVALUATE] No repository context available, using standard evaluation`);
          
          // Build content for Thread A (no context)
          const threadAContent = [];
          if (Array.isArray(oldContentMessages)) {
            threadAContent.push(...oldContentMessages);
          } else {
            threadAContent.push(oldContentMessages);
          }
          threadAContent.push({
            type: 'text',
            text: `\n\nNow respond to this test scenario: "${testScenario}"`
          });
          
          threadAMessages.push({
            role: 'user',
            content: threadAContent
          });
          
          // Build content for Thread B (no context)
          const threadBContent = [];
          if (Array.isArray(newContentMessages)) {
            threadBContent.push(...newContentMessages);
          } else {
            threadBContent.push(newContentMessages);
          }
          threadBContent.push({
            type: 'text',
            text: `\n\nNow respond to this test scenario: "${testScenario}"`
          });
          
          threadBMessages.push({
            role: 'user',
            content: threadBContent
          });
        }
        
        // Log Thread A content
        console.log(`[THREAD A] Content being sent:`);
        const oldContentText = oldContent?.content || oldContent || '';
        console.log(`[THREAD A] - Prompt content type: ${oldContent?.type || 'text'}`);
        if (oldContent?.type === 'media') {
          console.log(`[THREAD A] - Media file: ${oldContent.filename} (${oldContent.mediaType})`);
        } else {
          console.log(`[THREAD A] - Prompt content length: ${oldContentText.length} chars`);
          console.log(`[THREAD A] - First 200 chars of prompt: ${oldContentText.substring(0, 200)}...`);
        }
        console.log(`[THREAD A] - Context messages: ${contextMessages.length}`);
        if (contextMessages.length > 0) {
          console.log(`[THREAD A] - Context includes: ${repoContext?.summary?.totalFiles || 0} files, ${Math.round((repoContext?.summary?.totalSize || 0) / 1024)}KB`);
        }
        
        // Thread A: Evaluate current prompt WITH repository context (same file IDs as Thread B)
        console.log(`[EVALUATE] Executing Thread A with ${contextMessages.length > 0 ? 'repository context' : 'no context'}`);
        const threadA = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: threadAMessages
        });
        
        // Log Thread B content
        console.log(`[THREAD B] Content being sent:`);
        const newContentText = newContent?.content || newContent || '';
        console.log(`[THREAD B] - Prompt content type: ${newContent?.type || 'text'}`);
        if (newContent?.type === 'media') {
          console.log(`[THREAD B] - Media file: ${newContent.filename} (${newContent.mediaType})`);
        } else {
          console.log(`[THREAD B] - Prompt content length: ${newContentText.length} chars`);
          console.log(`[THREAD B] - First 200 chars of prompt: ${newContentText.substring(0, 200)}...`);
        }
        console.log(`[THREAD B] - Context messages: ${contextMessages.length}`);
        if (contextMessages.length > 0) {
          console.log(`[THREAD B] - Context includes: ${repoContext?.summary?.totalFiles || 0} files, ${Math.round((repoContext?.summary?.totalSize || 0) / 1024)}KB`);
        }
        
        // Thread B: Evaluate new prompt WITH repository context (same file IDs as Thread A)
        console.log(`[EVALUATE] Executing Thread B with ${contextMessages.length > 0 ? 'repository context' : 'no context'}`);
        const threadB = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: threadBMessages
        });
        
        // Thread C: Expert comparison (includes context awareness in evaluation)
        const contextNote = repoContext ? `
Note: Both candidates were evaluated with the following repository context loaded:
- Repository files and structure were provided to BOTH threads
- Both Thread A and Thread B had access to the SAME file IDs from ${repoContext.summary?.totalFiles || 0} files
- The SAME context (file IDs) was injected into both evaluation threads
- Evaluation should consider how well each prompt utilizes the available context
- File hashes: ${repoContext.cacheControl?.cacheKeys?.slice(0, 3).map(h => h.substring(0, 8)).join(', ')}${repoContext.cacheControl?.cacheKeys?.length > 3 ? '...' : ''}
` : '';
        
        const expertComparison = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `${expertPrompt}

${contextNote}

Compare these two prompt implementations based on how well they handled the test scenario:

**Test Scenario:** "${testScenario}"

**Candidate A (Current Implementation's Response):**
${threadA.content[0].text}

**Candidate B (Proposed Implementation's Response):**
${threadB.content[0].text}

## REQUIRED OUTPUT FORMAT

1. Provide detailed analysis comparing both candidates
2. Include specific examples and reasoning
3. End your response with this structured format:

### Expert Decision
**Recommendation:** [MERGE/REJECT/SUGGEST]
**Overall Score:** X/10
**Key Reasons:** [List 2-3 main reasons]

If SUGGEST, also include:
### Specific Improvements Needed
1. [Specific improvement 1]
2. [Specific improvement 2]
3. [Specific improvement 3]`
          }]
        });
        
        const expertResponse = expertComparison.content[0].text;
        
        // Parse expert recommendation
        let recommendation = 'REJECT';
        if (expertResponse.includes('MERGE')) {
          recommendation = 'MERGE';
        } else if (expertResponse.includes('SUGGEST')) {
          recommendation = 'SUGGEST';
        }
        
        // Parse improvements if SUGGEST
        let improvements = [];
        if (recommendation === 'SUGGEST') {
          const improvementsMatch = expertResponse.match(/### Specific Improvements Needed\n([\s\S]*?)(?:###|$)/);
          if (improvementsMatch) {
            improvements = improvementsMatch[1]
              .split('\n')
              .filter(line => line.trim())
              .map(line => line.replace(/^\d+\.\s*/, '').trim());
          }
        }
        
        // Build detailed file list from context
        let filesList = '';
        if (repoContext && repoContext.files) {
          const files = repoContext.files.slice(0, 10); // Show first 10 files
          filesList = '\n\n#### 📄 Files Leveraged:\n';
          files.forEach(file => {
            const sizeKB = Math.round(file.size / 1024 * 10) / 10;
            filesList += `- \`${file.path}\` (${sizeKB}KB) - Hash: ${file.hash.substring(0, 8)}\n`;
          });
          if (repoContext.files.length > 10) {
            filesList += `- ... and ${repoContext.files.length - 10} more files\n`;
          }
        }
        
        // Build context notification for the report
        const contextNotification = repoContext ? `
### 📁 Repository Context
Repository context was loaded and provided to both evaluation threads.
- **Repository Path**: \`${REPO_PATH || 'current repository'}\`
- **Text files analyzed**: ${repoContext.summary?.textFiles || 0}
- **Image files included**: ${repoContext.summary?.imageFiles || 0}
- **PDF files included**: ${repoContext.summary?.pdfFiles || 0}
- **Total files**: ${repoContext.summary?.totalFiles || 0}
- **Context size**: ${Math.round((repoContext.summary?.totalSize || 0) / 1024)}KB
- **Unique content hashes**: ${repoContext.summary?.uniqueHashes || 0}
${filesList}
This context was used to enhance the evaluation accuracy with cache control for efficiency.
` : '';
        
        // Build expert info section
        const expertInfo = expertLocation ? `
### 🎯 Expert Definition
- **Expert Used**: ${expertSpec || domain}
- **Location**: [\`${expertLocation}\`](https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${expertLocation})
` : '';

        // Build baseline info section if using external baseline
        const baselineInfo = BASELINE_REPO ? `
### 🔄 Baseline Source
- **External Repository**: [\`${BASELINE_REPO}\`](https://github.com/${BASELINE_REPO})
- **Description**: Thread A uses prompts from this external repository as baseline
- **Thread B Source**: Current PR changes
` : '';
        
        // Extract display content for report
        let oldContentDisplay = '';
        let newContentDisplay = '';
        
        if (oldContent?.type === 'media') {
          oldContentDisplay = `[${oldContent.mediaType} file: ${oldContent.filename}]`;
        } else if (oldContent?.type === 'text') {
          oldContentDisplay = oldContent.content;
        } else if (typeof oldContent === 'string') {
          oldContentDisplay = oldContent;
        } else {
          oldContentDisplay = '[Unable to display content]';
        }
        
        if (newContent?.type === 'media') {
          newContentDisplay = `[${newContent.mediaType} file: ${newContent.filename}]`;
        } else if (newContent?.type === 'text') {
          newContentDisplay = newContent.content;
        } else if (typeof newContent === 'string') {
          newContentDisplay = newContent;
        } else {
          newContentDisplay = '[Unable to display content]';
        }
        
        results.push({
          file: file.filename,
          report: `### 🔍 Context-Enhanced Evaluation Results

${expertInfo}
${baselineInfo}
${contextNotification}

**Test Scenario (${domain} domain):**
"${testScenario}"

**Thread A (Current Prompt + Repository Context):**
${threadA.content[0].text}

**Thread B (Proposed Prompt + Repository Context):**
${threadB.content[0].text}

**Thread C (Expert Analysis):**
${expertResponse}
`,
          recommendation: recommendation,
          improvements: improvements,
          oldContent: oldContentDisplay,
          newContent: newContentDisplay
        });
        
      } catch (error) {
        console.error(`Error evaluating ${file.filename}: ${error.message}`);
      }
    }
    
    // Post results as PR comment
    for (const result of results) {
      let commentBody = `## 🤖 Prompt Expert Evaluation${repoContext ? ' (Context-Enhanced)' : ''}

${result.report}`;
      
      if (result.recommendation === 'MERGE') {
        commentBody += `\n### ✅ APPROVED - Ready to Merge`;
      } else if (result.recommendation === 'SUGGEST') {
        commentBody += `\n### 💡 IMPROVEMENTS NEEDED\n\n`;
        result.improvements.forEach((imp, i) => {
          commentBody += `${i + 1}. ${imp}\n`;
        });
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

/**
 * Check if file is a binary/media file
 */
function isMediaFile(filename) {
  const ext = filename.toLowerCase();
  return ext.endsWith('.pdf') || ext.endsWith('.png') || ext.endsWith('.jpg') || 
         ext.endsWith('.jpeg') || ext.endsWith('.gif') || ext.endsWith('.webp');
}

/**
 * Get media type for Claude API
 */
function getMediaType(filename) {
  const ext = filename.toLowerCase();
  if (ext.endsWith('.pdf')) return 'application/pdf';
  if (ext.endsWith('.png')) return 'image/png';
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';
  if (ext.endsWith('.gif')) return 'image/gif';
  if (ext.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

/**
 * Build content message that can handle text and multimodal content
 */
function buildContentMessage(content, label) {
  if (!content) {
    return {
      type: 'text',
      text: `${label}: You are a helpful assistant. Please help with the user's request.`
    };
  }
  
  // Handle structured content (object with type field)
  if (typeof content === 'object' && content.type) {
    if (content.type === 'media') {
      // For images, return image message part
      if (content.mediaType && content.mediaType.startsWith('image/')) {
        return [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: content.mediaType,
              data: content.data
            }
          },
          {
            type: 'text',
            text: `${label} (Image: ${content.filename})`
          }
        ];
      }
      // For PDFs, we need to extract text or convert to images
      // For now, just include a note about the PDF
      else if (content.mediaType === 'application/pdf') {
        return {
          type: 'text',
          text: `${label}: [PDF file: ${content.filename}] - Note: PDF content processing not yet implemented. Please review the PDF manually.`
        };
      }
      // Other binary files
      else {
        return {
          type: 'text',
          text: `${label}: [Binary file: ${content.filename}] - Binary content cannot be displayed.`
        };
      }
    } else if (content.type === 'text') {
      return {
        type: 'text',
        text: `${label}:\n\n${content.content}`
      };
    }
  }
  
  // Handle plain text (backward compatibility)
  if (typeof content === 'string') {
    return {
      type: 'text',
      text: `${label}:\n\n${content}`
    };
  }
  
  // Fallback
  return {
    type: 'text',
    text: `${label}: Unable to process content.`
  };
}

/**
 * Get file content from an external GitHub repository
 */
async function getExternalFileContent(octokit, repoPath, filePath) {
  try {
    const [owner, repo] = repoPath.split('/');
    
    // Try to get the file from the default branch
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath
    });
    
    if (data.content) {
      // Check if it's a binary file
      if (isMediaFile(filePath)) {
        // Return as base64 for binary files
        console.log(`Loaded binary file ${filePath} from external repo ${repoPath}`);
        return {
          type: 'media',
          mediaType: getMediaType(filePath),
          data: data.content // Keep as base64
        };
      } else {
        // Decode text files
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        console.log(`Loaded ${filePath} from external repo ${repoPath} (${content.length} chars)`);
        return {
          type: 'text',
          content: content
        };
      }
    }
    
    return null;
  } catch (error) {
    console.log(`File ${filePath} not found in external repo ${repoPath}: ${error.message}`);
    return null;
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
      
      // Check if it's a binary file
      if (isMediaFile(path)) {
        console.log(`Loaded binary file ${path} from base branch`);
        return {
          type: 'media',
          mediaType: getMediaType(path),
          data: file.content, // Keep as base64
          filename: path
        };
      } else {
        return {
          type: 'text',
          content: Buffer.from(file.content, 'base64').toString('utf8'),
          filename: path
        };
      }
    } else {
      const { data: file } = await octokit.repos.getContent({
        owner: owner,
        repo: repo,
        path: path,
        ref: ref || 'HEAD'
      });
      
      // Check if it's a binary file
      if (isMediaFile(path)) {
        console.log(`Loaded binary file ${path} from ${ref || 'head'} branch`);
        return {
          type: 'media',
          mediaType: getMediaType(path),
          data: file.content, // Keep as base64
          filename: path
        };
      } else {
        return {
          type: 'text',
          content: Buffer.from(file.content, 'base64').toString('utf8'),
          filename: path
        };
      }
    }
  } catch (error) {
    console.log(`File ${path} not found in ${ref || 'current'} branch, using empty content`);
    return null;
  }
}

evaluate().catch(console.error);