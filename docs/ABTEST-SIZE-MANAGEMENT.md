# ABTest Size Management & Protection

## Overview

The `ABTestToolWithLimits` class provides comprehensive size management to protect both GitHub Actions runners and Claude's context window from being overwhelmed by large contexts.

## Key Protection Features

### 1. GitHub Runner Protection
- **Memory Limits**: Monitors usage against 7GB standard runner limit
- **Disk Space**: Tracks against 14GB available disk space  
- **File Descriptors**: Prevents exceeding 1024 open file limit
- **API Rate Limiting**: Respects 60 calls/minute GitHub API limit

### 2. Claude Context Protection
- **Token Limits**: Tracks against 200K token context window
- **Character Counting**: Estimates ~4 chars per token
- **Image Limits**: Max 20 images per request
- **Size Limits**: 5MB per image, 10MB per PDF

### 3. Progressive Loading
- **Early Termination**: Stops loading when limits approached
- **Priority Loading**: Loads most important files first
- **Smart Sampling**: Samples large folders instead of full load
- **Content Compression**: Truncates/compresses large files

## Configuration

### Default Limits

```json
{
  "runner": {
    "maxMemoryMB": 7000,       // 7GB total
    "warnMemoryMB": 5000,       // Warn at 5GB
    "criticalMemoryMB": 6500    // Stop at 6.5GB
  },
  "claude": {
    "maxTokens": 200000,        // Context window
    "warnTokens": 150000,       // Warn at 75%
    "criticalTokens": 180000    // Stop at 90%
  },
  "aggregate": {
    "maxTotalSizeMB": 50,       // Total size limit
    "maxTotalFiles": 100,       // File count limit
    "maxFilesPerFolder": 20     // Per-folder limit
  }
}
```

### Loading Strategies

#### Progressive (Default)
```javascript
{
  "mode": "progressive",
  "stopOnWarning": false,      // Continue on warnings
  "stopOnCritical": true,       // Stop on critical
  "compressionEnabled": true    // Auto-compress large files
}
```

#### Strict (CI/CD)
```javascript
{
  "mode": "strict",
  "stopOnWarning": true,        // Stop on any warning
  "skipLargeFiles": true,       // Skip files over limit
  "compressionEnabled": false   // No compression
}
```

#### Lenient (Development)
```javascript
{
  "mode": "lenient",
  "stopOnWarning": false,       // Ignore warnings
  "stopOnCritical": false,      // Try to continue
  "compressionEnabled": true    // Aggressive compression
}
```

## Size Tracking

### Real-time Monitoring

The tool tracks multiple metrics in real-time:

```javascript
tracking: {
  currentMemoryMB: 0,         // Running total memory
  currentTokenEstimate: 0,     // Estimated tokens used
  totalFilesLoaded: 0,        // File count
  apiCallsThisMinute: 0,      // API rate tracking
  
  byType: {                   // Per-type breakdown
    code: { count: 0, sizeMB: 0 },
    image: { count: 0, sizeMB: 0 },
    pdf: { count: 0, sizeMB: 0 }
  },
  
  warnings: [],               // Warning messages
  errors: [],                 // Error messages
  skipped: []                // Skipped files
}
```

### Size Report

Every test returns a comprehensive size report:

```javascript
{
  summary: {
    totalMemoryMB: "25.43",
    totalTokens: 95000,
    totalFiles: 47,
    totalFolders: 8
  },
  limits: {
    memoryUsage: "50.9%",    // Of max allowed
    tokenUsage: "47.5%",      // Of context window
    fileUsage: "47.0%"        // Of file limit
  },
  health: "healthy",          // healthy|warning|error
  warnings: [],
  recommendations: []
}
```

## Usage Examples

### Basic Usage with Presets

```javascript
// Small context (quick tests)
await abTest.executeABTest({
  contextPaths: ['src/utils', 'README.md'],
  sizeLimits: limitsConfig.presets.small  // 10MB, 50K tokens
});

// Medium context (standard)
await abTest.executeABTest({
  contextPaths: ['src', 'tests'],
  sizeLimits: limitsConfig.presets.medium // 30MB, 100K tokens
});

// Large context (comprehensive)
await abTest.executeABTest({
  contextPaths: ['src', 'tests', 'docs', 'examples'],
  sizeLimits: limitsConfig.presets.large  // 50MB, 150K tokens
});
```

### Custom Limits

```javascript
await abTest.executeABTest({
  contextPaths: [...],
  sizeLimits: {
    maxTotalSizeMB: 25,
    maxTokens: 80000,
    maxFiles: 50,
    strategy: {
      mode: 'strict',
      stopOnWarning: true
    }
  }
});
```

### Progressive Loading

Files are loaded in priority order until limits are reached:

```javascript
await abTest.executeABTest({
  contextPaths: [
    'src/core',       // Loaded first (highest priority)
    'src/utils',      // Loaded second
    'tests',          // Loaded if space remains
    'docs',           // May be skipped if limit reached
    'examples'        // Likely skipped
  ],
  contextOptions: {
    prioritize: true  // Load in order given
  }
});
```

## Protection Mechanisms

### 1. Pre-flight Size Estimation

Before loading, the tool estimates size:

```javascript
// Checks before loading
- Estimate file/folder size
- Check if it fits in remaining budget
- Skip if would exceed limits
```

### 2. Smart Folder Sampling

For large folders:

