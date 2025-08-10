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

// If run directly, show CLI help
if (require.main === module) {
  module.exports.cli();
}