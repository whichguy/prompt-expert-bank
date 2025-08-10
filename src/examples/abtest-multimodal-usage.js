#!/usr/bin/env node

/**
 * Example Usage: ABTest with Multimodal Context Priming
 * Demonstrates loading GitHub repo paths, folders, and various file types
 */

const { ABTestToolEnhanced } = require('../lib/ABTestToolEnhanced');
const { Anthropic } = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');

async function runMultimodalABTest() {
  // Initialize clients
  const octokit = new Octokit({ 
    auth: process.env.GITHUB_TOKEN 
  });
  
  const anthropic = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
  });

  // Create enhanced ABTest tool
  const abTest = new ABTestToolEnhanced({
    octokit,
    anthropic,
    repoOwner: 'whichguy',
    repoName: 'prompt-expert-bank'
  });

  // Example 1: Simple folder context loading
  console.log('🧪 Example 1: Testing with folder context');
  
  const result1 = await abTest.executeABTest({
    expertPath: 'expert-definitions/programming-expert.md',
    promptA: 'prompts/code-reviewer-v1.md@main',
    promptB: 'prompts/code-reviewer-v2.md@feature-branch',
    contextPaths: [
      'src/components',  // Load entire folder
      'src/utils',       // Another folder
      'README.md'        // Single file
    ],
    contextOptions: {
      maxDepth: 2,
      maxFiles: 10,
      excludePatterns: [/test/, /\.spec\./]
    }
  });

  console.log('Result 1:', JSON.stringify(result1.verdict, null, 2));

  // Example 2: Cross-repository context with multimodal files
  console.log('\n🧪 Example 2: Cross-repo multimodal context');
  
  const result2 = await abTest.executeABTest({
    expertPath: 'whichguy/prompt-expert-bank:expert-definitions/data-analysis-expert.md',
    promptA: 'prompts/data-analyzer-v1.md',
    promptB: 'prompts/data-analyzer-v2.md',
    contextPaths: [
      'microsoft/vscode:src/vs/editor',           // VSCode editor source
      'facebook/react:packages/react/src',        // React source
      'anthropics/anthropic-sdk-python:README.md', // Cross-repo README
      'docs/architecture.pdf',                    // PDF document
      'assets/diagrams'                            // Folder with images
    ],
    contextOptions: {
      includePatterns: [/\.(ts|tsx|js|jsx|md|png|jpg|pdf)$/],
      maxTotalSize: 10 * 1024 * 1024  // 10MB limit
    }
  });

  console.log('Result 2:', JSON.stringify(result2.verdict, null, 2));

  // Example 3: Testing with specific file types
  console.log('\n🧪 Example 3: Specific file type testing');
  
  const result3 = await abTest.executeABTest({
    expertPath: 'expert-definitions/security-expert.md',
    promptA: 'prompts/security-auditor-v1.md',
    promptB: 'prompts/security-auditor-v2.md',
    contextPaths: [
      '.github/workflows',        // YAML files
      'package.json',            // JSON config
      'src/**/*.test.js',        // Test files pattern
      'docs/security-policy.pdf', // PDF policy document
      'screenshots'              // Folder with images
    ],
    contextOptions: {
      // Custom configuration for security analysis
      includePatterns: [
        /\.(yml|yaml)$/,  // CI/CD configs
        /\.(json|env)$/,  // Configuration files
        /test/,           // Test files
        /\.pdf$/,         // Policy documents
        /\.(png|jpg)$/    // Screenshots
      ]
    }
  });

  console.log('Result 3:', JSON.stringify(result3, null, 2));

  // Example 4: Complex multimodal scenario
  console.log('\n🧪 Example 4: Complex multimodal analysis');
  
  const complexConfig = {
    expertPath: 'expert-definitions/general-expert.md',
    promptA: {
      path: 'prompts/assistant-v1.md',
      testQuery: 'Analyze the codebase architecture and provide recommendations'
    },
    promptB: {
      path: 'prompts/assistant-v2.md',
      testQuery: 'Analyze the codebase architecture and provide recommendations'
    },
    contextPaths: [
      // Code context
      'src',
      'lib',
      'tests',
      
      // Documentation
      'README.md',
      'CONTRIBUTING.md',
      'docs',
      
      // Visual assets
      'assets/architecture-diagram.png',
      'assets/flow-chart.pdf',
      
      // Configuration
      'package.json',
      'tsconfig.json',
      '.eslintrc.json',
      
      // External references
      'openai/gpt-4:README.md',
      'anthropics/claude-3:docs/capabilities.md'
    ],
    contextOptions: {
      maxDepth: 3,
      maxFilesPerBatch: 20,
      maxTotalSize: 20 * 1024 * 1024,
      
      // Smart filtering
      excludePatterns: [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /coverage/,
        /\.min\./
      ],
      
      // Prioritize important files
      includePatterns: [
        /\.(ts|js|py|go|rs)$/,  // Source code
        /\.(md|rst|txt)$/,       // Documentation
        /\.(json|yaml|toml)$/,   // Configuration
        /\.(png|jpg|svg)$/,      // Images
        /\.pdf$/                 // PDFs
      ]
    }
  };

  const result4 = await abTest.executeABTest(complexConfig);

  // Display comprehensive results
  console.log('\n📊 Comprehensive Results:');
  console.log('Context Summary:', result4.context);
  console.log('Winner:', result4.verdict.winner);
  console.log('Confidence:', result4.verdict.confidence);
  console.log('Context Utilization:', result4.verdict.contextUtilization);
  console.log('Recommendation:', result4.verdict.recommendation);
  console.log('Metrics:', result4.metrics);

  // Example 5: Iterative improvement with context
  console.log('\n🧪 Example 5: Iterative improvement testing');
  
  for (let iteration = 1; iteration <= 3; iteration++) {
    const iterResult = await abTest.executeABTest({
      expertPath: 'expert-definitions/programming-expert.md',
      promptA: `prompts/optimizer-v${iteration}.md`,
      promptB: `prompts/optimizer-v${iteration + 1}.md`,
      contextPaths: [
        'src/optimization',
        'benchmarks/results.json',
        'docs/performance-guide.pdf'
      ],
      contextOptions: {
        iteration: iteration,
        previousFeedback: iteration > 1 ? `Iteration ${iteration - 1} feedback...` : null
      }
    });

    console.log(`Iteration ${iteration} Result:`, iterResult.verdict.recommendation);
    
    if (iterResult.verdict.recommendation === 'DEPLOY') {
      console.log('✅ Optimal version found!');
      break;
    }
  }
}

// Helper function to demonstrate custom context loading
async function loadCustomContext(abTest, patterns) {
  const context = await abTest.loadMultimodalContext(patterns, {
    maxDepth: 5,
    customProcessor: async (file) => {
      // Custom processing for specific file types
      if (file.name.endsWith('.ipynb')) {
        // Handle Jupyter notebooks specially
        return processJupyterNotebook(file);
      }
      return file;
    }
  });
  
  return context;
}

// Example of processing special file types
function processJupyterNotebook(file) {
  // Parse notebook JSON structure
  try {
    const notebook = JSON.parse(file.content);
    return {
      ...file,
      type: 'notebook',
      cells: notebook.cells,
      metadata: notebook.metadata
    };
  } catch (error) {
    return file;
  }
}

// Run examples
if (require.main === module) {
  runMultimodalABTest().catch(console.error);
}

module.exports = { runMultimodalABTest };