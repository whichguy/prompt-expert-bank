# ABTest Tool - Comprehensive Documentation

## Overview
The ABTest tool performs comparative evaluation of two prompt versions using expert-defined criteria. It provides data-driven verdicts on which prompt version performs better for specific use cases.

## Core Capabilities

### 1. Version Comparison
- **Same file, different versions**: Compare historical versions of the same prompt
- **Different files**: Compare alternative implementations
- **Cross-repository**: Compare prompts from different repositories
- **Branch comparison**: Compare prompts across branches

### 2. Expert Evaluation
- Uses domain expert definitions to evaluate from specific perspectives
- Supports multiple expert types: programming, security, data-analysis, financial
- Provides domain-specific scoring and recommendations

### 3. Test Context Integration
- Include real-world test files for practical evaluation
- Support directories of test scenarios
- Version-specific test data
- Cross-repository test suites

## Input Parameters

### Required Parameters

#### `pathToExpertPromptDefinition`
Path to the expert definition file that provides evaluation criteria.

**Format Options:**
- `"experts/programming-expert.md"` - Local file
- `"experts/security-expert.md@main"` - Specific branch
- `"other-repo:experts/custom-expert.md"` - Cross-repo

**Available Experts:**
- `programming-expert.md` - Code quality, best practices, performance
- `security-expert.md` - Security vulnerabilities, threat modeling
- `data-analysis-expert.md` - Data processing, statistical accuracy
- `financial-expert.md` - Financial calculations, compliance
- `general-expert.md` - General purpose evaluation

#### `pathToPromptA` (Baseline)
First prompt version to compare - typically the current/old version.

**Format Options:**
- `"prompts/code-reviewer.md"` - Latest version
- `"prompts/code-reviewer.md@v1.0"` - Tagged version
- `"prompts/code-reviewer.md@3a5f8e2"` - Specific commit
- `"prompts/code-reviewer.md@feature-branch"` - Branch version
- `"original-repo:prompts/reviewer.md"` - Cross-repository

#### `pathToPromptB` (Variant)
Second prompt version to compare - typically the new/proposed version.

**Format Options:**
- Same as pathToPromptA
- Often uses HEAD or latest version
- Can be from different repository or branch

### Optional Parameters

#### `testContextPaths` (Array)
List of files or directories to use as test context during evaluation.

**Format Options:**
- `["test-scenarios/"]` - Entire directory
- `["examples/vulnerable-code.js"]` - Specific file
- `["test/*.json"]` - Pattern matching (future feature)
- `["other-repo:tests/"]` - Cross-repository tests
- `["examples/v1.js@old-version", "examples/v2.js"]` - Mixed versions

**Best Practices:**
- Include 3-5 representative test files
- Mix positive and negative test cases
- Include edge cases
- Keep total size under 100KB for performance

## Use Cases with Examples

### 1. Regression Testing
**Scenario**: Ensure new prompt version doesn't degrade performance

```javascript
{
  pathToExpertPromptDefinition: "experts/programming-expert.md",
  pathToPromptA: "prompts/code-reviewer.md@v2.0",  // Current production
  pathToPromptB: "prompts/code-reviewer.md",       // New version
  testContextPaths: [
    "test-scenarios/regression/",
    "examples/production-issues.js"
  ]
}
```

**Expected Output**: Verdict on whether new version maintains or improves quality

### 2. A/B Testing Different Approaches
**Scenario**: Compare two different prompt strategies

```javascript
{
  pathToExpertPromptDefinition: "experts/security-expert.md",
  pathToPromptA: "prompts/security-scanner-rules.md",
  pathToPromptB: "prompts/security-scanner-ml.md",
  testContextPaths: [
    "test-scenarios/security/vulnerabilities/",
    "test-scenarios/security/false-positives/"
  ]
}
```

**Expected Output**: Which approach better identifies vulnerabilities with fewer false positives

### 3. Cross-Team Collaboration
**Scenario**: Compare prompts from different teams

```javascript
{
  pathToExpertPromptDefinition: "experts/data-analysis-expert.md",
  pathToPromptA: "team-alpha:prompts/data-processor.md",
  pathToPromptB: "team-beta:prompts/data-analyzer.md",
  testContextPaths: [
    "shared-tests:datasets/sample-data.csv",
    "shared-tests:datasets/edge-cases.json"
  ]
}
```

