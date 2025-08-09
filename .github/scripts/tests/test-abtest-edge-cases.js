#!/usr/bin/env node

/**
 * Test Suite for ABTest Edge Cases and Error Scenarios
 * Tests corner cases, error handling, and logging
 */

const { ABTestToolRobust } = require('../lib/ABTestToolRobust');
const { Octokit } = require('@octokit/rest');
const { Anthropic } = require('@anthropic-ai/sdk');

async function testEdgeCases() {
  console.log('🧪 Testing ABTest Edge Cases and Error Handling\n');
  
  const octokit = new Octokit({ 
    auth: process.env.GITHUB_TOKEN 
  });
  
  const anthropic = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
  });

  const abTest = new ABTestToolRobust({
    octokit,
    anthropic,
    repoOwner: 'whichguy',
    repoName: 'prompt-expert-bank',
    logLevel: 'debug' // Enable detailed logging
  });

  const testResults = [];

  // Test 1: Invalid path formats
  console.log('📝 Test 1: Invalid Path Formats');
  const invalidPaths = [
    '',                                    // Empty string
    null,                                  // Null
    undefined,                             // Undefined
    '   ',                                 // Only whitespace
    'owner/repo/path',                     // Missing colon
    'owner:repo:path',                     // Wrong separator
    '/etc/passwd',                         // System file
    '../../../etc/passwd',                 // Path traversal
    'owner/repo:path@branch@tag',          // Multiple @ symbols
    'owner/repo:path with spaces',         // Spaces in path
    'owner/repo:path\nwith\nnewlines',    // Newlines in path
    'owner/repo:path;rm -rf /',           // Command injection attempt
    'owner/repo:path%00.txt',              // Null byte injection
    'owner/repo:path<script>',            // HTML injection
    'owner/repo:../../etc/passwd',        // Path traversal in file path
    'https://github.com/owner/repo',      // URL instead of path
    '\\\\server\\share\\file',            // Windows UNC path
    'C:\\Users\\file.txt',                // Windows absolute path
    'owner/repo:file.txt@',               // Empty ref
    '@branch',                            // Missing path
    ':file.txt',                          // Missing owner/repo
    'owner/:file.txt',                    // Missing repo
    '/owner/repo:file.txt',               // Leading slash
    'owner/repo:file.txt/',               // Trailing slash
    'owner..repo:file.txt',               // Invalid owner
    'owner/repo...:file.txt',             // Invalid repo
    'owner/repo:file@feature/branch',     // Branch with slash
    'owner/repo:file@v1.2.3',            // Version tag
    'owner/repo:file@abc123def456789',    // Partial SHA
  ];

  for (const invalidPath of invalidPaths) {
    try {
      console.log(`  Testing: "${invalidPath}"`);
      const parsed = abTest.parsePath(invalidPath);
      testResults.push({
        test: 'Invalid path',
        input: invalidPath,
        result: 'Parsed (unexpected)',
        parsed
      });
    } catch (error) {
      testResults.push({
        test: 'Invalid path',
        input: invalidPath,
        result: 'Failed (expected)',
        error: error.message
      });
    }
  }

  // Test 2: Valid but edge case paths
  console.log('\n📝 Test 2: Valid Edge Case Paths');
  const edgeCasePaths = [
    'file.txt',                                // Simple file
    'path/to/file.txt',                       // Nested path
    'path/to/file.txt@main',                  // With branch
    'owner/repo:file.txt',                    // Cross-repo
    'owner/repo:file.txt@feature-branch',     // Cross-repo with branch
    'owner/repo:file.txt@v1.0.0',            // With tag
    'owner/repo:file.txt@abc123def456789abc123def456789abc12345', // Full SHA
    'owner-with-dash/repo_with_underscore:file.txt', // Special chars
    'UPPERCASE/REPO:FILE.TXT',                // Case sensitivity
    '123owner/456repo:789file.txt',           // Numbers
    'o/r:f',                                   // Minimal
    'very-long-owner-name-that-is-still-valid/very-long-repo-name-that-is-still-valid:very/long/path/to/file/that/is/still/valid.txt', // Long
    'owner/repo:.github/workflows/test.yml',   // Hidden folder
    'owner/repo:src/file.min.js',             // Minified file
    'owner/repo:file.tar.gz',                 // Compressed file
    'owner/repo:файл.txt',                    // Unicode filename
    'owner/repo:file(1).txt',                 // Parentheses
    'owner/repo:file[1].txt',                 // Brackets
    'owner/repo:file{1}.txt',                 // Braces
    'owner/repo:file$.txt',                   // Dollar sign
    'owner/repo:file#.txt',                   // Hash
    'owner/repo:file%.txt',                   // Percent
    'owner/repo:file&.txt',                   // Ampersand
    'owner/repo:file+.txt',                   // Plus
    'owner/repo:file=.txt',                   // Equals
    'owner/repo:file~.txt',                   // Tilde
    'owner/repo:file!.txt',                   // Exclamation
    'owner/repo:file@.txt',                   // At symbol in filename
  ];

  for (const path of edgeCasePaths) {
    try {
      const parsed = abTest.parsePath(path);
      console.log(`  ✓ Parsed: ${path}`);
      console.log(`    Owner: ${parsed.owner}, Repo: ${parsed.repo}, Path: ${parsed.filePath}, Ref: ${parsed.ref}`);
      testResults.push({
        test: 'Edge case path',
        input: path,
        result: 'Success',
        parsed
      });
    } catch (error) {
      console.log(`  ✗ Failed: ${path} - ${error.message}`);
      testResults.push({
        test: 'Edge case path',
        input: path,
        result: 'Failed',
        error: error.message
      });
    }
  }

  // Test 3: File type detection edge cases
  console.log('\n📝 Test 3: File Type Detection');
  const fileTypeTests = [
    'file.js',           // JavaScript
    'file.JS',           // Uppercase extension
    'file.min.js',       // Minified
    'file.test.js',      // Test file
    'file.spec.ts',      // TypeScript test
    'file.d.ts',         // TypeScript definition
    'file',              // No extension
    '.gitignore',        // Hidden file
    '.env',              // Environment file (sensitive)
    '.env.local',        // Local env file
    'Dockerfile',        // No extension but known
    'Makefile',          // No extension but known
    'README',            // No extension
    'README.md',         // Markdown
    'file.unknown',      // Unknown extension
    'file.backup.js',    // Multiple dots
    'file.js.map',       // Source map
    'file.wasm',         // WebAssembly
    'file.ipynb',        // Jupyter notebook
    'file.sql',          // SQL
    'file.graphql',      // GraphQL
    'file.proto',        // Protocol buffer
    'file.jsx',          // React
    'file.vue',          // Vue
    'file.svelte',       // Svelte
    'file.rs',           // Rust
    'file.go',           // Go
    'file.kt',           // Kotlin
    'file.swift',        // Swift
    'file.r',            // R
    'file.jl',           // Julia
    'file.ex',           // Elixir
    'file.clj',          // Clojure
    'file.nim',          // Nim
    'file.zig',          // Zig
    'file.v',            // V
    'file.sol',          // Solidity
  ];

  for (const filename of fileTypeTests) {
    const pathInfo = abTest.parsePath(`owner/repo:${filename}`);
    console.log(`  File: ${filename}`);
    console.log(`    Type: ${pathInfo.fileType?.type || 'unknown'}`);
    console.log(`    MIME: ${pathInfo.fileType?.mime || 'N/A'}`);
    console.log(`    Language: ${pathInfo.fileType?.language || 'N/A'}`);
  }

  // Test 4: Multimodal content handling
  console.log('\n📝 Test 4: Multimodal Content Handling');
  const multimodalPaths = [
    'owner/repo:image.png',                   // Image
    'owner/repo:document.pdf',                // PDF
    'owner/repo:data.csv',                    // CSV
    'owner/repo:spreadsheet.xlsx',            // Excel
    'owner/repo:presentation.pptx',           // PowerPoint
    'owner/repo:archive.zip',                 // Archive (should skip)
    'owner/repo:video.mp4',                   // Video (should skip)
    'owner/repo:audio.mp3',                   // Audio (should skip)
    'owner/repo:font.ttf',                    // Font (should skip)
    'owner/repo:binary.exe',                  // Executable (should skip)
  ];

  const multimodalContext = await abTest.loadMultimodalContext(multimodalPaths, {
    loadDirectoryContents: false
  });

  console.log('  Multimodal Summary:');
  console.log(`    Files loaded: ${multimodalContext.summary.totalFiles}`);
  console.log(`    Files skipped: ${multimodalContext.summary.skipped}`);
  console.log(`    Errors: ${multimodalContext.summary.errors}`);
  console.log('    By type:', multimodalContext.summary.byType);

  // Test 5: Directory handling
  console.log('\n📝 Test 5: Directory Handling');
  const directoryPaths = [
    'whichguy/prompt-expert-bank:src',        // Directory
    'whichguy/prompt-expert-bank:.',          // Root
    'whichguy/prompt-expert-bank:',           // Empty path (root)
    'whichguy/prompt-expert-bank:src/components', // Nested directory
  ];

  for (const dirPath of directoryPaths) {
    try {
      console.log(`  Loading: ${dirPath}`);
      const context = await abTest.loadMultimodalContext([dirPath], {
        loadDirectoryContents: true,
        maxFilesPerDirectory: 5,
        includePatterns: [/\.(js|md)$/],
        excludePatterns: [/test/]
      });
      
      console.log(`    Type: ${context.directories.length > 0 ? 'Directory' : 'Unknown'}`);
      console.log(`    Files found: ${context.files.length}`);
      console.log(`    Subdirectories: ${context.directories.length}`);
    } catch (error) {
      console.log(`    Error: ${error.message}`);
    }
  }

  // Test 6: Error recovery and retries
  console.log('\n📝 Test 6: Error Recovery');
  const errorPaths = [
    'nonexistent/repo:file.txt',              // Non-existent repo
    'whichguy/prompt-expert-bank:nonexistent.txt', // Non-existent file
    'private/repo:file.txt',                  // Private repo (might fail)
    'torvalds/linux:kernel/sched/core.c',     // Large file
  ];

  for (const errorPath of errorPaths) {
    try {
      console.log(`  Testing: ${errorPath}`);
      const pathInfo = abTest.parsePath(errorPath);
      const content = await abTest.fetchContent(pathInfo, { maxRetries: 2 });
      console.log(`    Success: Loaded ${content.size} bytes`);
    } catch (error) {
      console.log(`    Expected error: ${error.message}`);
    }
  }

  // Test 7: Cache behavior
  console.log('\n📝 Test 7: Cache Behavior');
  const cachePath = 'whichguy/prompt-expert-bank:README.md';
  
  console.log('  First fetch (cache miss)...');
  let startTime = Date.now();
  await abTest.loadMultimodalContext([cachePath]);
  let duration1 = Date.now() - startTime;
  
  console.log('  Second fetch (cache hit)...');
  startTime = Date.now();
  await abTest.loadMultimodalContext([cachePath]);
  let duration2 = Date.now() - startTime;
  
  console.log(`    First fetch: ${duration1}ms`);
  console.log(`    Second fetch: ${duration2}ms (should be faster)`);
  console.log(`    Cache speedup: ${(duration1 / duration2).toFixed(2)}x`);

  // Test 8: Concurrent loading
  console.log('\n📝 Test 8: Concurrent Loading');
  const concurrentPaths = [
    'whichguy/prompt-expert-bank:README.md',
    'whichguy/prompt-expert-bank:package.json',
    'whichguy/prompt-expert-bank:.github/workflows/evaluate.yml',
    'facebook/react:README.md',
    'microsoft/vscode:README.md',
  ];

  console.log('  Loading 5 files concurrently...');
  startTime = Date.now();
  const concurrentContext = await abTest.loadMultimodalContext(concurrentPaths, {
    concurrency: 5
  });
  const concurrentDuration = Date.now() - startTime;
  
  console.log(`    Completed in ${concurrentDuration}ms`);
  console.log(`    Files loaded: ${concurrentContext.summary.totalFiles}`);
  console.log(`    Total size: ${concurrentContext.summary.totalSizeFormatted}`);

  // Test 9: Large file handling
  console.log('\n📝 Test 9: Large File Handling');
  const largeFilePaths = [
    'microsoft/vscode:src/vs/editor/editor.all.js', // Potentially large
    'tensorflow/tensorflow:tensorflow/python/keras/models.py', // Large
  ];

  for (const largePath of largeFilePaths) {
    try {
      console.log(`  Loading: ${largePath}`);
      const context = await abTest.loadMultimodalContext([largePath]);
      
      if (context.files.length > 0) {
        const file = context.files[0];
        console.log(`    Size: ${abTest.formatBytes(file.size)}`);
        console.log(`    Content length: ${file.content?.length || 0} chars`);
      }
    } catch (error) {
      console.log(`    Error: ${error.message}`);
    }
  }

  // Test 10: Sensitive file detection
  console.log('\n📝 Test 10: Sensitive File Detection');
  const sensitivePaths = [
    'owner/repo:.env',
    'owner/repo:config/secrets.json',
    'owner/repo:private_key.pem',
    'owner/repo:password.txt',
    'owner/repo:api_token.txt',
  ];

  for (const sensitivePath of sensitivePaths) {
    const pathInfo = abTest.parsePath(sensitivePath);
    console.log(`  File: ${pathInfo.filePath}`);
    console.log(`    Sensitive: ${pathInfo.fileType?.sensitive || false}`);
  }

  // Display statistics
  console.log('\n📊 Execution Statistics:');
  const stats = abTest.getStats();
  console.log(`  API Calls: ${stats.apiCalls}`);
  console.log(`  Cache Hits: ${stats.cacheHits}`);
  console.log(`  Cache Misses: ${stats.cacheMisses}`);
  console.log(`  Cache Efficiency: ${(stats.cacheEfficiency * 100).toFixed(1)}%`);
  console.log(`  Retries: ${stats.retries}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log(`  Error Rate: ${(stats.errorRate * 100).toFixed(1)}%`);
  console.log(`  Files Loaded: ${stats.filesLoaded}`);
  console.log(`  Files Skipped: ${stats.filesSkipped}`);
  console.log(`  Total Bytes: ${abTest.formatBytes(stats.bytesLoaded)}`);
  console.log(`  Average File Size: ${abTest.formatBytes(stats.averageFileSize)}`);

  // Display logs summary
  console.log('\n📜 Log Summary:');
  const logs = abTest.getLogs();
  const logsByLevel = {};
  for (const log of logs) {
    logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
  }
  console.log('  Log entries by level:', logsByLevel);

  // Return test results
  return {
    testResults,
    stats,
    logCount: logs.length,
    logsByLevel
  };
}

// Run tests
if (require.main === module) {
  testEdgeCases()
    .then(results => {
      console.log('\n✅ Edge case testing complete');
      
      // Display failed tests
      const failures = results.testResults.filter(r => r.result.includes('Failed'));
      if (failures.length > 0) {
        console.log(`\n⚠️ ${failures.length} tests had unexpected results:`);
        for (const failure of failures.slice(0, 10)) {
          console.log(`  - ${failure.test}: ${failure.input}`);
        }
      }
    })
    .catch(error => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testEdgeCases };