# Expert Loading Examples

The prompt-expert system supports loading expert definitions from various sources:

## 1. Built-in Experts (Aliases)
These are predefined in `expert-aliases.json`:
```
@prompt-expert programming --repo-path="test/context"
@prompt-expert security --repo-path="my-app"
@prompt-expert data-analysis --repo-path="analytics"
```

## 2. External GitHub Repository Experts
Load expert definitions from any GitHub repository using the `repo:path` format:

### GitHub Shorthand Format
```
# Load expert from facebook/react repository
@prompt-expert facebook/react:docs/prompts/code-review.md --repo-path="my-project"

# Load expert from microsoft/TypeScript
@prompt-expert microsoft/TypeScript:docs/ai-assistant.md --repo-path="src"

# Load expert from openai/gpt-best-practices
@prompt-expert openai/gpt-best-practices:prompts/engineering.md --repo-path="."
```

### Full GitHub URL Format
```
# Using full GitHub URL
@prompt-expert https://github.com/anthropics/anthropic-cookbook:prompts/coding-assistant.md --repo-path="my-app"

# Another example
@prompt-expert github.com/google/gemini-prompts:templates/reviewer.md --repo-path="backend"
```

## 3. Local Path Experts
Load from local filesystem:
```
# Relative path from project root
@prompt-expert ./custom-prompts/my-expert.md --repo-path="src"

# Absolute path
@prompt-expert /home/user/prompts/domain-expert.md --repo-path="."
```

## 4. Combined Examples
Load expert from one repository and context from another:

```
# Use Google's code review expert on Facebook's React codebase
@prompt-expert google/eng-practices:review/prompt.md --repo-path="facebook/react"

# Use OpenAI's prompt engineering expert on your local project
@prompt-expert openai/cookbook:prompts/engineer.md --repo-path="./my-project"

# Use Microsoft's TypeScript expert on Django codebase
@prompt-expert microsoft/TypeScript:docs/assistant.md --repo-path="django/django"
```

## How It Works

1. **Expert Loading**: The system fetches the expert definition from the specified source
2. **Context Loading**: The repo-path can be:
   - Local directory: `./src`, `test/fixtures`
   - GitHub repo: `owner/repo` or `https://github.com/owner/repo`
3. **Evaluation**: Both are combined to evaluate PR changes

## Caching

- Expert definitions from external repos are cached for 1 hour
- Repository contexts are loaded fresh each time
- Cache is stored in `.expert-cache/` directory

## Examples for Popular Repositories

```bash
# Use Vercel's Next.js expert
@prompt-expert vercel/next.js:docs/ai-guide.md --repo-path="my-nextjs-app"

# Use Django's contribution guide as expert
@prompt-expert django/django:docs/contributing.md --repo-path="my-django-app"

# Use React's development guide
@prompt-expert facebook/react:docs/development.md --repo-path="my-react-app"

# Use Vue.js style guide as expert
@prompt-expert vuejs/vue:docs/style-guide.md --repo-path="my-vue-app"
```

## Creating Custom Expert Definitions

You can create your own expert definitions in any public GitHub repository:

1. Create a markdown file with your expert prompt
2. Push it to a public GitHub repository
3. Reference it using the `repo:path` format

Example expert definition structure:
```markdown
# Expert: Code Review Specialist

You are an expert code reviewer focusing on:
- Performance optimization
- Security best practices
- Code maintainability
- Test coverage

When reviewing code:
1. Check for common vulnerabilities
2. Suggest performance improvements
3. Ensure proper error handling
4. Verify test coverage

[Additional instructions...]
```