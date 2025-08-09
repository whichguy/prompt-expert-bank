# ABTest Tool - Multimodal Context Priming

## Overview

The Enhanced ABTest Tool (`ABTestToolEnhanced`) supports multimodal context priming, allowing you to test prompts with rich context from GitHub repositories including:

- 📁 **Folders** - Load entire directory structures
- 🖼️ **Images** - PNG, JPG, GIF, SVG, WebP
- 📄 **PDFs** - Full document support
- 💻 **Code** - All programming languages
- 📝 **Documents** - Markdown, text, configs
- 🔄 **Cross-repo** - Load from any GitHub repository

## Key Features

### 1. GitHub Repository Path Loading
Load context from any GitHub repository using simple path syntax:

```javascript
contextPaths: [
  'src/components',                          // Current repo folder
  'README.md',                               // Current repo file
  'microsoft/vscode:src/vs/editor',         // Cross-repo folder
  'openai/gpt-4:docs/api.md@main'          // Cross-repo file with branch
]
```

### 2. Intelligent Folder Traversal
Recursively load folder contents with smart filtering:

```javascript
contextOptions: {
  maxDepth: 3,                    // Traverse up to 3 levels deep
  maxFiles: 20,                   // Limit files per folder
  excludePatterns: [/node_modules/, /\.git/],
  includePatterns: [/\.(js|ts|md)$/]
}
```

### 3. Multimodal File Support
Automatically categorizes and processes different file types:

- **Text/Code**: Full content extraction with syntax highlighting
- **Images**: Base64 encoded for Claude's vision capabilities
- **PDFs**: Base64 encoded for document analysis
- **Binary**: Metadata only (skipped for context)

### 4. Context Size Management
Smart batching and size limits to optimize API usage:

```javascript
batchConfig: {
  maxFilesPerBatch: 20,
  maxTotalSize: 20 * 1024 * 1024,  // 20MB total
  maxDepth: 3
}
```

## Usage Examples

### Basic Folder Context
```javascript
const result = await abTest.executeABTest({
  expertPath: 'expert-definitions/programming-expert.md',
  promptA: 'prompts/v1.md@main',
  promptB: 'prompts/v2.md@feature',
  contextPaths: ['src', 'tests', 'README.md']
});
```

### Cross-Repository Context
```javascript
contextPaths: [
  'facebook/react:packages/react/src',
  'vuejs/vue:src/core',
  'angular/angular:packages/core'
]
```

### Multimodal Testing
```javascript
contextPaths: [
  'docs/architecture.pdf',        // PDF documentation
  'assets/diagrams',              // Folder with images
  'src/**/*.test.js',            // Pattern matching
  'screenshots/flow-*.png'       // Wildcard patterns
]
```

### Custom Filtering
```javascript
contextOptions: {
  includePatterns: [
    /\.(ts|tsx)$/,     // TypeScript only
    /test/,            // Test files
    /\.pdf$/           // PDF documents
  ],
  excludePatterns: [
    /\.min\./,         // Minified files
    /dist/,            // Build outputs
    /temp/             // Temporary files
  ]
}
```

## API Reference

### executeABTest(config)

Main method for running multimodal A/B tests.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.expertPath` | string | Path to expert definition (GitHub path) |
| `config.promptA` | string | Baseline prompt path/content |
| `config.promptB` | string | Variant prompt path/content |
| `config.contextPaths` | array | GitHub paths to load as context |
| `config.contextOptions` | object | Options for context loading |

#### Context Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxDepth` | number | 3 | Maximum folder traversal depth |
| `maxFiles` | number | 20 | Max files per folder |
| `maxTotalSize` | number | 20MB | Total size limit |
| `includePatterns` | array | [] | Regex patterns to include |
| `excludePatterns` | array | [node_modules, .git] | Patterns to exclude |

#### Returns

```javascript
{
  success: boolean,
  verdict: {
    winner: 'baseline' | 'variant',
    confidence: 'high' | 'medium' | 'low',
    contextUtilization: {
      baseline: number,
      variant: number
    },
    recommendation: string
  },
  evaluations: {
    baseline: {...},
    variant: {...},
    comparison: {...}
  },
  context: {
    totalFiles: number,
    totalSize: string,
    breakdown: {
      images: number,
      pdfs: number,
      code: number,
      documents: number
    }
  },
  metrics: {
    baselineTokens: number,
    variantTokens: number,
    totalTokens: number,
    evaluationTime: number
  }
}
```

## Path Syntax

### Current Repository
```
path/to/file.md              # File in current repo
path/to/folder               # Folder in current repo
path/to/file.md@branch       # Specific branch
path/to/file.md@v1.0.0       # Specific tag
path/to/file.md@abc123       # Specific commit
```

### Cross-Repository
```
owner/repo:path/to/file.md            # File in another repo
owner/repo:path/to/folder             # Folder in another repo
owner/repo:path/to/file.md@branch     # With branch
owner/repo:path/to/file.md@tag        # With tag
```