**Expected Output**: Unified evaluation across team boundaries

### 4. Version History Analysis
**Scenario**: Identify when a regression was introduced

```javascript
{
  pathToExpertPromptDefinition: "experts/general-expert.md",
  pathToPromptA: "prompts/assistant.md@3commits-ago",
  pathToPromptB: "prompts/assistant.md@2commits-ago",
  testContextPaths: [
    "test-scenarios/user-interactions/"
  ]
}
```

**Expected Output**: Pinpoint which commit introduced issues

### 5. Pre-Deployment Validation
**Scenario**: Validate prompt before production deployment

```javascript
{
  pathToExpertPromptDefinition: "experts/financial-expert.md",
  pathToPromptA: "prompts/calculator.md@production",
  pathToPromptB: "prompts/calculator.md@staging",
  testContextPaths: [
    "test-scenarios/calculations/",
    "test-scenarios/compliance/",
    "test-scenarios/edge-cases/"
  ]
}
```

**Expected Output**: Production readiness assessment with confidence level

### 6. Security Audit Comparison
**Scenario**: Compare security improvements

```javascript
{
  pathToExpertPromptDefinition: "experts/security-expert.md",
  pathToPromptA: "prompts/validator.md@before-audit",
  pathToPromptB: "prompts/validator.md@after-audit",
  testContextPaths: [
    "security-tests/injection-attacks/",
    "security-tests/authentication/",
    "security-tests/authorization/"
  ]
}
```

**Expected Output**: Quantified security improvements

## Output Structure

### Success Response
```javascript
{
  success: true,
  testConfiguration: {
    expert: { /* expert file details */ },
    promptA: { /* version A details */ },
    promptB: { /* version B details */ },
    testContext: [ /* test file paths */ ]
  },
  evaluations: {
    promptA: {
      aggregateScore: 7.5,
      threads: [ /* detailed evaluations */ ],
      strengths: ["Clear structure", "Good examples"],
      weaknesses: ["Lacks edge cases"]
    },
    promptB: {
      aggregateScore: 8.3,
      threads: [ /* detailed evaluations */ ],
      strengths: ["Comprehensive", "Well-tested"],
      weaknesses: ["Slightly verbose"]
    }
  },
  comparison: {
    scoreDifference: 0.8,
    improvements: ["Better error handling", "More examples"],
    regressions: [],
    detailed: "Detailed comparison analysis..."
  },
  verdict: {
    winner: "B",
    winnerVersion: "HEAD",
    confidence: "high",
    reasoning: "Version B demonstrates...",
    recommendProduction: true
  },
  summary: "Version B is BETTER with high confidence (+0.8 score)"
}
```

### Error Response
```javascript
{
  success: false,
  error: "Specific error message",
  details: "Stack trace or additional context"
}
```

## Error Handling

### Common Errors and Solutions

1. **File Not Found**
   - Error: "Failed to fetch path/to/file.md: Not Found"
   - Solution: Verify file exists and path is correct
   - Check: Repository permissions, branch names, file extensions

2. **Invalid Version Reference**
   - Error: "Reference 'invalid-ref' not found"
   - Solution: Use valid commit SHA, tag, or branch name
   - Check: Git history with `git log --oneline`

3. **Large Test Context**
   - Error: "Test context exceeds size limit"
   - Solution: Reduce number of test files or use smaller samples
   - Limit: Keep under 100KB total

4. **Network Issues**
   - Error: "GitHub API request failed"
   - Solution: Check network connection and API limits
   - Retry: Tool automatically retries 3 times

5. **Permission Denied**
   - Error: "Resource not accessible by integration"
   - Solution: Ensure GitHub token has repository access
   - Check: Token scopes include repo access

## Performance Considerations

### Optimization Tips
1. **Cache Results**: Results are valid for 24 hours for same inputs
2. **Batch Testing**: Run multiple comparisons in sequence
3. **Test Context Size**: Limit to essential files only
4. **Version Selection**: Use specific commits instead of branches when possible

### Execution Time
- Typical: 15-30 seconds
- Complex (large context): 30-60 seconds
- Cross-repository: Add 5-10 seconds per external repo

## Best Practices

### DO:
1. ✅ Use specific version references for reproducibility
2. ✅ Include diverse test scenarios
3. ✅ Compare one change at a time for clear results
4. ✅ Document why you're running the comparison
5. ✅ Save results for historical tracking

