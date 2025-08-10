# Advanced Security Analysis Framework

## Objective
Conduct comprehensive security analysis following OWASP standards and industry best practices for identifying vulnerabilities and security weaknesses in code.

## Security Assessment Areas

### OWASP Top 10 Analysis
- **A01 Broken Access Control**: Authorization bypass, privilege escalation
- **A02 Cryptographic Failures**: Weak encryption, exposed sensitive data
- **A03 Injection**: SQL injection, NoSQL injection, command injection, LDAP injection
- **A04 Insecure Design**: Security design flaws, missing security controls
- **A05 Security Misconfiguration**: Default configs, incomplete setups, verbose errors
- **A06 Vulnerable Components**: Outdated libraries, known CVEs
- **A07 Authentication Failures**: Weak passwords, session management issues
- **A08 Software Integrity Failures**: Untrusted sources, supply chain attacks
- **A09 Security Logging Failures**: Insufficient logging, monitoring gaps
- **A10 Server-Side Request Forgery**: SSRF vulnerabilities, internal service access

### Input Validation & Sanitization
- **Data Validation**: Type checking, length validation, format verification
- **Input Sanitization**: XSS prevention, HTML encoding, SQL parameterization
- **File Upload Security**: File type validation, size limits, malware scanning
- **API Input Security**: Request validation, rate limiting, payload inspection

### Authentication & Authorization
- **Multi-Factor Authentication**: Implementation verification, bypass testing
- **Session Management**: Token security, expiration handling, session fixation
- **Role-Based Access Control**: Permission matrices, privilege verification
- **JWT Security**: Token validation, signature verification, claims inspection

### Data Protection
- **Encryption Standards**: AES-256, RSA-2048, proper key management
- **Data Classification**: PII identification, sensitive data handling
- **Secure Storage**: Database encryption, file system security
- **Transmission Security**: TLS configuration, certificate validation

## Analysis Methodology

### Static Analysis
1. **Code Review**: Manual inspection of security-critical functions
2. **Pattern Recognition**: Known vulnerability patterns identification
3. **Configuration Review**: Security settings verification
4. **Dependency Analysis**: Third-party library security assessment

### Dynamic Testing Recommendations
1. **Penetration Testing**: Simulate real-world attacks
2. **Fuzzing**: Input validation boundary testing
3. **Authentication Testing**: Login mechanism security verification
4. **Session Testing**: Session management vulnerability assessment

## Risk Assessment Framework

### Severity Classification
- **Critical (9-10)**: Immediate exploitation possible, data breach likely
- **High (7-8)**: Significant security impact, requires urgent attention
- **Medium (4-6)**: Moderate risk, should be addressed in next release
- **Low (1-3)**: Minor security concern, address when convenient

### Impact Analysis
- **Confidentiality**: Data exposure potential
- **Integrity**: Data modification risks
- **Availability**: Service disruption possibilities
- **Compliance**: Regulatory requirement violations

## Reporting Structure

### Executive Summary
- Risk overview and business impact
- Critical vulnerabilities requiring immediate attention
- Compliance status and regulatory implications

### Technical Findings
- Detailed vulnerability descriptions
- Proof of concept examples
- Code snippets highlighting issues
- CVSS scores and risk ratings

### Remediation Roadmap
- Prioritized fix recommendations
- Implementation timelines
- Resource requirements
- Verification testing approaches

## Output Format
```
## Security Analysis Report

### Critical Vulnerabilities
[List P0 security issues requiring immediate action]

### High-Risk Issues
[Security problems needing urgent attention]

### Medium-Risk Concerns
[Important security improvements]

### Best Practice Recommendations
[Proactive security enhancements]

### Compliance Status
[Regulatory requirement assessment]

### Remediation Timeline
[Prioritized action plan with timelines]
```

## Quality Assurance
- [ ] OWASP Top 10 coverage verified
- [ ] Input validation thoroughly assessed
- [ ] Authentication mechanisms reviewed
- [ ] Data protection measures evaluated
- [ ] Risk ratings properly assigned
- [ ] Remediation plan provided
- [ ] Compliance requirements addressed