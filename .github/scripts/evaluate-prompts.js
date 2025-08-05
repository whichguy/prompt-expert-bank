const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');

const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const PR_NUMBER = parseInt(process.env.PR_NUMBER);

async function evaluate() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  console.log(`Evaluating PR #${PR_NUMBER} in ${OWNER}/${REPO}`);
  
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
    
    if (promptFiles.length === 0) {
      await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: PR_NUMBER,
        body: '❌ No prompt files found in this PR'
      });
      return;
    }
    
    // Detect domain from filename and content
    let domain = null;
    
    for (const file of promptFiles) {
      const newContent = await getFileContent(octokit, OWNER, REPO, file.filename, null, 'head');
      
      // Try to detect domain from filename or content
      if (file.filename.includes('security') || newContent.toLowerCase().includes('security') ||
         newContent.toLowerCase().includes('risk') || newContent.toLowerCase().includes('safety')) {
        domain = 'security';
      } else if (file.filename.includes('code') || file.filename.includes('programming') || 
               newContent.toLowerCase().includes('code review') || newContent.toLowerCase().includes('programming') ||
               newContent.toLowerCase().includes('javascript') || newContent.toLowerCase().includes('python') ||
               newContent.toLowerCase().includes('java') || newContent.toLowerCase().includes('react') ||
               newContent.toLowerCase().includes('api') || newContent.toLowerCase().includes('function') ||
               newContent.toLowerCase().includes('algorithm') || newContent.toLowerCase().includes('debug')) {
        domain = 'programming';
      } else if (file.filename.includes('data') || newContent.toLowerCase().includes('data analysis') ||
                newContent.toLowerCase().includes('analytics') || newContent.toLowerCase().includes('visualization')) {
        domain = 'data-analysis';
      } else if (file.filename.includes('financial') || newContent.toLowerCase().includes('financial') ||
                newContent.toLowerCase().includes('finance') || newContent.toLowerCase().includes('budget') ||
                newContent.toLowerCase().includes('investment') || newContent.toLowerCase().includes('money')) {
        domain = 'financial';
      } else {
        // Default to general purpose expert for unmatched prompts
        domain = 'general';
      }
      
      if (domain) break;
    }
    
    // Domain detection now always succeeds with 'general' as fallback
    
    // Load MD-based expert definition
    const expertPath = path.join(__dirname, 'expert-definitions', `${domain}-expert.md`);
    
    if (!fs.existsSync(expertPath)) {
      await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: PR_NUMBER,
        body: `⚠️ No expert definition found for domain: ${domain}. Please check available experts in expert-definitions/.`
      });
      return;
    }
    
    // Read expert definition
    const expertDefinition = fs.readFileSync(expertPath, 'utf-8');
    
    // Create MD-based expert module
    const expertModule = {
      name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Expert`,
      definition: expertDefinition,
      async evaluatePrompts(oldContent, newContent, anthropic) {
        // Use 3-thread evaluation model as designed
        
        // Thread A: Evaluate current prompt
        const threadA = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `You are primed with this prompt definition:\n\n${oldContent}\n\nNow respond to this test scenario: "Analyze the command 'sudo rm -rf /var/lib/docker' in a production environment"`
          }]
        });
        
        // Thread B: Evaluate new prompt  
        const threadB = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `You are primed with this prompt definition:\n\n${newContent}\n\nNow respond to this test scenario: "Analyze the command 'sudo rm -rf /var/lib/docker' in a production environment"`
          }]
        });
        
        // Thread C: Expert comparison with clear instructions
        const iterationContext = improvementCycles > 0 ? `

### ITERATION CONTEXT
This is improvement iteration #${improvementCycles + 1}. The prompt has been revised ${improvementCycles} time(s) based on previous expert feedback.
${improvementCycles >= 2 ? '- Be more lenient in your evaluation as improvements have been attempted multiple times' : ''}
${improvementCycles >= 3 ? '- Consider approving if the prompt is reasonably good (7.5/10 or better) to avoid endless cycles' : ''}
` : '';

        const comparison = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `## EVALUATION FRAMEWORK

You are an expert prompt evaluator. Your role is to compare two prompt implementations and provide one of three recommendations:

1. **MERGE** - The new prompt (Candidate B) is clearly superior and ready for production
2. **REJECT** - The new prompt has critical flaws or is inferior to the current version
3. **SUGGEST** - The new prompt has potential but needs specific improvements

### IMPORTANT INSTRUCTIONS:
- Use MERGE when Candidate B scores ≥8.5/10 or shows significant improvement
- Use REJECT when Candidate B has major issues or scores <6/10
- Use SUGGEST when Candidate B is promising (6-8.5/10) but needs specific enhancements

When using SUGGEST, you MUST provide:
1. A bulleted list of specific improvements
2. Clear, actionable instructions for each improvement
3. Examples where helpful

Your evaluation will be used to automatically invoke an AI assistant to implement suggestions, so be precise and implementation-focused.${iterationContext}

## EXPERT DOMAIN CONTEXT

${expertDefinition}

## EVALUATION TASK

Compare these two prompt implementations:

**Candidate A (Current Implementation):**
${threadA.content[0].text}

**Candidate B (Proposed Implementation):**
${threadB.content[0].text}

## REQUIRED OUTPUT FORMAT

1. Provide detailed analysis comparing both candidates
2. Include specific examples and reasoning
3. End your response with this structured format:

=== EVALUATION RESULT ===
DECISION: [MERGE/REJECT/SUGGEST]
SCORE: [X]/10
IMPROVEMENTS NEEDED:
- [Specific improvement 1]
- [Specific improvement 2]
- [etc.]
=== END RESULT ===

Note: IMPROVEMENTS NEEDED section is only required for SUGGEST decisions.`
          }]
        });
        
        const expertResponse = comparison.content[0].text;
        
        // Parse expert decision
        let recommendation = 'REQUEST_CHANGES';
        let improvements = [];
        let score = null;
        
        // First try structured format
        const structuredMatch = expertResponse.match(/=== EVALUATION RESULT ===([\s\S]*?)=== END RESULT ===/);
        if (structuredMatch) {
          const structuredContent = structuredMatch[1];
          
          // Extract decision
          const decisionMatch = structuredContent.match(/DECISION:\s*(\w+)/);
          if (decisionMatch) {
            const decision = decisionMatch[1].toUpperCase();
            if (decision === 'MERGE') {
              recommendation = 'APPROVE';
              console.log('Expert decision: MERGE (structured)');
            } else if (decision === 'REJECT') {
              recommendation = 'REQUEST_CHANGES';
              console.log('Expert decision: REJECT (structured)');
            } else if (decision === 'SUGGEST') {
              recommendation = 'SUGGEST';
              console.log('Expert decision: SUGGEST (structured)');
            }
          }
          
          // Extract score
          const scoreMatch = structuredContent.match(/SCORE:\s*(\d+(?:\.\d+)?)/);
          if (scoreMatch) {
            score = parseFloat(scoreMatch[1]);
          }
          
          // Extract improvements
          const improvementsMatch = structuredContent.match(/IMPROVEMENTS NEEDED:([\s\S]*?)(?:===|$)/);
          if (improvementsMatch) {
            const improvementsList = improvementsMatch[1].trim();
            improvements = improvementsList.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim());
          }
        } else {
          // Fallback to old format for backward compatibility
          if (expertResponse.includes('FINAL DECISION: MERGE')) {
            recommendation = 'APPROVE';
            console.log('Expert decision: MERGE (legacy)');
          } else if (expertResponse.includes('FINAL DECISION: REJECT')) {
            recommendation = 'REQUEST_CHANGES';
            console.log('Expert decision: REJECT (legacy)');
          } else if (expertResponse.includes('FINAL DECISION: SUGGEST')) {
            recommendation = 'SUGGEST';
            console.log('Expert decision: SUGGEST (legacy)');
            
            // Extract improvements (old format)
            const improvementsMatch = expertResponse.match(/IMPROVEMENTS NEEDED:([\s\S]*?)(?:\n\n|$)/);
            if (improvementsMatch) {
              const improvementsList = improvementsMatch[1].trim();
              improvements = improvementsList.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim());
            }
          }
        }
        
        // Fallback to score-based logic if no explicit decision
        if (!structuredMatch && !expertResponse.includes('FINAL DECISION:')) {
          // Use extracted score if available, otherwise search for it
          if (!score) {
            const scoreMatches = expertResponse.match(/(?:score|rating)[:\s]*(\d+\.?\d*)\/10/i);
            if (scoreMatches) {
              score = parseFloat(scoreMatches[1]);
            }
          }
          
          if (score !== null) {
            if (score >= 8.5) {
              recommendation = 'APPROVE';
              console.log(`Auto-approving based on high score: ${score}/10`);
            } else if (score >= 6.0) {
              recommendation = 'SUGGEST';
              console.log(`Suggesting improvements based on moderate score: ${score}/10`);
            }
          }
        }
        
        return {
          report: `### 🔍 3-Thread Evaluation Results\n\n**Test Scenario:**\n"Analyze the command 'sudo rm -rf /var/lib/docker' in a production environment"\n\n**Thread A (Current Prompt Response):**\n${threadA.content[0].text}\n\n**Thread B (Proposed Prompt Response):**\n${threadB.content[0].text}\n\n**Thread C (Expert Analysis):**\n${expertResponse}\n\n`,
          recommendation: recommendation,
          improvements: improvements,
          improvement: recommendation === 'APPROVE' ? 1 : 0
        };
      }
    };
    
    // Process each changed file
    let fullReport = `## 🏦 Prompt Expert Bank - Evaluation Report\n\n`;
    fullReport += `*Domain Expert: ${expertModule.name || domain}*\n`;
    fullReport += `*Timestamp: ${new Date().toISOString()}*\n`;
    
    // Add iteration tracking to report
    if (improvementCycles > 0) {
      fullReport += `*Improvement Iteration: ${improvementCycles + 1}*\n`;
      if (improvementCycles >= 3) {
        fullReport += `\n⚠️ **Warning**: This PR has gone through ${improvementCycles} improvement cycles. Consider manual review if improvements are not converging.\n`;
      }
    }
    
    fullReport += `\n`;
    
    let overallRecommendation = 'APPROVE';
    let totalImprovement = 0;
    let overallImprovements = [];
    
    for (const file of promptFiles) {
      fullReport += `## 📄 File: ${file.filename}\n\n`;
      fullReport += `### Change Summary\n`;
      fullReport += `- **Status**: ${file.status}\n`;
      fullReport += `- **Lines changed**: +${file.additions} -${file.deletions}\n\n`;
      
      // Get the old and new content
      const oldContent = file.status === 'added' ? '' : await getFileContent(octokit, OWNER, REPO, file.filename, file.previous_filename, 'base');
      const newContent = await getFileContent(octokit, OWNER, REPO, file.filename, null, 'head');
      
      // Use expert module to evaluate
      const evaluation = await expertModule.evaluatePrompts(oldContent, newContent, anthropic);
      
      // Add evaluation results to report
      fullReport += evaluation.report || '### Evaluation Results\n\nNo detailed report provided by expert module.\n\n';
      
      // Update overall recommendation based on expert evaluation
      if (evaluation.recommendation === 'REJECT' || evaluation.recommendation === 'REQUEST_CHANGES') {
        overallRecommendation = 'REQUEST_CHANGES';
      } else if (evaluation.recommendation === 'SUGGEST' && overallRecommendation !== 'REQUEST_CHANGES') {
        overallRecommendation = 'SUGGEST';
        // Store improvements for later use
        if (evaluation.improvements && evaluation.improvements.length > 0) {
          overallImprovements = evaluation.improvements;
        }
      }
      
      if (evaluation.improvement !== undefined) {
        totalImprovement += evaluation.improvement;
      }
    }
    
    // Add final recommendation based on three outcomes
    fullReport += `## 🎯 Final Recommendation\n\n`;
    
    if (overallRecommendation === 'APPROVE') {
      fullReport += `### ✅ MERGE - Approved for Production\n\n`;
      fullReport += `The expert has determined that the new prompt implementation is superior and ready for deployment.\n\n`;
      fullReport += `**Ready to merge** ✅`;
    } else if (overallRecommendation === 'SUGGEST') {
      fullReport += `### 💡 SUGGEST - Improvements Needed\n\n`;
      fullReport += `The expert has identified that while the prompt shows promise, it needs specific improvements before merging.\n\n`;
      
      if (overallImprovements.length > 0) {
        fullReport += `**Required Improvements:**\n`;
        overallImprovements.forEach(improvement => {
          fullReport += `${improvement}\n`;
        });
        fullReport += `\n`;
      }
      
      fullReport += `### 🔧 Implementation Options\n\n`;
      fullReport += `You can implement these improvements in two ways:\n\n`;
      fullReport += `**Option 1 - Automated (Claude)**: Comment with\n`;
      fullReport += `\`\`\`\n@claude please implement the improvements suggested above\n\`\`\`\n\n`;
      fullReport += `**Option 2 - Targeted (PromptExpert)**: Comment with\n`;
      fullReport += `\`\`\`\n@promptexpert ${domain} --suggest:"your specific improvement request"\n\`\`\`\n\n`;
      fullReport += `**Status:** Awaiting implementation choice 🔄`;
    } else {
      // REJECT case
      fullReport += `### ❌ REJECT - Critical Issues Found\n\n`;
      fullReport += `The expert has determined that the new prompt has critical flaws or is inferior to the current version.\n\n`;
      fullReport += `**Action Required:** Please review the expert's analysis above and create a new implementation that addresses the fundamental issues.\n\n`;
      fullReport += `**PR will be closed** ❌`;
    }
    
    // Post comment
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: PR_NUMBER,
      body: fullReport
    });
    
    // Handle PR actions based on evaluation result
    const autoCloseOnFail = process.env.AUTO_CLOSE_ON_FAIL !== 'false';
    
    if (overallRecommendation === 'APPROVE') {
      // MERGE case - Auto-merge approved PRs
      console.log('Expert decision: MERGE - Auto-merging PR...');
      try {
        await octokit.pulls.merge({
          owner: OWNER,
          repo: REPO,
          pull_number: PR_NUMBER,
          commit_title: `PromptExpert: MERGE approved`,
          commit_message: `Automatically merged after expert evaluation.\n\n✅ Expert decision: MERGE\n📊 The new prompt implementation is superior and ready for production\n🤖 Merged by PromptExpert system at ${new Date().toISOString()}`,
          merge_method: 'squash'
        });
        
        await octokit.issues.createComment({
          owner: OWNER,
          repo: REPO,
          issue_number: PR_NUMBER,
          body: `🎉 **PR automatically merged!**\n\n✅ Expert decision: **MERGE**\n🚀 The improved prompt is now live in the main branch.`
        });
      } catch (mergeError) {
        console.error('Failed to merge PR:', mergeError.message);
        await octokit.issues.createComment({
          owner: OWNER,
          repo: REPO,
          issue_number: PR_NUMBER,
          body: `✅ **Expert approved (MERGE)** but auto-merge failed: ${mergeError.message}\n\nPlease merge manually - the evaluation was successful!`
        });
      }
    } else if (overallRecommendation === 'SUGGEST') {
      // SUGGEST case - Invoke @claude to implement improvements
      console.log('Expert decision: SUGGEST - Invoking @claude for improvements...');
      
      // Check if we've hit the improvement limit
      if (improvementCycles >= 5) {
        console.log('Maximum improvement cycles reached - converting to manual review');
        await octokit.issues.createComment({
          owner: OWNER,
          repo: REPO,
          issue_number: PR_NUMBER,
          body: `🛑 **Maximum improvement cycles reached (${improvementCycles})**\n\n` +
                `This PR has undergone multiple automated improvement attempts without converging to an acceptable solution.\n\n` +
                `**Manual intervention required**: Please review the expert feedback history and make the necessary changes manually.\n\n` +
                `The PR will remain open for manual improvements.`
        });
      } else {
        // Post instructions for implementing improvements
        const iterationNote = improvementCycles > 0 ? `\n\n📊 This is improvement iteration #${improvementCycles + 1}` : '';
        
        await octokit.issues.createComment({
          owner: OWNER,
          repo: REPO,
          issue_number: PR_NUMBER,
          body: `💡 **Expert Suggestions Available**\n\n` +
                `The expert has identified improvements needed for this prompt. You have two options:\n\n` +
                `**1. Full Implementation (@claude)**\n` +
                `Comment:\n\`\`\`\n@claude please implement the improvements suggested by the expert above\n\`\`\`\n\n` +
                `**2. Targeted Implementation (@promptexpert)**\n` +
                `Comment:\n\`\`\`\n@promptexpert ${domain} --suggest:"your specific improvement"\n\`\`\`\n` +
                `Example:\n\`\`\`\n@promptexpert security --suggest:"Add risk scoring from 0-10 and provide safer alternatives"\n\`\`\`${iterationNote}`
        });
      }
      
      // Do not close the PR - let @claude work on it
      console.log('PR remains open for improvements');
    } else if (autoCloseOnFail) {
      // REJECT case - Close the PR
      console.log('Expert decision: REJECT - Closing PR...');
      await octokit.pulls.update({
        owner: OWNER,
        repo: REPO,
        pull_number: PR_NUMBER,
        state: 'closed'
      });
      
      await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: PR_NUMBER,
        body: `🚫 **PR automatically closed**\n\n❌ Expert decision: **REJECT**\n\nThe expert found critical issues with this implementation. Please review the detailed analysis above and create a new PR that addresses the fundamental problems identified.`
      });
    }
    
    console.log('Evaluation completed successfully');
    
  } catch (error) {
    console.error('Evaluation error:', error);
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: PR_NUMBER,
      body: `❌ Evaluation failed: ${error.message}`
    });
    throw error;
  }
}

async function getFileContent(octokit, owner, repo, path, previousPath, refType) {
  try {
    let ref;
    if (refType === 'head') {
      // Get from PR branch
      ref = `refs/pull/${process.env.PR_NUMBER}/head`;
    } else if (refType === 'base') {
      // Get from base branch
      ref = process.env.GITHUB_BASE_REF || 'main';
    } else {
      // Default behavior
      ref = process.env.GITHUB_BASE_REF || 'main';
    }
    
    const { data } = await octokit.repos.getContent({
      owner: owner,
      repo: repo,
      path: previousPath || path,
      ref: ref
    });
    
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
  } catch (error) {
    console.log(`Could not fetch previous version of ${path}: ${error.message}`);
  }
  return '';
}

evaluate().catch(err => {
  console.error(err);
  process.exit(1);
});