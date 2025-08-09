# 🚀 Claude GitHub Integration Setup Guide

## Prerequisites

Before setting up the Claude integration, you need:

1. **Anthropic API Key** - Get one from [Anthropic Console](https://console.anthropic.com/)
2. **GitHub repository admin access** - Required to add secrets

## 🔧 Setup Instructions

### Step 1: Add GitHub Secrets

Go to your repository settings and add these secrets:

1. Navigate to: `https://github.com/whichguy/prompt-expert-bank/settings/secrets/actions`

2. Click **"New repository secret"** and add:

   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: Your Anthropic API key (starts with `sk-ant-api...`)

### Step 2: Enable GitHub Actions

1. Go to: `https://github.com/whichguy/prompt-expert-bank/settings/actions`
2. Ensure **"Allow all actions and reusable workflows"** is selected
3. Click **Save**

### Step 3: Commit the Workflow Files

The following files have been created and need to be committed:

```
.github/
├── workflows/
│   └── claude-code.yml          # Main workflow file
├── scripts/
│   ├── claude-code-session-simplified.js
│   ├── package.json
│   └── lib/
│       ├── PromptRoleManager.js
│       ├── PromptVersionManager.js
│       └── ExpertEvaluationIntegration.js
```

### Step 4: Test the Integration

Create a test issue or PR comment with one of these commands:

```bash
# Standard GitHub bot mode
@claude-code help me understand this codebase

# Role-based execution
@claude-code --role=security analyze potential vulnerabilities

# Expert evaluation mode
@prompt-expert programming review the code quality
```

## 📋 Available Commands

### Standard Mode
- `@claude-code <task>` - Execute any development task

### Role-Based Mode
- `@claude-code --role=security <task>` - Security expert mode
- `@claude-code --role=programming <task>` - Programming expert mode
- `@claude-code --role=financial <task>` - Financial expert mode
- `@claude-code --role=data-analysis <task>` - Data analysis expert mode

### Expert Evaluation Mode
- `@prompt-expert <domain>` - Evaluate prompt changes
- `@prompt-expert <domain> <specific-request>` - Custom evaluation

## 🔍 Troubleshooting

### Claude doesn't respond to comments

1. **Check workflow runs**: 
   - Go to `Actions` tab
   - Look for "Claude Code Integration" workflow
   - Check for errors in the logs

2. **Verify secrets**:
   - Ensure `ANTHROPIC_API_KEY` is set correctly
   - No extra spaces or quotes in the secret value

3. **Check command format**:
   - Must start with `@claude-code` or `@prompt-expert`
   - Case-insensitive but spelling must be exact

### Workflow fails with API error

1. **Check API key**:
   - Verify it starts with `sk-ant-api`
   - Ensure it's not expired
   - Check you have API credits

2. **Rate limits**:
   - Anthropic API has rate limits
   - Wait a few minutes and try again

### Permission errors

1. **Check workflow permissions**:
   - Go to Settings → Actions → General
   - Under "Workflow permissions", select:
     - ✅ Read and write permissions
     - ✅ Allow GitHub Actions to create and approve pull requests

## 🎯 Features

### Automatic Prompt Evaluation
- Runs automatically when PRs modify prompt files
- Uses 3-thread evaluation model
- Provides MERGE/SUGGEST/REJECT decisions

### GitHub Integration
- Responds to PR comments
- Responds to issue comments  
- Can read and modify files
- Can run commands
- Full GitHub API access

### Expert Personas
- Loads prompts from `expert-definitions/` folder
- Adopts expert knowledge and behavior
- Domain-specific evaluation criteria

## 📊 Monitoring

View all Claude interactions:
1. Go to the **Actions** tab
2. Filter by workflow: "Claude Code Integration"
3. Click on any run to see detailed logs

## 🔒 Security Notes

- API keys are stored as encrypted secrets
- Claude only responds to explicit mentions
- All actions are logged in GitHub Actions
- Rate limiting prevents abuse

## 💡 Tips

1. **Be specific** in your requests to Claude
2. **Use role mode** for domain-specific tasks
3. **Check workflow logs** if something doesn't work
4. **Start simple** with basic commands first

## 📚 Next Steps

1. Test with a simple command in a PR/issue comment
2. Try the expert evaluation on a prompt change PR
3. Experiment with different roles and tasks
4. Customize expert definitions in `expert-definitions/` folder

---

**Need help?** Create an issue with the `claude-integration` label.