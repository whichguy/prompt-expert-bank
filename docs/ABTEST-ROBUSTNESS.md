# ABTest Robustness & Edge Case Handling

## Overview

The `ABTestToolRobust` class addresses all identified logic errors, corner cases, and edge scenarios in multimodal content loading and GitHub path parsing, with comprehensive logging throughout.

## Key Improvements

### 1. Enhanced Path Parsing

#### Validation & Sanitization
- **Input validation**: Checks for null, undefined, empty strings
- **Path normalization**: Handles backslashes, leading/trailing slashes
- **Security checks**: Detects path traversal, system files, command injection
- **Pattern validation**: Validates owner, repo, and ref formats against GitHub rules

#### Edge Cases Handled
```javascript
// All these cases are now properly handled:
""                              // Empty string → Error
null                            // Null → Error
"   "                           // Whitespace → Error
"owner/repo/path"               // Missing colon → Error
"owner:repo:path"               // Wrong separator → Error
"/etc/passwd"                   // System file → Warning
"../../../etc/passwd"           // Path traversal → Warning
"owner/repo:path@branch@tag"    // Multiple @ → Warning, uses first
"owner/repo:path with spaces"   // Spaces → Normalized
"owner/repo:../../etc"          // Path traversal in file → Warning
"C:\\Users\\file.txt"           // Windows path → Normalized
"owner/repo:файл.txt"           // Unicode → Supported
"owner/repo:file@feature/branch" // Branch with slash → Supported
"UPPERCASE/REPO:FILE.TXT"       // Case → Preserved
```

### 2. Comprehensive File Type Detection

#### Extended MIME Type Map
- **50+ programming languages** with proper MIME types
- **Document formats**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- **Image formats**: PNG, JPG, GIF, BMP, WebP, SVG, TIFF, ICO
- **Data formats**: CSV, JSON, XML, YAML, TOML, INI
- **Special files**: Jupyter notebooks, SQL, GraphQL, Protobuf
- **Archives**: ZIP, TAR, GZ, RAR, 7Z (marked for skipping)

#### Sensitive File Detection
```javascript
// Automatically flags sensitive files:
.env              → sensitive: true
.env.local        → sensitive: true
private_key.*     → sensitive: true
*secret*          → sensitive: true
*password*        → sensitive: true
*token*           → sensitive: true
```

### 3. Robust Error Handling

#### Retry Logic with Exponential Backoff
```javascript
// Automatic retry on:
- Network timeouts (ETIMEDOUT)
- Connection resets (ECONNRESET)
- Rate limiting (403 with rate limit header)
- Temporary GitHub issues (500, 502, 503)

// Configurable retry strategy:
{
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true  // 1s, 2s, 4s
}
```

#### Error Classification
- **404**: File not found → Clear error message
- **403**: Access forbidden → Check token permissions
- **401**: Authentication failed → Token invalid
- **Rate limit**: Automatic wait based on retry-after header
- **Network errors**: Automatic retry with backoff

### 4. Enhanced Logging System

#### Structured Logger
```javascript
// Every operation is logged with context:
{
  timestamp: "2024-01-09T10:30:45.123Z",
  level: "info",
  message: "Fetching content",
  data: {
    owner: "microsoft",
    repo: "vscode",
    path: "src/main.js",
    ref: "main",
    attempt: 1,
    cacheHit: false
  }
}
```

#### Log Levels
- **DEBUG**: Detailed operation steps
- **INFO**: Normal operations
- **WARN**: Potential issues (sensitive files, large files)
- **ERROR**: Failures with full context

### 5. Multimodal Content Handling

#### Intelligent Content Processing
```javascript
// Different handling based on file type:
- Text files → UTF-8 decode, validate encoding
- Images → Keep base64, track count against limit
- PDFs → Keep base64, check size limits
- Binary → Skip with reason
- Symlinks → Skip for security
- Submodules → Skip with notification
```

#### Directory Handling
```javascript
// Smart directory processing:
- Concurrent file loading with limits
- Intelligent sampling for large directories
- Type-based prioritization (code > config > text > images)
- Size-based sorting (smaller files first)
```

### 6. Performance Optimizations

#### Smart Caching
```javascript
// Cache with validation:
- 24-hour TTL by default
- Cache key includes ref/branch
- Statistics tracking (hits, misses, efficiency)
- Memory-efficient storage
```

#### Concurrent Loading
```javascript
// Parallel processing with limits:
- Configurable concurrency (default: 5)
- Promise.allSettled for resilience
- Batch processing to avoid overwhelming API
```

### 7. Statistics & Monitoring

#### Comprehensive Metrics
```javascript
{
  apiCalls: 45,
  cacheHits: 23,
  cacheMisses: 12,
  cacheEfficiency: 0.657,  // 65.7%
  retries: 3,
  errors: 2,
  errorRate: 0.044,         // 4.4%
  filesLoaded: 35,
  filesSkipped: 8,
  bytesLoaded: 4567890,
  averageFileSize: 130511
}
```