```javascript
// Instead of loading 1000 files
// Sample intelligently:
- Take 5 code files (smallest first)
- Take 3 config files
- Take 2 documentation files
- Skip the rest
```

### 3. Content Compression

When files are large but important:

```javascript
// Code compression
- Remove comments
- Remove empty lines
- Truncate if still too large
- Keep first/last portions

// Text compression  
- Keep first 40KB
- Add truncation notice
- Preserve structure
```

### 4. Rate Limit Protection

Prevents GitHub API throttling:

```javascript
// Automatic rate limiting
- Track API calls per minute
- Pause when approaching limit
- Resume after cooldown
```

## Error Handling

### Size Limit Exceeded

```javascript
{
  success: false,
  error: "Size limits exceeded",
  sizeReport: {
    // Detailed breakdown of what was loaded
  },
  recommendations: [
    "Reduce context paths or use more specific file patterns",
    "Consider using file type filters",
    "Try sampling instead of full folder loads"
  ]
}
```

### Graceful Degradation

The tool attempts to load as much as possible:

1. Load critical files first
2. Stop when limits approached
3. Return partial context
4. Provide clear report of what was loaded

## CI/CD Integration

### GitHub Actions Configuration

```yaml
- name: Run ABTest with Size Protection
  env:
    CI: true  # Enables stricter limits
  run: |
    node abtest-runner.js \
      --preset ci \
      --max-memory 3000 \
      --max-tokens 75000 \
      --stop-on-warning
```

### Environment-based Limits

```javascript
const limits = process.env.CI ? {
  maxTotalSizeMB: 20,      // Smaller in CI
  maxTokens: 75000,        // Reduced tokens
  strategy: {
    mode: 'strict',        // Strict mode
    stopOnWarning: true    // Fail fast
  }
} : {
  maxTotalSizeMB: 50,      // Larger locally
  maxTokens: 150000,       // More tokens
  strategy: {
    mode: 'progressive'    // Flexible mode
  }
};
```

## Performance Optimization

### Caching

- 24-hour cache for fetched content
- Reduces API calls for repeated tests
- Cache-aware size tracking

### Parallel Loading

- Batch API calls when possible
- Concurrent file loading with limits
- Queue management for rate limiting

### Memory Management

- Stream large files instead of loading fully
- Clear processed files from memory
- Garbage collection hints

## Best Practices

### 1. Start Small, Expand Gradually

```javascript
// Start with essential files
contextPaths: ['src/core/main.js']

// Add more if within limits
contextPaths: ['src/core', 'src/utils']

// Full context if possible
contextPaths: ['src', 'tests', 'docs']
```

### 2. Use Type Filters

```javascript
contextOptions: {
  includePatterns: [/\.(js|ts)$/],  // Code only
  excludePatterns: [/test/]         // Skip tests
}
```

### 3. Monitor Health Status

```javascript
const result = await abTest.executeABTest({...});

if (result.sizeReport.health === 'warning') {
  console.log('Consider reducing context');
}

if (result.sizeReport.health === 'error') {
  console.log('Must reduce context size');
}
```

### 4. Handle Failures Gracefully

```javascript
let result = await abTest.executeABTest({
  contextPaths: largePaths,
  sizeLimits: { maxTotalSizeMB: 50 }
});

if (!result.success && result.error.includes('Size limits')) {
  // Retry with reduced context
  result = await abTest.executeABTest({
    contextPaths: largePaths.slice(0, 3),  // First 3 only
    sizeLimits: { maxTotalSizeMB: 25 }
  });
}
```

## Monitoring & Debugging

### Enable Verbose Logging

```javascript
const abTest = new ABTestToolWithLimits({
  verbose: true,  // Detailed logging
  debug: true     // Debug information
});
```

### Real-time Monitoring

```javascript
// Monitor during execution
const interval = setInterval(() => {
  console.log(`Memory: ${abTest.tracking.currentMemoryMB}MB`);
  console.log(`Tokens: ${abTest.tracking.currentTokenEstimate}`);
  console.log(`Files: ${abTest.tracking.totalFilesLoaded}`);
}, 1000);
```

### Size Report Analysis

```javascript
const report = result.sizeReport;

// Check what consumed most space
const largestType = Object.entries(report.byType)
  .sort((a, b) => b[1].sizeMB - a[1].sizeMB)[0];

console.log(`Largest type: ${largestType[0]} using ${largestType[1].sizeMB}MB`);

// See what was skipped
console.log(`Skipped ${report.performance.skippedFiles} files`);
```

## Troubleshooting

### Common Issues

1. **"Critical memory limit reached"**
   - Reduce `maxTotalSizeMB`
   - Enable folder sampling
   - Use file type filters

2. **"Critical token limit reached"**
   - Reduce number of files
   - Enable content compression
   - Focus on specific file types

3. **"API rate limit exceeded"**
   - Reduce `maxFilesPerFolder`
   - Enable caching
   - Add delays between tests

4. **"Too many files skipped"**
   - Increase file type limits
   - Use lenient strategy
   - Target specific files instead of folders

## Summary

The size management system provides:

- ✅ **Protection** from resource exhaustion
- ✅ **Visibility** into resource usage
- ✅ **Control** over loading behavior
- ✅ **Flexibility** for different environments
- ✅ **Resilience** with graceful degradation
- ✅ **Optimization** through smart loading

This ensures ABTests can safely run in any environment without overwhelming GitHub runners or Claude's context window.