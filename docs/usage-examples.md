# Prompt Expert Usage Examples

This document shows various ways to use the `@prompt-expert` comment system for on-demand prompt evaluation.

## Basic Usage

### Simple Expert Calls
```
@prompt-expert programming
```
Runs the programming expert with standard test scenarios.

```
@prompt-expert:financial
```
Alternative syntax for financial expert.

```
@prompt-expert all
```
Runs all applicable experts for comprehensive evaluation.

```
@prompt-expert
```
Uses general expert (default when no specific expert specified).

## Advanced Usage with Parameters

### Custom Test Scenarios

#### Programming Expert with Code Review
```
@prompt-expert programming --scenario="Review this code for security issues: function authenticateUser(username, password) { return database.query('SELECT * FROM users WHERE name=' + username + ' AND pass=' + password); }"
```

#### Financial Expert with Investment Calculation
```
@prompt-expert financial --test="Calculate the compound annual growth rate (CAGR) for an investment that grows from $10,000 to $15,000 over 3 years"
```

#### Data Analysis Expert with Visualization Task
```
@prompt-expert data-analysis --scenario="Create a visualization showing the correlation between temperature and ice cream sales using a dataset with 1000 records"
```

### Focus Areas

#### Security-Focused Code Review
```
@prompt-expert programming --focus=security,vulnerability-detection
```

#### Performance-Focused Analysis
```
@prompt-expert programming --focus=performance,optimization,scalability
```

#### Risk-Focused Financial Analysis
```
@prompt-expert financial --focus=risk-assessment,compliance
```

### Custom Evaluation Criteria

#### Programming with Specific Criteria
```
@prompt-expert programming --criteria=security,maintainability,testing,documentation
```

#### Financial with Regulatory Focus
```
@prompt-expert financial --criteria=accuracy,regulatory-compliance,risk-disclosure,ethical-guidance
```

#### General with Communication Focus
```
@prompt-expert general --criteria=clarity,engagement,actionability,completeness
```

### Custom Scoring Weights

#### Security-Heavy Programming Evaluation
```
@prompt-expert programming --score-weight="security:50,correctness:30,performance:20"
```

#### User Experience Focused
```
@prompt-expert general --score-weight="clarity:40,engagement:30,completeness:20,helpfulness:10"
```

#### Risk-Weighted Financial Analysis
```
@prompt-expert financial --score-weight="risk-awareness:40,accuracy:25,compliance:20,practical-guidance:15"
```

## Complex Combined Parameters

### Comprehensive Security Review
```
@prompt-expert programming --scenario="Audit this authentication system for security vulnerabilities" --focus=security,authentication --criteria=vulnerability-detection,secure-coding,threat-modeling --score-weight="security:60,correctness:25,usability:15"
```

### Investment Strategy Evaluation
```
@prompt-expert financial --test="Evaluate a diversified portfolio strategy for a 30-year-old with $50k savings" --focus=risk-management,diversification --criteria=risk-assessment,return-optimization,tax-efficiency --score-weight="risk-awareness:35,accuracy:30,practical-guidance:25,compliance:10"
```

### Data Privacy Analysis
```
@prompt-expert data-analysis --scenario="Analyze customer behavior data while ensuring GDPR compliance" --focus=privacy,ethics --criteria=data-protection,anonymization,statistical-rigor --score-weight="privacy:40,accuracy:30,methodology:20,compliance:10"
```

## Domain-Specific Examples

### Programming Domain

#### Code Generation
```
@prompt-expert programming --test="Generate a REST API endpoint for user authentication with JWT tokens" --focus=security,best-practices
```

#### Debugging
```
@prompt-expert programming --scenario="Debug a memory leak in a Python web application" --focus=performance,debugging --criteria=problem-diagnosis,solution-accuracy,prevention-strategies
```

#### Code Review
```
@prompt-expert programming --scenario="Review this React component for accessibility issues" --focus=accessibility,usability --criteria=a11y-compliance,semantic-html,keyboard-navigation
```

### Financial Domain

#### Risk Assessment
```
@prompt-expert financial --test="Assess the risk profile of a startup investment" --focus=risk-analysis,due-diligence --criteria=risk-quantification,scenario-analysis,disclosure
```

#### Tax Planning
```
@prompt-expert financial --scenario="Optimize tax strategy for a freelancer with irregular income" --focus=tax-efficiency,planning --criteria=accuracy,legal-compliance,practical-applicability
```

#### Retirement Planning
```
@prompt-expert financial --test="Create a 401k allocation strategy for different age groups" --focus=long-term-planning,diversification --score-weight="risk-awareness:30,return-optimization:25,age-appropriateness:25,fees:20"
```

### Data Analysis Domain

#### Statistical Analysis
```
@prompt-expert data-analysis --scenario="Perform A/B test analysis on conversion rates with proper statistical significance" --focus=statistical-rigor,methodology --criteria=hypothesis-testing,confidence-intervals,effect-size
```

#### Visualization
```
@prompt-expert data-analysis --test="Create an executive dashboard showing KPI trends" --focus=visualization,communication --criteria=clarity,insight-generation,audience-appropriateness
```

#### Machine Learning
```
@prompt-expert data-analysis --scenario="Build a predictive model for customer churn" --focus=model-selection,validation --criteria=methodology,interpretability,bias-detection --score-weight="accuracy:30,methodology:25,interpretability:25,bias-awareness:20"
```

## Help and Support

### Get Help
```
@prompt-expert help
```
Shows comprehensive usage guide with all available parameters.

### Check Available Experts
```
@prompt-expert
```
Will show available experts if you don't specify one.

## Best Practices

### 1. Be Specific with Scenarios
Good:
```
@prompt-expert programming --scenario="Review this SQL query for injection vulnerabilities: SELECT * FROM users WHERE id = $1"
```

Less helpful:
```
@prompt-expert programming --scenario="Review code"
```

### 2. Use Relevant Focus Areas
Match focus areas to your concerns:
```
@prompt-expert financial --focus=regulatory-compliance,risk-disclosure
```

### 3. Combine Parameters Thoughtfully
Use parameters that work together:
```
@prompt-expert programming --scenario="API security review" --focus=security --criteria=vulnerability-detection,secure-coding --score-weight="security:70,usability:30"
```

### 4. Weight Scores Appropriately
Make sure weights add up to 100:
```
@prompt-expert general --score-weight="clarity:40,completeness:30,engagement:20,accuracy:10"
```

## Troubleshooting

### No Response
- Check that your comment includes `@prompt-expert`
- Ensure the PR contains prompt files (*.md, *.txt, *.prompt)
- Verify expert name is spelled correctly

### Parameter Issues
- Use quotes around scenarios with spaces: `--scenario="text with spaces"`
- Separate multiple values with commas: `--focus=area1,area2`
- Include colons in weights: `--score-weight="area:percentage"`

### Expert Not Found
Available experts: `programming`, `financial`, `data-analysis`, `security`, `general`, `all`