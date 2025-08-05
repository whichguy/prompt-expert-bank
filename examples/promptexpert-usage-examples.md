# PromptExpert Usage Examples

This document shows various ways to use the `@promptexpert` comment system for on-demand prompt evaluation.

## Basic Usage

### Simple Expert Calls
```
@promptexpert programming
```
Runs the programming expert with standard test scenarios.

```
@promptexpert:financial
```
Alternative syntax for financial expert.

```
@promptexpert all
```
Runs all applicable experts for comprehensive evaluation.

```
@promptexpert
```
Uses general expert (default when no specific expert specified).

## Advanced Usage with Parameters

### Custom Test Scenarios

#### Programming Expert with Code Review
```
@promptexpert programming --scenario="Review this code for security issues: function authenticateUser(username, password) { return database.query('SELECT * FROM users WHERE name=' + username + ' AND pass=' + password); }"
```

#### Financial Expert with Investment Calculation
```
@promptexpert financial --test="Calculate the compound annual growth rate (CAGR) for an investment that grows from $10,000 to $15,000 over 3 years"
```

#### Data Analysis Expert with Visualization Task
```
@promptexpert data-analysis --scenario="Create a visualization showing the correlation between temperature and ice cream sales using a dataset with 1000 records"
```

### Focus Areas

#### Security-Focused Code Review
```
@promptexpert programming --focus=security,vulnerability-detection
```

#### Performance-Focused Analysis
```
@promptexpert programming --focus=performance,optimization,scalability
```

#### Risk-Focused Financial Analysis
```
@promptexpert financial --focus=risk-assessment,compliance
```

### Custom Evaluation Criteria

#### Programming with Specific Criteria
```
@promptexpert programming --criteria=security,maintainability,testing,documentation
```

#### Financial with Regulatory Focus
```
@promptexpert financial --criteria=accuracy,regulatory-compliance,risk-disclosure,ethical-guidance
```

#### General with Communication Focus
```
@promptexpert general --criteria=clarity,engagement,actionability,completeness
```

### Custom Scoring Weights

#### Security-Heavy Programming Evaluation
```
@promptexpert programming --score-weight="security:50,correctness:30,performance:20"
```

#### User Experience Focused
```
@promptexpert general --score-weight="clarity:40,engagement:30,completeness:20,helpfulness:10"
```

#### Risk-Weighted Financial Analysis
```
@promptexpert financial --score-weight="risk-awareness:40,accuracy:25,compliance:20,practical-guidance:15"
```

## Complex Combined Parameters

### Comprehensive Security Review
```
@promptexpert programming --scenario="Audit this authentication system for security vulnerabilities" --focus=security,authentication --criteria=vulnerability-detection,secure-coding,threat-modeling --score-weight="security:60,correctness:25,usability:15"
```

### Investment Strategy Evaluation
```
@promptexpert financial --test="Evaluate a diversified portfolio strategy for a 30-year-old with $50k savings" --focus=risk-management,diversification --criteria=risk-assessment,return-optimization,tax-efficiency --score-weight="risk-awareness:35,accuracy:30,practical-guidance:25,compliance:10"
```

### Data Privacy Analysis
```
@promptexpert data-analysis --scenario="Analyze customer behavior data while ensuring GDPR compliance" --focus=privacy,ethics --criteria=data-protection,anonymization,statistical-rigor --score-weight="privacy:40,accuracy:30,methodology:20,compliance:10"
```

## Domain-Specific Examples

### Programming Domain

#### Code Generation
```
@promptexpert programming --test="Generate a REST API endpoint for user authentication with JWT tokens" --focus=security,best-practices
```

#### Debugging
```
@promptexpert programming --scenario="Debug a memory leak in a Python web application" --focus=performance,debugging --criteria=problem-diagnosis,solution-accuracy,prevention-strategies
```

#### Code Review
```
@promptexpert programming --scenario="Review this React component for accessibility issues" --focus=accessibility,usability --criteria=a11y-compliance,semantic-html,keyboard-navigation
```

### Financial Domain

#### Risk Assessment
```
@promptexpert financial --test="Assess the risk profile of a startup investment" --focus=risk-analysis,due-diligence --criteria=risk-quantification,scenario-analysis,disclosure
```

#### Tax Planning
```
@promptexpert financial --scenario="Optimize tax strategy for a freelancer with irregular income" --focus=tax-efficiency,planning --criteria=accuracy,legal-compliance,practical-applicability
```

#### Retirement Planning
```
@promptexpert financial --test="Create a 401k allocation strategy for different age groups" --focus=long-term-planning,diversification --score-weight="risk-awareness:30,return-optimization:25,age-appropriateness:25,fees:20"
```

### Data Analysis Domain

#### Statistical Analysis
```
@promptexpert data-analysis --scenario="Perform A/B test analysis on conversion rates with proper statistical significance" --focus=statistical-rigor,methodology --criteria=hypothesis-testing,confidence-intervals,effect-size
```

#### Visualization
```
@promptexpert data-analysis --test="Create an executive dashboard showing KPI trends" --focus=visualization,communication --criteria=clarity,insight-generation,audience-appropriateness
```

#### Machine Learning
```
@promptexpert data-analysis --scenario="Build a predictive model for customer churn" --focus=model-selection,validation --criteria=methodology,interpretability,bias-detection --score-weight="accuracy:30,methodology:25,interpretability:25,bias-awareness:20"
```

## Help and Support

### Get Help
```
@promptexpert help
```
Shows comprehensive usage guide with all available parameters.

### Check Available Experts
```
@promptexpert
```
Will show available experts if you don't specify one.

## Best Practices

### 1. Be Specific with Scenarios
Good:
```
@promptexpert programming --scenario="Review this SQL query for injection vulnerabilities: SELECT * FROM users WHERE id = $1"
```

Less helpful:
```
@promptexpert programming --scenario="Review code"
```

### 2. Use Relevant Focus Areas
Match focus areas to your concerns:
```
@promptexpert financial --focus=regulatory-compliance,risk-disclosure
```

### 3. Combine Parameters Thoughtfully
Use parameters that work together:
```
@promptexpert programming --scenario="API security review" --focus=security --criteria=vulnerability-detection,secure-coding --score-weight="security:70,usability:30"
```

### 4. Weight Scores Appropriately
Make sure weights add up to 100:
```
@promptexpert general --score-weight="clarity:40,completeness:30,engagement:20,accuracy:10"
```

## Troubleshooting

### No Response
- Check that your comment includes `@promptexpert`
- Ensure the PR contains prompt files (*.md, *.txt, *.prompt)
- Verify expert name is spelled correctly

### Parameter Issues
- Use quotes around scenarios with spaces: `--scenario="text with spaces"`
- Separate multiple values with commas: `--focus=area1,area2`
- Include colons in weights: `--score-weight="area:percentage"`

### Expert Not Found
Available experts: `programming`, `financial`, `data-analysis`, `security`, `general`, `all`