/**
 * Simple API endpoint for GitHub webhook integration
 */

const express = require('express');
const GitHubIntegration = require('./github-integration');

const app = express();
app.use(express.json());

// Initialize integration
const integration = new GitHubIntegration(
  process.env.GITHUB_TOKEN,
  process.env.ANTHROPIC_API_KEY
);

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  const { action, pull_request, repository } = req.body;
  
  // Only process when PR is opened or synchronized
  if (action === 'opened' || action === 'synchronize') {
    const owner = repository.owner.login;
    const repo = repository.name;
    const prNumber = pull_request.number;
    
    // Process asynchronously
    integration.evaluatePR(owner, repo, prNumber)
      .catch(error => console.error('Evaluation error:', error));
    
    res.status(200).json({ status: 'evaluation started' });
  } else {
    res.status(200).json({ status: 'ignored' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'prompt-expert-bank' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Prompt Expert Bank API listening on port ${PORT}`);
});

module.exports = app;