# Prompt Expert 🤖

Automated LLM prompt evaluation using domain experts with repository context support. Get detailed A/B testing feedback on every pull request with multimodal file analysis.

## 🚀 Quick Start (2 minutes)

```bash
# 1. Create workflow file
mkdir -p .github/workflows
curl -o .github/workflows/prompt-evaluation.yml \
  https://raw.githubusercontent.com/whichguy/prompt-expert/main/examples/workflow-template.yml

# 2. Set API key
gh secret set ANTHROPIC_API_KEY

# 3. Create a PR with prompt changes to see it in action!
```

## 📋 How It Works

### Three-Thread Evaluation Model

1. **Thread A**: Tests current/baseline prompt against test scenarios
2. **Thread B**: Tests PR's new prompt against same scenarios  
3. **Thread C**: Expert compares both results and makes decision

The expert sees actual LLM responses, not just prompt text, enabling real performance comparison.

## 🎯 Key Features

### 1. Flexible Expert System

#### Built-in Experts
- **Programming**: Code generation, review, debugging
- **Security**: Command analysis, risk assessment
- **Financial**: Investment, budgeting, analysis
- **Data Analysis**: Statistics, visualization, ML
- **General**: Fallback for other domains

#### Custom Experts
Load expert definitions from any GitHub repository:

```bash
# Use expert from another repository
@prompt-expert myorg/expert-repo:prompts/api-expert.md

# Or use parameters
@prompt-expert --expert=kubernetes/kubernetes:docs/prompts/k8s-expert.md

# Or split repo and path
@prompt-expert --expert-repo=aws/aws-cli --expert-path=prompts/aws-expert.md
```

#### Expert Aliases
Define shortcuts for frequently used experts in `expert-aliases.json`:

```json
{
  "aliases": {
    "api-design": {
      "description": "API design expert",
      "repo": "myorg/api-standards",
      "path": "prompts/api-expert.md"
    }
  }
}
```

Then use: `@prompt-expert api-design`

### 2. Repository Context Support (NEW!)
Load your codebase as context for more accurate evaluations:

```bash
# Evaluate with repository context
@prompt-expert security --repo-path="./src"

# Or use --context as an alias
@prompt-expert programming --context="./backend" --focus="api-security"
```

#### Supported File Types:
- **Text**: All code files, configs, markdown
- **Images**: .jpg, .png, .gif, .svg (architecture diagrams, screenshots)
- **PDFs**: Documentation, specifications

#### Cache Management:
- Tracks files sent to Claude with reference counting
- Cleans stale files older than 14 days automatically
- Uses git blob hashes for deduplication
- Provides usage statistics and cache savings

### 3. On-Demand Evaluation
Comment on any PR to trigger expert evaluation:

```bash
# Basic evaluation
@prompt-expert programming

# With custom parameters
@prompt-expert security --scenario="SQL injection test" --focus="detection"

# With repository context
@prompt-expert programming --repo-path="./src" --test="API validation"
```

### 4. Automatic Improvements
Three possible outcomes:
- **✅ MERGE** (Score ≥ 8.5/10) - Ready to merge
- **💡 SUGGEST** (Score 6-8.5/10) - Auto-invokes improvements
- **❌ REJECT** (Score < 6/10) - Needs significant rework

## 🛠️ Installation

### Basic Setup
Use the quick start above for standard evaluation.

### Advanced Setup with Context
```yaml
name: Prompt Evaluation
on:
  pull_request:
    paths:
      - '**/*prompt*.md'
      
jobs:
  evaluate-prompts:
    uses: whichguy/prompt-expert/.github/workflows/evaluate-prompts.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number }}
      repository: ${{ github.repository }}
      repo-path: "./src"  # Optional: Add repository context
    secrets:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## 💬 Manual Commands

### Basic Commands
```bash
@prompt-expert help                    # Show help
@prompt-expert programming             # Run specific expert
@prompt-expert all                    # Run all applicable experts
```

### Advanced Parameters
```bash
# Custom test scenarios
@prompt-expert programming --scenario="Debug memory leak" --test="Python profiling"

