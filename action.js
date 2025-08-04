/**
 * GitHub Action entry point for Prompt Expert Bank
 */

const core = require('@actions/core');
const github = require('@actions/github');
const GitHubIntegration = require('./api/github-integration');

async function run() {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const anthropicKey = core.getInput('anthropic-api-key', { required: true });
    const prNumber = core.getInput('pr-number', { required: true });
    
    // Get context
    const { owner, repo } = github.context.repo;
    
    // Initialize integration
    const integration = new GitHubIntegration(githubToken, anthropicKey);
    
    // Evaluate PR
    await integration.evaluatePR(owner, repo, parseInt(prNumber));
    
    core.info('Evaluation completed successfully');
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();