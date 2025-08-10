#!/usr/bin/env node

/**
 * API Entry Point for Prompt Expert Bank
 * This file serves as the main entry point when the package is imported as a module
 */

const { ABTestTool } = require('../src/lib/abtest/ABTestTool');
const { PromptRoleManager } = require('../src/lib/evaluation/PromptRoleManager');
const { ExpertEvaluationIntegration } = require('../src/lib/evaluation/ExpertEvaluationIntegration');

module.exports = {
  // Core Tools
  ABTestTool,
  PromptRoleManager,
  ExpertEvaluationIntegration,
  
  // Version info
  version: require('../package.json').version,
  
  // Helper to run as CLI
  cli: () => {
    console.log('Prompt Expert Bank CLI');
    console.log('Use as GitHub Action or import as module');
    console.log('Version:', require('../package.json').version);
  }
};

// If run directly, check if it's a GitHub Action or CLI
if (require.main === module) {
  // Check if this is being run as a GitHub Action
  if (process.env.GITHUB_ACTIONS) {
    // Run the prompt expert session
    const PromptExpertSession = require('../src/scripts/prompt-expert-session');
    const session = new PromptExpertSession();
    session.run().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  } else {
    // Show CLI help
    module.exports.cli();
  }
}