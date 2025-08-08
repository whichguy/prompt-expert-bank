# Expert System Documentation

The Prompt Expert system supports flexible expert definitions from multiple sources, allowing you to use built-in experts, create aliases, or load experts directly from GitHub repositories.

## Expert Loading Methods

### 1. Built-in Experts
Default experts in the `expert-definitions/` directory:
- `security` - Security command analysis
- `programming` - Code generation and review
- `financial` - Financial analysis
- `data-analysis` - Data science and ML
- `general` - General purpose evaluation

```bash
@prompt-expert security
@prompt-expert programming --scenario="API development"
```

### 2. Expert Aliases
Define reusable shortcuts in `expert-aliases.json`:

```json
{
  "aliases": {
    "api-design": {
      "description": "API design and REST principles expert",
      "repo": "myorg/api-standards",
      "path": "prompts/api-expert.md"
    },
    "react": {
      "description": "React development expert",
      "repo": "facebook/react",
      "path": "docs/experts/react-expert.md"
    },
    "k8s": {
      "description": "Kubernetes expert",
      "repo": "kubernetes/kubernetes",
      "path": "docs/prompts/k8s-expert.md",
      "branch": "main"
    }
  }
}
```

Use aliases:
```bash
@prompt-expert api-design
@prompt-expert react --test="Component optimization"
@prompt-expert k8s --focus="deployment,scaling"
```

### 3. Direct GitHub Repository Loading
Load experts directly from any public GitHub repository:

```bash
# Format: repo:path
@prompt-expert myorg/standards:prompts/api-expert.md

# Using parameters
@prompt-expert --expert=aws/aws-cli:prompts/aws-expert.md

# Split repo and path
@prompt-expert --expert-repo=kubernetes/kubernetes --expert-path=docs/k8s-expert.md
```

### 4. Combined with Repository Context
Use custom experts with repository context for enhanced evaluation:

```bash
# Custom expert + repository context
@prompt-expert api-design --repo-path="./src/api" --test="Endpoint validation"

# GitHub expert + local context
@prompt-expert myorg/standards:prompts/security.md --repo-path="./backend"
```

## Expert Definition Format

Expert definitions should follow this structure:

```markdown
# [Domain] Expert

You are an expert in [domain] with deep knowledge of [specifics].

## Core Responsibilities
1. Evaluate prompt quality for [domain] tasks
2. Compare implementation approaches
3. Identify potential issues and improvements

## Evaluation Criteria
- **Accuracy** (25%): Technical correctness
- **Clarity** (25%): Clear instructions and examples
- **Completeness** (25%): Covers edge cases
- **Effectiveness** (25%): Achieves intended goals

## Scoring Guidelines
Rate each criterion 0-10:
- 9-10: Exceptional, production-ready
- 7-8: Good with minor improvements needed
- 5-6: Acceptable but needs work
- 0-4: Significant issues

## Decision Framework
- **MERGE**: Overall score ≥ 8.5
- **SUGGEST**: Score 6-8.5 with specific improvements
- **REJECT**: Score < 6

## Response Format
Provide detailed analysis with:
1. Score breakdown by criterion
2. Specific examples from the prompt
3. Clear improvement suggestions
4. Final recommendation
```

## Caching

Expert definitions loaded from GitHub are cached locally in `.expert-cache/` for performance:
- Cache duration: 1 hour (configurable)
- Manual cache clear: `node scripts/expert-loader.js clear-cache`
- Automatic refresh after cache expiry

## Configuration

### expert-aliases.json
```json
{
  "aliases": {
    "custom-name": {
      "description": "Expert description",
      "repo": "github-org/repo-name",
      "path": "path/to/expert.md",
      "branch": "main"  // optional, defaults to main/master
    }
  },
  "customPaths": {
    "allowRemoteRepos": true,
    "allowLocalPaths": true,
    "cacheDuration": 3600,    // seconds
    "maxFileSize": 100000      // bytes
  }
}
```

## CLI Usage

### List Available Experts
```bash
node scripts/expert-loader.js list
```

### Load and Preview Expert
```bash
# Load by alias
node scripts/expert-loader.js load security

# Load from GitHub
node scripts/expert-loader.js load myorg/repo:path/expert.md
```

### Clear Cache
```bash
node scripts/expert-loader.js clear-cache
```

## Examples

### Example 1: API Design Expert
```bash
# Define alias
{
  "api-design": {
    "repo": "myorg/api-standards",
    "path": "experts/rest-api.md"
  }
}

# Use in PR
@prompt-expert api-design --test="CRUD operations" --focus="REST principles"
```

### Example 2: Cloud Provider Expert
```bash
# Direct from AWS repository
@prompt-expert aws/aws-cli:prompts/aws-expert.md --scenario="Lambda deployment"

# Or from Azure
@prompt-expert Azure/azure-sdk:docs/experts/azure.md --focus="security,compliance"
```

### Example 3: Framework-Specific Expert
```bash
# React expert with component context
@prompt-expert facebook/react:docs/expert.md --repo-path="./src/components"

# Django expert with model context
@prompt-expert django/django:prompts/django.md --repo-path="./backend"
```

## Troubleshooting

### Expert Not Found
- Check the expert name/alias exists
- Verify GitHub repository is public
- Ensure path is correct (case-sensitive)

### Cache Issues
- Clear cache: `node scripts/expert-loader.js clear-cache`
- Check `.expert-cache/` directory permissions
- Verify network access to GitHub

### Loading Errors
- Check `expert-aliases.json` syntax
- Verify GitHub API rate limits
- Ensure file size < 100KB

## Best Practices

1. **Use Aliases** for frequently used experts
2. **Version Control** expert definitions in your org's repo
3. **Cache Management** - Clear cache after major updates
4. **Combine Features** - Use custom experts with repository context
5. **Documentation** - Document custom experts in your org

## Security Notes

- Only public GitHub repositories are supported
- Expert definitions are cached locally
- No credentials are stored or transmitted
- File size limited to 100KB for safety