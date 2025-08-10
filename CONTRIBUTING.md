# Contributing to Prompt Expert Bank

Thank you for your interest in contributing to Prompt Expert Bank! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Expert Definitions](#expert-definitions)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this standard. Please report unacceptable behavior to the project maintainers.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment (see [Development Setup](#development-setup))
4. Create a feature branch for your changes
5. Make your changes and test them
6. Submit a pull request

## How to Contribute

### Types of Contributions

We welcome several types of contributions:

- **Expert Definitions**: Add new expert roles and prompts
- **Bug Fixes**: Fix issues in existing functionality
- **Feature Enhancements**: Improve existing features
- **Documentation**: Improve docs, examples, and guides
- **Testing**: Add or improve test coverage
- **Infrastructure**: Improve CI/CD, workflows, and tooling

### Expert Definitions

Expert definitions are the core contribution type for this repository. When adding a new expert:

1. **Create the expert file** in the `experts/` directory
2. **Follow the naming convention**: `{domain}-{specialty}.md`
3. **Use the expert template** (see `experts/template.md`)
4. **Include comprehensive examples** and use cases
5. **Test thoroughly** with various scenarios

#### Expert Quality Standards

- Clear, specific expertise domain
- Well-defined capabilities and limitations  
- Comprehensive prompt engineering
- Multiple examples and edge cases
- Security considerations documented
- Performance characteristics noted

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git
- GitHub CLI (optional but recommended)

### Local Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/prompt-expert-bank.git
cd prompt-expert-bank

# Install dependencies (if applicable)
npm install

# Set up git remotes
git remote add upstream https://github.com/whichguy/prompt-expert-bank.git

# Create feature branch
git checkout -b feature/your-feature-name
```

### Environment Variables

For testing GitHub Actions locally:
```bash
export GITHUB_TOKEN="your-token"
export ANTHROPIC_API_KEY="your-key"  
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run expert validation
npm run test:experts

# Run integration tests
npm run test:integration

# Test specific expert
npm run test:expert -- experts/security-analyst.md
```

### Test Categories

- **Unit Tests**: Test individual components
- **Integration Tests**: Test end-to-end workflows
- **Expert Tests**: Validate expert definitions
- **GitHub Actions Tests**: Test workflow functionality

### Adding Tests

When contributing:
- Add unit tests for new functions
- Add integration tests for new workflows
- Include expert validation tests for new experts
- Update existing tests when modifying functionality

## Pull Request Process

### Before Submitting

1. **Test your changes** thoroughly
2. **Update documentation** as needed
3. **Add tests** for new functionality
4. **Run linting** and fix any issues
5. **Update CHANGELOG.md** if applicable

### PR Guidelines

- Use a clear, descriptive title
- Fill out the PR template completely
- Link related issues with `Fixes #123` or `Related to #456`
- Include screenshots/examples for UI changes
- Keep PRs focused and atomic
- Respond promptly to review feedback

### Review Process

1. Automated checks must pass (CI, linting, tests)
2. At least one maintainer review required
3. Address all feedback before merge
4. Squash commits when merging (if requested)

## Style Guidelines

### Code Style

- Use 2 spaces for indentation
- Follow existing naming conventions
- Add JSDoc comments for functions
- Use meaningful variable names
- Keep functions small and focused

### Documentation Style

- Use clear, concise language
- Include examples where helpful
- Follow markdown best practices
- Keep line length under 100 characters
- Use proper heading hierarchy

### Commit Messages

Follow conventional commits format:
```
type(scope): description

- feat: add new expert definition
- fix: resolve authentication issue  
- docs: update contributing guide
- test: add integration tests
- refactor: improve error handling
```

## Issue Reporting

### Bug Reports

Use the bug report template and include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment information
- Relevant logs or screenshots

### Feature Requests

Use the feature request template and include:
- Problem statement
- Proposed solution
- Alternative approaches considered
- Additional context

### Expert Addition Requests

Use the expert addition template and include:
- Domain expertise needed
- Specific use cases
- Example prompts/scenarios
- Success criteria

## Expert Guidelines

### Expert Definition Structure

```markdown
# Expert Name

## Description
Brief description of the expert's role and capabilities.

## Expertise Areas
- Primary domain knowledge
- Secondary skills
- Specialized techniques

## Prompt Template
[Detailed prompt template]

## Usage Examples
[Multiple examples with different scenarios]

## Limitations
[Known limitations and edge cases]

## Testing Scenarios
[Test cases for validation]
```

### Quality Checklist

- [ ] Clear expertise domain defined
- [ ] Comprehensive prompt template
- [ ] Multiple usage examples
- [ ] Edge cases documented
- [ ] Security considerations noted
- [ ] Performance characteristics documented
- [ ] Testing scenarios included

## Getting Help

- Check existing issues and discussions
- Review documentation and examples
- Ask questions in GitHub Discussions
- Tag maintainers in issues/PRs when needed

## Recognition

Contributors will be recognized in:
- Repository contributors list
- Release notes (for significant contributions)
- Expert definition attribution
- Special acknowledgments section

Thank you for contributing to Prompt Expert Bank! Your contributions help make prompt engineering more accessible and effective for everyone.