## Supported File Types

### Text/Code Files
- **Languages**: JavaScript, TypeScript, Python, Java, Go, Rust, C++, Ruby, PHP, Swift, Kotlin, etc.
- **Markup**: Markdown, HTML, XML, YAML, JSON
- **Config**: .env, .ini, .toml, .properties

### Multimodal Files
- **Images**: PNG, JPG, JPEG, GIF, BMP, SVG, WebP
- **Documents**: PDF, DOC, DOCX, ODT, RTF
- **Data**: CSV, XLS, XLSX, ODS

## Performance Considerations

### Caching
- 24-hour cache for fetched content
- Reduces API calls for repeated tests
- Cache key: `owner/repo/path@ref`

### Size Limits
- Text files: 1MB per file
- Images: 5MB per file
- PDFs: 10MB per file
- Total context: 20MB default (configurable)

### Rate Limiting
- Respects GitHub API rate limits
- Automatic retry with exponential backoff
- Batch operations to minimize API calls

## Best Practices

### 1. Start Small
Begin with essential files and expand:
```javascript
// Start with core files
contextPaths: ['src/main.js', 'README.md']

// Then add more context
contextPaths: ['src', 'tests', 'docs']
```

### 2. Use Filters Wisely
Exclude unnecessary files to optimize performance:
```javascript
excludePatterns: [
  /node_modules/,
  /\.git/,
  /dist/,
  /\.(min|bundle)\./
]
```

### 3. Leverage Cross-Repo Context
Compare against industry standards:
```javascript
contextPaths: [
  'your-code/src',
  'facebook/react:best-practices.md',
  'airbnb/javascript:style-guide.md'
]
```

### 4. Monitor Token Usage
Check metrics to optimize costs:
```javascript
const result = await abTest.executeABTest(config);
console.log(`Tokens used: ${result.metrics.totalTokens}`);
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run Multimodal ABTest
  uses: ./.github/actions/abtest
  with:
    expert: 'programming-expert'
    baseline: 'prompts/v1.md@main'
    variant: 'prompts/v2.md@${{ github.head_ref }}'
    context: |
      src
      tests
      docs/api.md
      examples
    options: |
      maxDepth: 2
      maxFiles: 15
      excludePatterns: ["test", "spec"]
```

### Automated PR Testing
Automatically test prompt changes with repository context:

```javascript
// In PR workflow
const prFiles = await getPRFiles();
const contextPaths = prFiles
  .filter(f => f.status === 'modified')
  .map(f => f.filename);

const result = await abTest.executeABTest({
  expertPath: detectExpert(prFiles),
  promptA: 'main:' + promptFile,
  promptB: 'pr:' + promptFile,
  contextPaths
});
```

## Troubleshooting

### Common Issues

1. **Rate Limiting**
   - Solution: Add delays between tests
   - Use caching to reduce API calls

2. **Large Files**
   - Solution: Use size limits and filters
   - Sample large directories instead of full load

3. **Binary Files**
   - Solution: Automatically skipped
   - Only metadata is collected

4. **Access Errors**
   - Solution: Ensure GitHub token has repo scope
   - Check repository visibility (public/private)

## Advanced Features

### Custom File Processors
```javascript
contextOptions: {
  customProcessor: async (file) => {
    if (file.name.endsWith('.ipynb')) {
      return processJupyterNotebook(file);
    }
    return file;
  }
}
```

### Pattern Matching
```javascript
contextPaths: [
  'src/**/*.test.js',     // All test files
  'docs/*.pdf',           // All PDFs in docs
  '**/*config*',          // Any config file
  'assets/img-*.png'      // Numbered images
]
```

### Conditional Loading
```javascript
const isDevelopment = process.env.NODE_ENV === 'development';
contextPaths: [
  'src',
  isDevelopment && 'tests',
  process.env.INCLUDE_DOCS && 'docs'
].filter(Boolean)
```

## Migration from Standard ABTest

The enhanced tool is backwards compatible:

```javascript
// Old way (still works)
await abTest.executeABTest(
  expertPath,
  promptA,
  promptB,
  [], // empty context
  0   // iteration
);

// New way (with context)
await abTest.executeABTest({
  expertPath,
  promptA,
  promptB,
  contextPaths: ['src', 'docs'],
  contextOptions: { maxDepth: 2 }
});
```

## Future Enhancements

- 🔄 **Streaming Context**: Load large repos progressively
- 🧠 **Smart Sampling**: AI-driven relevant file selection
- 📊 **Context Analytics**: Detailed usage reports
- 🔍 **Semantic Search**: Find relevant files automatically
- 🎯 **Targeted Testing**: Context-specific test scenarios

## Support

For issues or questions about multimodal ABTest:
- Open an issue in the repository
- Check the examples in `/examples/abtest-multimodal-usage.js`
- Review test cases in `/tests/ABTestToolEnhanced.test.js`