# Focus areas
@prompt-expert security --focus="authentication,encryption"

# Custom evaluation criteria
@prompt-expert financial --criteria="accuracy,compliance,risk"

# Custom scoring weights
@prompt-expert programming --score-weight="security:40,performance:30,readability:30"

# Repository context
@prompt-expert security --repo-path="./backend" --scenario="API security audit"

# Custom expert from GitHub
@prompt-expert --expert=myorg/standards:prompts/api-expert.md --test="REST API design"

# Expert alias with context
@prompt-expert api-design --repo-path="./src/api" --focus="RESTful principles"
```

## 📊 Evaluation Report Example

```
🏦 Prompt Expert - Evaluation Report

Security Command Analysis Expert
Repository Context: 45 files loaded (240KB)

Previous Performance:        New Performance:
- Detection Rate: 33.3%     - Detection Rate: 100.0% ✅
- False Positives: 66.7%    - False Positives: 0.0% ✅
- Context Aware: 0.0%       - Context Aware: 100.0% ✅
- Overall Score: 15.8%      - Overall Score: 84.4% ✅

✅ APPROVE - Improvement: +68.6%
Ready to merge ✅
```

## 🏗️ Architecture

### Directory Structure
```
prompt-expert/
├── .github/
│   ├── workflows/           # GitHub Actions workflows
│   └── scripts/             # Evaluation scripts
├── expert-definitions/      # Domain expert prompts (Markdown)
├── test-scenarios/          # Test cases per domain (JSON)
├── scripts/                 # Utility scripts
│   ├── repo-context-v2.js  # Context loader with multimodal support
│   └── claude-cache-manager.js # Cache management
├── docs/                    # Additional documentation
└── examples/                # Sample prompts and workflows
```

### How Context Works
1. **Loads** relevant files (text, images, PDFs)
2. **Uses git hashes** for efficient caching
3. **Tracks** what's sent to Claude API
4. **Cleans** old versions automatically
5. **Optimizes** with cache control headers

## 🤝 Contributing

### Adding a New Expert
1. Create `expert-definitions/[domain]-expert.md`
2. Create `test-scenarios/[domain]-tests.json`
3. Submit PR - system auto-detects new domains

### Expert Definition Format
```markdown
# [Domain] Expert

You are an expert in [domain]...

## Evaluation Criteria
1. [Criterion] (weight%)
2. [Criterion] (weight%)

## Scoring Instructions
Rate 0-10 for each criterion...

## Response Format
Structured output format...
```

## 📝 Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [Cache Management](docs/CACHE_MANAGEMENT.md)
- [Usage Examples](examples/prompt-expert-usage-examples.md)

## 🔧 Configuration

### Environment Variables
- `ANTHROPIC_API_KEY`: Required for Claude API
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### Cache Settings
- Max file age: 14 days (auto-cleanup)
- Max file size: 5MB (images/PDFs), 100KB (text)
- Max files per context: 50
- Cache TTL: 1 hour

## 🚀 Features

- ✅ **Three-thread evaluation** - Real performance comparison
- ✅ **Domain experts** - Specialized evaluation criteria
- ✅ **Repository context** - Code-aware assessments
- ✅ **Multimodal support** - Text, images, PDFs
- ✅ **Cache management** - Efficient API usage
- ✅ **On-demand evaluation** - PR comment triggers
- ✅ **Auto-improvements** - Iterative enhancement
- ✅ **Detailed reports** - Actionable feedback

## 📊 Supported Domains

| Domain | Keywords | Test Scenarios |
|--------|----------|----------------|
| Security | `security`, `risk`, `safety` | 10 scenarios |
| Programming | `code`, `programming`, `debug` | 5 scenarios |
| Financial | `finance`, `investment`, `budget` | 5 scenarios |
| Data Analysis | `data`, `analytics`, `ML` | 5 scenarios |
| General | All others (fallback) | 5 scenarios |

## 🆘 Support

- [Issues](https://github.com/whichguy/prompt-expert/issues)
- [Example Implementation](https://github.com/whichguy/security-prompt-test)

## 📄 License

MIT License

---

*Better outputs through expert evaluation and repository context.*