### DON'T:
1. ❌ Compare completely unrelated prompts
2. ❌ Use test context larger than 100KB
3. ❌ Ignore low confidence verdicts
4. ❌ Deploy without high confidence score
5. ❌ Mix multiple changes in one comparison

## Integration Examples

### GitHub Actions Workflow
```yaml
- name: Run A/B Test
  run: |
    @claude-code ab_test \
      --expert "experts/programming-expert.md" \
      --promptA "prompts/code-reviewer.md@main" \
      --promptB "prompts/code-reviewer.md@${{ github.sha }}" \
      --context "test-scenarios/"
```

### Pull Request Comment
```
@claude-code Please run an A/B test:
- Expert: experts/security-expert.md
- Baseline: prompts/validator.md@main
- Variant: prompts/validator.md (this PR)
- Test with: security-tests/
```

### Command Line
```bash
claude-code ab-test \
  --expert experts/programming-expert.md \
  --baseline prompts/old.md \
  --variant prompts/new.md \
  --test-context test-scenarios/
```

## Troubleshooting

### Issue: Scores are unexpectedly low
- Check if expert definition matches prompt domain
- Verify test context is relevant
- Ensure prompts are complete (not truncated)

### Issue: Verdict confidence is low
- Add more diverse test scenarios
- Use more specific expert definition
- Ensure significant differences between versions

### Issue: Test takes too long
- Reduce test context size
- Use specific file paths instead of directories
- Check for network latency issues

### Issue: Inconsistent results
- Use specific commit SHAs instead of branch references
- Ensure test context hasn't changed
- Check for API rate limiting

## Advanced Features

### Batch Comparisons
Compare multiple versions in sequence:
```javascript
const versions = ["v1.0", "v1.1", "v1.2", "HEAD"];
for (let i = 0; i < versions.length - 1; i++) {
  await ab_test({
    pathToExpertPromptDefinition: "experts/general-expert.md",
    pathToPromptA: `prompts/assistant.md@${versions[i]}`,
    pathToPromptB: `prompts/assistant.md@${versions[i+1]}`,
    testContextPaths: ["test-scenarios/"]
  });
}
```

### Custom Expert Definitions
Create domain-specific experts:
```markdown
# Custom Expert: API Design
You are an API design expert evaluating prompts for:
1. RESTful principles
2. Error handling
3. Documentation completeness
4. Versioning strategy
```

### Test Context Strategies
1. **Positive/Negative Split**: Half successful cases, half failure cases
2. **Edge Case Focus**: Primarily boundary conditions
3. **Real-World Data**: Production samples (sanitized)
4. **Synthetic Data**: Generated test cases
5. **Historical Issues**: Previous bug reports as test cases

## Metrics and Scoring

### Score Components
- **Structure (0-10)**: Organization, clarity, completeness
- **Domain Expertise (0-10)**: Technical accuracy, best practices
- **Effectiveness (0-10)**: Output quality, task completion

### Confidence Levels
- **High**: Score difference > 1.0, consistent improvements
- **Medium**: Score difference 0.5-1.0, some improvements
- **Low**: Score difference < 0.5, mixed results

### Production Readiness
- **Recommended**: High confidence, score > 7.5, no regressions
- **Conditional**: Medium confidence, needs specific improvements
- **Not Recommended**: Low confidence or significant regressions

## Future Enhancements

### Planned Features
1. **Parallel Evaluation**: Run multiple expert evaluations simultaneously
2. **Historical Tracking**: Store and compare results over time
3. **Custom Metrics**: Define project-specific evaluation criteria
4. **Automated Triggers**: Run on PR creation/update
5. **Visualization**: Generate comparison charts and reports

### Integration Roadmap
1. **IDE Plugins**: VSCode extension for local testing
2. **CLI Tool**: Standalone command-line interface
3. **Web Dashboard**: Visual comparison interface
4. **API Endpoint**: REST API for programmatic access
5. **Slack/Discord Bot**: Team notifications

## Support and Feedback

For issues or suggestions:
1. Check this documentation first
2. Review error messages carefully
3. Verify file paths and versions
4. Test with simpler inputs
5. Report issues with full error details

## Conclusion

The ABTest tool provides comprehensive, data-driven comparison of prompt versions. By following these guidelines and best practices, you can ensure reliable evaluations that improve prompt quality and catch regressions before deployment.