## Corner Cases Addressed

### 1. Path Parsing Corner Cases
- Empty or whitespace-only paths
- Paths with special characters (!@#$%^&*(){}[]|\\:;"'<>,.?/)
- Unicode filenames (Chinese, Arabic, Emoji)
- Very long paths (>255 characters)
- Windows-style paths (auto-converted)
- URL-style paths (rejected with clear error)
- Malicious injection attempts (sanitized)

### 2. File Handling Corner Cases
- Zero-byte files
- Files without extensions
- Hidden files (.gitignore, .env)
- Files with multiple dots (file.min.js)
- Case-sensitive extensions (.JS vs .js)
- Compressed files (file.tar.gz)
- Source maps (file.js.map)
- Minified files (detected and handled)

### 3. API Interaction Corner Cases
- Rate limiting (automatic backoff)
- Partial responses (retry)
- Network interruptions (retry with backoff)
- Invalid authentication (clear error)
- Non-existent repositories (graceful failure)
- Private repositories (permission check)
- Archived repositories (handled normally)
- Empty repositories (handled gracefully)

### 4. Content Processing Corner Cases
- Invalid UTF-8 sequences (detected and warned)
- Mixed line endings (normalized)
- Binary data in text files (handled)
- Extremely large files (>100MB)
- Circular symlinks (prevented)
- Broken symlinks (skipped)
- Git submodules (identified and skipped)
- LFS pointers (detected)

### 5. Concurrent Operations Corner Cases
- Race conditions in caching (thread-safe)
- Parallel API limit hitting (queued)
- Partial batch failures (resilient)
- Memory pressure (progressive loading)
- Timeout coordination (managed)

## Security Considerations

### Path Traversal Prevention
```javascript
// Blocked patterns:
../           // Parent directory access
..\\          // Windows parent directory
/etc/         // System directories
C:\\          // Absolute Windows paths
\\\\server\\  // UNC paths
```

### Sensitive Data Protection
```javascript
// Automatic warnings for:
- Environment files (.env)
- Private keys (*_key.pem)
- Password files
- Token files
- Secret configurations
```

### Input Sanitization
```javascript
// All inputs sanitized for:
- Command injection
- Path traversal
- Null byte injection
- Unicode exploits
- Format string attacks
```

## Usage Examples

### Basic Usage with Logging
```javascript
const abTest = new ABTestToolRobust({
  octokit,
  anthropic,
  repoOwner: 'owner',
  repoName: 'repo',
  logLevel: 'debug'  // Enable detailed logging
});

// All operations will be logged
const context = await abTest.loadMultimodalContext([
  'microsoft/vscode:src',
  'torvalds/linux:kernel/sched/core.c'
]);

// Check statistics
const stats = abTest.getStats();
console.log('Cache efficiency:', stats.cacheEfficiency);
console.log('Error rate:', stats.errorRate);

// Get detailed logs
const logs = abTest.getLogs();
const errors = logs.filter(l => l.level === 'error');
```

### Error Recovery Example
```javascript
// Automatic retry on failures
const content = await abTest.fetchContent(pathInfo, {
  maxRetries: 5,
  retryDelay: 2000,
  exponentialBackoff: true
});

// Handles:
// - Network failures (automatic retry)
// - Rate limiting (waits for reset)
// - 404 errors (clear message, no retry)
// - Authentication errors (fails fast)
```

### Concurrent Loading with Limits
```javascript
const context = await abTest.loadMultimodalContext(paths, {
  concurrency: 10,              // Load 10 files at once
  maxFilesPerDirectory: 20,     // Sample large directories
  includePatterns: [/\.(js|ts)$/],
  excludePatterns: [/node_modules/, /test/]
});
```

## Testing

The test suite (`test-abtest-edge-cases.js`) validates:
1. **30+ invalid path formats**
2. **25+ edge case valid paths**
3. **40+ file type detections**
4. **Multimodal content handling**
5. **Directory traversal**
6. **Error recovery mechanisms**
7. **Cache behavior**
8. **Concurrent loading**
9. **Large file handling**
10. **Sensitive file detection**

## Summary

The robust implementation provides:
- ✅ **Complete validation** of all inputs
- ✅ **Graceful error handling** with retries
- ✅ **Comprehensive logging** at every step
- ✅ **Security protection** against malicious inputs
- ✅ **Performance optimization** through caching
- ✅ **Resilient operation** in adverse conditions
- ✅ **Clear error messages** for debugging
- ✅ **Statistical monitoring** for optimization

All identified corner cases and edge scenarios have been addressed with proper error handling, logging, and recovery mechanisms.