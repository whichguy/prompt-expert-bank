# Cache Management System

## Overview

The Prompt Expert cache management system tracks files sent to Claude API and manages cleanup of stale content to optimize performance and reduce API costs. It supports multimodal files including text, images, and PDFs.

## How It Works

### 1. File Tracking

When repository context is loaded and sent to Claude:
- Each file is hashed using git blob format for consistency
- Files are tracked in `.claude-cache-index.json` 
- Session information is recorded for analytics
- Cache hits are tracked to measure savings

### 2. Automatic Cleanup

Before each evaluation:
- Files older than 14 days are identified
- Historical git versions are checked
- Stale files are marked for cleanup
- Sessions older than 30 days are purged

### 3. Multimodal Support

The system supports multiple file types:

#### Text Files
- Code files: `.js`, `.py`, `.java`, `.go`, `.rs`, etc.
- Config files: `.json`, `.yaml`, `.xml`, `.toml`
- Documentation: `.md`, `.txt`
- Special files: `Dockerfile`, `Makefile`, `README`

#### Images
- Formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`
- Use cases: Architecture diagrams, screenshots, UI mockups
- Cached with base64 encoding

#### PDFs
- Format: `.pdf`
- Use cases: Documentation, specifications, reports
- Note: Converted to text for analysis

## Cache Index Structure

```json
{
  "version": "2.0",
  "sessions": {
    "sessionId": {
      "startTime": "2024-01-01T00:00:00Z",
      "files": [],
      "stats": {
        "filesSent": 10,
        "bytesSent": 102400,
        "cacheHits": 5
      }
    }
  },
  "files": {
    "fileHash": {
      "path": "src/index.js",
      "type": "text",
      "firstSent": "2024-01-01T00:00:00Z",
      "lastSent": "2024-01-01T00:00:00Z",
      "sentCount": 3,
      "claudeId": "hash",
      "size": 1024
    }
  },
  "lastCleanup": "2024-01-01T00:00:00Z",
  "stats": {
    "totalFilesSent": 100,
    "totalBytesSent": 1048576,
    "cacheSavings": 524288
  }
}
```

## Cleanup Rules

Files are marked as stale and cleaned up when:

1. **Outdated** (14+ days old)
   - File has been modified in git
   - Old version is no longer current
   - Modified more than 14 days ago

2. **Deleted**
   - File no longer exists in repository
   - Removed from git tracking

3. **Unused** (28+ days)
   - Not sent to Claude in 28 days
   - Low reference count

4. **Historical**
   - Old git versions from commits
   - Older than 14 days
   - No longer referenced

## CLI Commands

### Check for stale files and clean up
```bash
node scripts/claude-cache-manager.js cleanup ./repo-path
```

### View cache statistics
```bash
node scripts/claude-cache-manager.js stats ./repo-path
```

### Track files being sent
```bash
cat repo_context.json | node scripts/claude-cache-manager.js track ./repo-path
```

### List active cached files
```bash
node scripts/claude-cache-manager.js list ./repo-path
```

### Clean old sessions
```bash
node scripts/claude-cache-manager.js clean-sessions ./repo-path 30
```

## Workflow Integration

The cache management is integrated into the GitHub Actions workflow:

1. **Cache Cleanup Phase**
   - Runs before context loading
   - Identifies stale files
   - Marks files for cleanup
   - Generates cleanup report

2. **Context Loading Phase**
   - Loads repository files
   - Uses git hashes when available
   - Tracks files in cache index
   - Records session information

3. **Evaluation Phase**
   - Uses cached context with Anthropic API
   - Benefits from cache control headers
   - Reduces API costs through caching

## Performance Benefits

- **Reduced API Costs**: Cache control headers reduce token usage
- **Faster Responses**: Cached content loads faster
- **Efficient Storage**: Deduplication via git hashes
- **Clean History**: Automatic cleanup prevents bloat

## Best Practices

1. **Regular Cleanup**: Automatic cleanup runs before each evaluation
2. **Git Integration**: Uses git hashes for consistency
3. **Type Support**: Include relevant images and docs for context
4. **Session Tracking**: Monitor usage patterns via sessions
5. **Analytics**: Review cache stats to optimize usage

## Troubleshooting

### Cache not found
- Check if `.claude-cache-index.json` exists
- Initialize with first run

### High cache miss rate
- Check if files are changing frequently
- Consider longer cache duration

### Cleanup not working
- Verify git repository status
- Check file permissions
- Review cleanup report for errors

## Future Enhancements

- Direct integration with Claude's cache API when available
- Automatic cache warming for frequently used files
- Differential updates for large files
- Smart prefetching based on usage patterns