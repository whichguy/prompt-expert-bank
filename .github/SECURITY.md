# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Prompt Expert Bank seriously. If you have discovered a security vulnerability, please report it to us as described below.

### Reporting Process

1. **Do not report security vulnerabilities through public GitHub issues.**
2. Instead, please send a detailed report to the repository maintainers via:
   - GitHub Security Advisories (preferred)
   - Direct message to repository owner
   - Email to the maintainer if contact information is available

### What to Include

Please include the following information in your report:
- A description of the vulnerability and its impact
- Step-by-step instructions to reproduce the issue
- Proof of concept or exploit code (if available)
- Suggested fix or mitigation (if you have one)

### Response Timeline

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will provide a detailed response within 7 days indicating next steps
- We will work with you to understand and resolve the issue
- We will coordinate disclosure timeline with you

### Vulnerability Categories

We are particularly interested in reports about:
- **Code Injection**: Malicious prompt injection or code execution
- **Authentication Bypass**: Unauthorized access to repository operations  
- **Data Exposure**: Unintended exposure of sensitive information
- **GitHub Actions Security**: Workflow vulnerabilities or token exposure
- **Dependency Vulnerabilities**: Security issues in npm packages

### Security Best Practices

When using Prompt Expert Bank:
- Keep dependencies up to date
- Review expert definitions before adding them
- Use appropriate GitHub repository permissions
- Monitor workflow execution logs for suspicious activity
- Validate user inputs in custom expert definitions

### Acknowledgments

We appreciate the security research community and will acknowledge valid reports in our security advisories (unless you prefer to remain anonymous).

## Security Features

Current security implementations:
- Input validation for file paths and expert definitions
- GitHub token scope limitations
- Automated dependency scanning (via dependabot)
- Security workflow scanning (via CodeQL)
- Malicious request detection in prompt processing

For questions about this security policy, please create a GitHub issue with the `security` label.