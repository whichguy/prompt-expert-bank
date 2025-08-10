# Setting Up Custom Bot Identity for Prompt Expert

## Option 1: Create a Dedicated GitHub Bot Account (Recommended)

### Steps:
1. **Create a new GitHub account** for your bot:
   - Sign up at github.com with name like "prompt-expert-bot" or "prompt-expert-ai"
   - Use a dedicated email for the bot

2. **Customize the bot profile**:
   - Upload a custom avatar/icon
   - Set display name to "Prompt Expert" or "Prompt Expert AI"
   - Add bio: "AI-powered code review and prompt evaluation assistant"
   - Set location/company/website as desired

3. **Generate a Personal Access Token (PAT)**:
   - Go to Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with scopes:
     - `repo` (full control)
     - `workflow` (update workflows)
     - `write:discussion` (if using discussions)

4. **Update repository secrets**:
   ```bash
   # Add the bot's PAT as a secret
   gh secret set PROMPT_EXPERT_TOKEN --body "ghp_YOUR_BOT_TOKEN"
   ```

5. **Update workflow to use bot token**:
   ```yaml
   # In .github/workflows/prompt-expert.yml
   - name: Post response
     env:
       GITHUB_TOKEN: ${{ secrets.PROMPT_EXPERT_TOKEN }}  # Use bot token instead
   ```

## Option 2: GitHub App (More Professional)

### Steps:
1. **Create a GitHub App**:
   - Go to Settings → Developer settings → GitHub Apps → New GitHub App
   - Name: "Prompt Expert"
   - Homepage URL: Your repo URL
   - Webhook URL: Not required for actions
   - Upload custom logo/icon

2. **Configure permissions**:
   - Repository permissions:
     - Contents: Read & Write
     - Issues: Write
     - Pull requests: Write
     - Actions: Read
     - Metadata: Read

3. **Install the App**:
   - Install on your repository
   - Note the Installation ID

4. **Generate and use App token in workflow**:
   ```yaml
   - name: Generate token
     id: generate-token
     uses: actions/create-github-app-token@v1
     with:
       app-id: ${{ secrets.APP_ID }}
       private-key: ${{ secrets.APP_PRIVATE_KEY }}
   
   - name: Post comment
     env:
       GITHUB_TOKEN: ${{ steps.generate-token.outputs.token }}
   ```

## Option 3: Custom Action with User Association

### Use `actions/github-script` with custom author:
```yaml
- name: Post as Prompt Expert
  uses: actions/github-script@v7
  with:
    github-token: ${{ secrets.PROMPT_EXPERT_TOKEN }}
    script: |
      const body = `## 🤖 Prompt Expert Analysis
      
      ${analysisResult}
      
      ---
      *Powered by Prompt Expert AI*`;
      
      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: body
      });
```

## Customization Tips

### 1. **Custom Avatar Ideas**:
- Robot icon with graduation cap (expert)
- Brain with circuit patterns
- Magnifying glass with code symbols
- AI/ML themed icons

### 2. **Bot Naming Conventions**:
- `prompt-expert[bot]`
- `prompt-expert-ai`
- `PromptExpertBot`
- `prompt-expert-assistant`

### 3. **Profile Customization**:
```markdown
# Bot Profile Bio Example
🤖 Automated Prompt Engineering Assistant
📊 A/B Testing & Code Review Expert
🔍 Powered by Claude AI
📝 Evaluating prompts for better AI interactions
```

### 4. **Comment Styling**:
Add custom headers/footers to make comments distinctive:
```javascript
const header = `
<img src="https://your-icon-url.png" width="24" align="left">

## Prompt Expert Analysis

---
`;

const footer = `
---
<sub>🤖 Prompt Expert v2.0 | [Documentation](link) | [Report Issue](link)</sub>
`;
```

## Implementation in Current Workflow

Update `.github/workflows/prompt-expert.yml`:

```yaml
env:
  # Use dedicated bot token
  GITHUB_TOKEN: ${{ secrets.PROMPT_EXPERT_TOKEN }}
  
# Or for GitHub App
- uses: actions/create-github-app-token@v1
  id: app-token
  with:
    app-id: ${{ secrets.PROMPT_EXPERT_APP_ID }}
    private-key: ${{ secrets.PROMPT_EXPERT_PRIVATE_KEY }}

- name: Post Analysis
  env:
    GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

## Quick Start (Bot Account Method)

1. Create new GitHub account "prompt-expert-bot"
2. Set avatar and profile
3. Generate PAT with repo access
4. Add PAT as `PROMPT_EXPERT_TOKEN` secret:
   ```bash
   gh secret set PROMPT_EXPERT_TOKEN
   ```
5. Update workflow to use new token

This will make all comments appear from your custom bot account with its own avatar and name!