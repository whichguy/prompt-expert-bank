#!/usr/bin/env node

/**
 * Example: Using ABTest with Size Limits and Protection
 * Demonstrates safe loading of large contexts without overwhelming resources
 */

const { ABTestTool } = require('../lib/abtest/ABTestTool');
const { Anthropic } = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

async function runSafeManagedABTest() {
  // Load configuration
  const limitsConfig = JSON.parse(
    await fs.readFile(path.join(__dirname, '../config/abtest-limits.json'), 'utf8')
  );

  // Initialize clients
  const octokit = new Octokit({ 
    auth: process.env.GITHUB_TOKEN 
  });
  
  const anthropic = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
  });

  // Create size-managed ABTest tool
  const abTest = new ABTestToolWithLimits({
    octokit,
    anthropic,
    repoOwner: 'whichguy',
    repoName: 'prompt-expert-bank'
  });

  console.log('🛡️ Running ABTest with Size Protection\n');

  // Example 1: Small context (safe for quick tests)
  console.log('📦 Example 1: Small Context Test');
  
  const smallResult = await abTest.executeABTest({
    expertPath: 'expert-definitions/programming-expert.md',
    promptA: 'prompts/code-reviewer-v1.md@main',
    promptB: 'prompts/code-reviewer-v2.md',
    contextPaths: [
      'src/utils',      // Small folder
      'README.md',      // Single file
      'package.json'    // Config file
    ],
    sizeLimits: limitsConfig.presets.small
  });

  console.log('Size Report:', smallResult.sizeReport.summary);
  console.log('Health Status:', smallResult.sizeReport.health);
  console.log('Token Usage:', smallResult.sizeReport.limits.tokenUsage);
  console.log('Memory Usage:', smallResult.sizeReport.limits.memoryUsage);

  // Example 2: Medium context with warnings
  console.log('\n📦 Example 2: Medium Context with Monitoring');
  
  const mediumResult = await abTest.executeABTest({
    expertPath: 'expert-definitions/data-analysis-expert.md',
    promptA: 'prompts/analyzer-v1.md',
    promptB: 'prompts/analyzer-v2.md',
    contextPaths: [
      'src',                    // Entire source folder
      'tests',                  // Test folder
      'docs',                   // Documentation
      'examples'                // Examples folder
    ],
    contextOptions: {
      maxDepth: 2,              // Limit recursion
      excludePatterns: [/node_modules/, /dist/]
    },
    sizeLimits: limitsConfig.presets.medium
  });

  // Display warnings if any
  if (mediumResult.sizeReport.warnings.length > 0) {
    console.log('⚠️ Warnings:', mediumResult.sizeReport.warnings);
  }
  
  console.log('Files Processed:', mediumResult.sizeReport.summary.totalFiles);
  console.log('Files Skipped:', mediumResult.sizeReport.performance.skippedFiles);
  console.log('Recommendations:', mediumResult.recommendations);

  // Example 3: Large cross-repo context with protection
  console.log('\n📦 Example 3: Large Cross-Repo Context');
  
  const largeResult = await abTest.executeABTest({
    expertPath: 'expert-definitions/security-expert.md',
    promptA: 'prompts/security-v1.md',
    promptB: 'prompts/security-v2.md',
    contextPaths: [
      // Multiple large repositories
      'facebook/react:packages/react/src',
      'microsoft/vscode:src/vs/editor',
      'nodejs/node:lib',
      'tensorflow/tensorflow:tensorflow/python',
      
      // Local large folders
      'src',
      'lib',
      'vendor',
      
      // Multimodal content
      'docs/architecture.pdf',
      'diagrams',
      'screenshots'
    ],
    contextOptions: {
      // Use progressive loading strategy
      strategy: limitsConfig.strategies.progressive,
      
      // Prioritize certain file types
      prioritize: true,
      
      // Sample large folders instead of full load
      sampleLargeFolders: true,
      maxFilesPerFolder: 10,
      
      // Enable compression for large files
      compressionEnabled: true
    },
    sizeLimits: limitsConfig.presets.large
  });

  // Detailed reporting
  console.log('\n📊 Detailed Size Report:');
  console.log('By Type:', JSON.stringify(largeResult.sizeReport.byType, null, 2));
  console.log('Performance:', largeResult.sizeReport.performance);
  console.log('Health:', largeResult.sizeReport.health, '-', largeResult.sizeReport.healthMessage);

  // Example 4: Testing with custom limits
  console.log('\n📦 Example 4: Custom Limits for CI/CD');
  
  const cicdResult = await abTest.executeABTest({
    expertPath: 'expert-definitions/general-expert.md',
    promptA: 'prompts/assistant-v1.md',
    promptB: 'prompts/assistant-v2.md',
    contextPaths: process.env.CI ? [
      // Lighter context for CI environment
      'src/main',
      'tests/unit',
      'README.md'
    ] : [
      // Full context for local development
      'src',
      'tests',
      'docs',
      'examples'
    ],
    sizeLimits: {
      // Custom limits for CI/CD
      maxTotalSizeMB: process.env.CI ? 20 : 50,
      maxTokens: process.env.CI ? 75000 : 150000,
      maxFiles: process.env.CI ? 30 : 100,
      strategy: {
        mode: process.env.CI ? 'strict' : 'progressive',
        stopOnWarning: process.env.CI,
        compressionEnabled: true
      }
    }
  });

  console.log('CI/CD Safe:', cicdResult.success);
  console.log('Errors:', cicdResult.sizeReport.errors);

  // Example 5: Handling size limit errors gracefully
  console.log('\n📦 Example 5: Graceful Error Handling');
  
  try {
    const overloadResult = await abTest.executeABTest({
      expertPath: 'expert-definitions/programming-expert.md',
      promptA: 'prompts/v1.md',
      promptB: 'prompts/v2.md',
      contextPaths: [
        // Intentionally large context
        'torvalds/linux:kernel',           // Huge!
        'apache/spark:core/src',           // Large
        'kubernetes/kubernetes:pkg',       // Very large
        'chromium/chromium:src'           // Massive
      ],
      sizeLimits: {
        maxTotalSizeMB: 100,
        maxTokens: 200000,
        strategy: {
          mode: 'strict',
          stopOnCritical: true,
          sampleLargeFolders: true,
          maxFilesPerFolder: 5
        }
      }
    });

    if (!overloadResult.success) {
      console.log('❌ Test stopped due to size limits');
      console.log('Report:', overloadResult.sizeReport);
      console.log('Recommendations:', overloadResult.recommendations);
      
      // Retry with reduced context
      console.log('\n🔄 Retrying with reduced context...');
      const retryResult = await abTest.executeABTest({
        expertPath: 'expert-definitions/programming-expert.md',
        promptA: 'prompts/v1.md',
        promptB: 'prompts/v2.md',
        contextPaths: [
          // Reduced context - specific files only
          'torvalds/linux:kernel/sched/core.c',
          'apache/spark:core/src/main/scala/org/apache/spark/SparkContext.scala',
          'kubernetes/kubernetes:pkg/kubelet/kubelet.go'
        ],
        sizeLimits: limitsConfig.presets.small
      });
      
      console.log('Retry Success:', retryResult.success);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Example 6: Progressive loading with early termination
  console.log('\n📦 Example 6: Progressive Loading Demo');
  
  const progressiveResult = await abTest.executeABTest({
    expertPath: 'expert-definitions/general-expert.md',
    promptA: 'prompts/v1.md',
    promptB: 'prompts/v2.md',
    contextPaths: [
      // Ordered by priority
      'src/core',           // Most important
      'src/utils',          // Important
      'src/components',     // Nice to have
      'tests',              // Optional
      'docs',               // Optional
      'examples',           // Optional
      'benchmarks',         // Optional
      'scripts'             // Optional
    ],
    contextOptions: {
      prioritize: true,     // Load in order
      strategy: {
        mode: 'progressive',
        stopOnWarning: false,
        stopOnCritical: true,
        prioritizeByType: ['code', 'text', 'config']
      }
    },
    sizeLimits: {
      maxTotalSizeMB: 25,
      maxTokens: 100000,
      // Will stop loading when limits reached
    }
  });

  console.log('Loaded paths before limit:', 
    progressiveResult.context.files.map(f => f.path).slice(0, 10));
  console.log('Stopped at:', progressiveResult.sizeReport.summary);

  // Generate final summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 FINAL SUMMARY');
  console.log('='.repeat(60));
  
  const allResults = [smallResult, mediumResult, largeResult, cicdResult, progressiveResult];
  
  let totalTokens = 0;
  let totalMemory = 0;
  let totalFiles = 0;
  
  for (const result of allResults) {
    if (result.sizeReport) {
      totalTokens += result.sizeReport.summary.totalTokens || 0;
      totalMemory += parseFloat(result.sizeReport.summary.totalMemoryMB || 0);
      totalFiles += result.sizeReport.summary.totalFiles || 0;
    }
  }
  
  console.log(`Total Tokens Used: ${totalTokens.toLocaleString()}`);
  console.log(`Total Memory Used: ${totalMemory.toFixed(2)}MB`);
  console.log(`Total Files Processed: ${totalFiles}`);
  console.log(`Average Token Efficiency: ${(totalTokens / totalFiles).toFixed(0)} tokens/file`);
  
  // Cost estimation (rough)
  const estimatedCost = (totalTokens / 1000) * 0.015; // Rough Claude pricing
  console.log(`Estimated Cost: $${estimatedCost.toFixed(2)}`);
}

// Helper: Monitor real-time resource usage
function monitorResources(abTest) {
  const interval = setInterval(() => {
    const usage = process.memoryUsage();
    const tracking = abTest.tracking;
    
    console.log(`📊 Live: Memory ${(usage.heapUsed / 1024 / 1024).toFixed(1)}MB | ` +
                `Tokens ~${tracking.currentTokenEstimate} | ` +
                `Files ${tracking.totalFilesLoaded}`);
    
    if (tracking.currentTokenEstimate > 180000) {
      console.log('⚠️ CRITICAL: Approaching token limit!');
    }
  }, 2000);
  
  return interval;
}

// Run with monitoring
if (require.main === module) {
  runSafeManagedABTest()
    .then(() => console.log('\n✅ All tests completed successfully'))
    .catch(console.error);
}

module.exports = { runSafeManagedABTest };