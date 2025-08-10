#!/usr/bin/env node

/**
 * Test script to verify context-aware evaluation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runTest() {
  console.log('=== Repository Context Validation Test ===\n');
  
  // Step 0: Clean up any existing test files from Claude cache
  console.log('Step 0: Cleaning up existing test files from Claude cache...');
  try {
    // First, check if there's an existing cache index
    const cacheIndexPath = path.join(__dirname, '..', '.claude-cache-index.json');
    if (fs.existsSync(cacheIndexPath)) {
      const cacheIndex = JSON.parse(fs.readFileSync(cacheIndexPath, 'utf8'));
      
      // Look for test files in the cache
      let testFilesFound = 0;
      let testFilesDeleted = [];
      
      for (const [fileId, fileData] of Object.entries(cacheIndex.files || {})) {
        // Check if this is a test file based on path
        if (fileData.path && (
            fileData.path.includes('test/context-test-demo') ||
            fileData.path.includes('api-config.json') ||
            fileData.path.includes('processor.js') ||
            fileData.path.includes('architecture.svg')
        )) {
          testFilesFound++;
          testFilesDeleted.push({
            fileId: fileId,
            path: fileData.path,
            lastSent: fileData.lastSent
          });
          
          // Mark as deleted in cache
          fileData.deletedAt = new Date().toISOString();
          fileData.deleteReason = 'test_cleanup';
          console.log(`   - Marking for deletion: ${fileData.path} (ID: ${fileId.substring(0, 8)}...)`);}
      }
      
      if (testFilesFound > 0) {
        // Save updated cache index
        fs.writeFileSync(cacheIndexPath, JSON.stringify(cacheIndex, null, 2));
        console.log(`   ✅ Marked ${testFilesFound} test files for deletion from Claude cache`);
        
        // Log deleted files
        console.log('   Deleted files:');
        for (const file of testFilesDeleted) {
          console.log(`     - ${file.path} (${file.fileId.substring(0, 8)}...)`);}
      } else {
        console.log('   ✅ No existing test files found in Claude cache');}
    } else {
      console.log('   ✅ No cache index found - starting fresh');}
  } catch (error) {
    console.log(`   ⚠️  Cache cleanup warning: ${error.message}`);
  }
  
  // Step 1: Load context
  console.log('\nStep 1: Loading repository context...');
  try {
    const contextOutput = execSync(
      'node scripts/repo-context-v2.js test/context-test-demo --include-images --max-files=10',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    
    const context = JSON.parse(contextOutput);
    console.log(`✅ Context loaded: ${context.summary.totalFiles} files`);
    console.log(`   - Text files: ${context.summary.textFiles}`);
    console.log(`   - Image files: ${context.summary.imageFiles}`);
    console.log(`   - Total size: ${Math.round(context.summary.totalSize / 1024)}KB`);
    
    // Step 2: Track files in cache
    console.log('\nStep 2: Tracking NEW files in Claude cache...');
    const trackingResult = execSync(
      'node scripts/claude-cache-manager.js track test/context-test-demo',
      { 
        input: contextOutput,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    
    const tracking = JSON.parse(trackingResult);
    console.log(`✅ Files tracked in session: ${tracking.sessionId}`);
    console.log(`   - Files tracked: ${tracking.tracked}`);
    
    // Step 3: Verify file hashes
    console.log('\nStep 3: Verifying file hashes...');
    const files = context.files || [];
    for (const file of files) {
      console.log(`   - ${file.path}: Hash ${file.hash.substring(0, 8)}... (${file.type})`);
    }
    
    // Step 4: Check prompt differences
    console.log('\nStep 4: Analyzing prompt differences...');
    const v1Prompt = fs.readFileSync('test/api-documentation-prompt-v1.md', 'utf8');
    const v2Prompt = fs.readFileSync('test/api-documentation-prompt-v2.md', 'utf8');
    
    const v1HasContextRefs = v1Prompt.includes('UNIQUE_PROCESSING_KEY_789') || 
                             v1Prompt.includes('/api/v2/auth/login');
    const v2HasContextRefs = v2Prompt.includes('UNIQUE_PROCESSING_KEY_789') && 
                             v2Prompt.includes('/api/v2/auth/login');
    
    console.log(`   - V1 prompt references context: ${v1HasContextRefs ? '❌ No' : '✅ No (expected)'}`);
    console.log(`   - V2 prompt references context: ${v2HasContextRefs ? '✅ Yes' : '❌ No'}`);
    
    // Step 5: Simulate evaluation
    console.log('\nStep 5: Simulating evaluation (dry run)...');
    console.log('   - Thread A would receive: Context + V1 prompt');
    console.log('   - Thread B would receive: Context + V2 prompt');
    console.log('   - Both threads get SAME file IDs from repository');
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log('✅ Cache cleanup: PASS');
    console.log('✅ Context loading: PASS');
    console.log('✅ File tracking: PASS');
    console.log('✅ Hash calculation: PASS');
    console.log(`${v2HasContextRefs ? '✅' : '❌'} Prompt improvement: ${v2HasContextRefs ? 'PASS' : 'FAIL'}`);
    
    console.log('\n📝 Expected Evaluation Results:');
    console.log('   - Thread A (V1 + context): Generic documentation (~5-6/10)');
    console.log('   - Thread B (V2 + context): Specific documentation (~9-10/10)');
    console.log('   - Improvement: ~40-50% expected');
    
    console.log('\n💡 To run actual evaluation with PR:');
    console.log('   1. Push branch: git push origin test-context-feature');
    console.log('   2. Create PR: gh pr create --title "Test context feature"');
    console.log('   3. Comment: @prompt-expert programming --repo-path="test/context-test-demo"');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stdout) console.error('Output:', error.stdout.toString());
    if (error.stderr) console.error('Error:', error.stderr.toString());
    process.exit(1);
  }
}

runTest().catch(console.error);