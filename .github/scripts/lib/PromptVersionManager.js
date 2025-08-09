/**
 * Prompt Version Manager
 * Tracks prompt evolution and expert feedback loops
 * Integrates with GitHub history for versioning
 */

const fs = require('fs').promises;
const path = require('path');

class PromptVersionManager {
  constructor(options = {}) {
    this.octokit = options.octokit;
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    this.workspace = options.workspace || process.cwd();
    this.versionsCache = new Map();
  }

  /**
   * Get version history for a prompt file
   */
  async getVersionHistory(filePath, limit = 10) {
    const cacheKey = `${filePath}:${limit}`;
    
    if (this.versionsCache.has(cacheKey)) {
      return this.versionsCache.get(cacheKey);
    }

    let history = [];
    
    if (this.octokit && this.repoOwner && this.repoName) {
      try {
        // Get commit history for file
        const { data: commits } = await this.octokit.repos.listCommits({
          owner: this.repoOwner,
          repo: this.repoName,
          path: filePath,
          per_page: limit
        });

        // Build version history
        for (const commit of commits) {
          try {
            // Get file content at this commit
            const { data: fileData } = await this.octokit.repos.getContent({
              owner: this.repoOwner,
              repo: this.repoName,
              path: filePath,
              ref: commit.sha
            });

            const content = Buffer.from(fileData.content, 'base64').toString('utf8');
            
            history.push({
              version: commit.sha.substring(0, 8),
              sha: commit.sha,
              date: commit.commit.committer.date,
              author: commit.commit.author.name,
              message: commit.commit.message,
              content: content,
              metadata: this.extractVersionMetadata(content, commit)
            });
          } catch (error) {
            console.warn(`Could not get content for commit ${commit.sha}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('Could not get version history from GitHub:', error.message);
      }
    }

    // Cache and return
    this.versionsCache.set(cacheKey, history);
    return history;
  }

  /**
   * Compare two versions of a prompt
   */
  async compareVersions(filePath, oldVersion, newVersion) {
    const history = await this.getVersionHistory(filePath, 50);
    
    const oldVer = history.find(v => v.version === oldVersion || v.sha === oldVersion);
    const newVer = history.find(v => v.version === newVersion || v.sha === newVersion);

    if (!oldVer || !newVer) {
      throw new Error('One or both versions not found');
    }

    return {
      oldVersion: oldVer,
      newVersion: newVer,
      changes: this.calculateChanges(oldVer.content, newVer.content),
      improvementScore: this.calculateImprovementScore(oldVer, newVer)
    };
  }

  /**
   * Get improvement trends for a prompt
   */
  async getImprovementTrends(filePath) {
    const history = await this.getVersionHistory(filePath, 20);
    
    const trends = {
      totalVersions: history.length,
      timespan: history.length > 1 ? {
        start: history[history.length - 1].date,
        end: history[0].date
      } : null,
      improvements: [],
      expertFeedback: [],
      qualityTrend: []
    };

    // Analyze each version for improvement indicators
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const previous = history[i + 1];
      
      const improvement = {
        version: current.version,
        date: current.date,
        changes: this.calculateChanges(previous.content, current.content),
        expertDecision: this.extractExpertDecision(current.message),
        qualityIndicators: this.extractQualityIndicators(current.content, previous.content)
      };

      trends.improvements.push(improvement);

      // Extract expert feedback from commit messages
      if (current.message.toLowerCase().includes('expert') || 
          current.message.toLowerCase().includes('feedback')) {
        trends.expertFeedback.push({
          version: current.version,
          date: current.date,
          feedback: current.message
        });
      }
    }

    return trends;
  }

  /**
   * Track expert feedback cycle
   */
  async trackFeedbackCycle(filePath, expertDecision, improvements) {
    const cycle = {
      timestamp: new Date().toISOString(),
      filePath: filePath,
      expertDecision: expertDecision, // MERGE, SUGGEST, REJECT
      improvements: improvements || [],
      cycleNumber: await this.getCycleNumber(filePath)
    };

    // Store in memory for current session
    if (!this.feedbackCycles) {
      this.feedbackCycles = [];
    }
    this.feedbackCycles.push(cycle);

    return cycle;
  }

  /**
   * Get current cycle number for a file
   */
  async getCycleNumber(filePath) {
    // Count SUGGEST decisions in recent history
    const history = await this.getVersionHistory(filePath, 10);
    let cycles = 0;
    
    for (const version of history) {
      if (version.message.toLowerCase().includes('suggest') || 
          version.message.toLowerCase().includes('improvement')) {
        cycles++;
      }
    }
    
    return cycles + 1;
  }

  /**
   * Extract version metadata from content and commit
   */
  extractVersionMetadata(content, commit) {
    const metadata = {
      wordCount: content.split(/\s+/).length,
      lineCount: content.split('\n').length,
      complexityScore: this.calculateComplexity(content),
      hasExamples: content.toLowerCase().includes('example'),
      hasCriteria: content.toLowerCase().includes('criteria'),
      hasInstructions: content.toLowerCase().includes('instruction'),
      expertType: this.detectExpertType(content)
    };

    return metadata;
  }

  /**
   * Calculate changes between two content versions
   */
  calculateChanges(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    return {
      linesAdded: Math.max(0, newLines.length - oldLines.length),
      linesRemoved: Math.max(0, oldLines.length - newLines.length),
      wordsChanged: Math.abs(newContent.split(/\s+/).length - oldContent.split(/\s+/).length),
      significantChange: this.isSignificantChange(oldContent, newContent)
    };
  }

  /**
   * Calculate improvement score between versions
   */
  calculateImprovementScore(oldVersion, newVersion) {
    let score = 0;
    
    // Metadata improvements
    const oldMeta = oldVersion.metadata;
    const newMeta = newVersion.metadata;
    
    if (newMeta.hasExamples && !oldMeta.hasExamples) score += 10;
    if (newMeta.hasCriteria && !oldMeta.hasCriteria) score += 15;
    if (newMeta.hasInstructions && !oldMeta.hasInstructions) score += 10;
    
    // Complexity improvement (not too complex, not too simple)
    const complexityDiff = newMeta.complexityScore - oldMeta.complexityScore;
    if (complexityDiff > 0 && complexityDiff < 20) score += 5;
    
    // Length improvements (more detailed but not excessive)
    const wordDiff = newMeta.wordCount - oldMeta.wordCount;
    if (wordDiff > 0 && wordDiff < 200) score += 5;
    
    return score;
  }

  /**
   * Extract expert decision from commit message
   */
  extractExpertDecision(message) {
    const msgLower = message.toLowerCase();
    
    if (msgLower.includes('merge') || msgLower.includes('approve')) {
      return 'MERGE';
    } else if (msgLower.includes('suggest') || msgLower.includes('improve')) {
      return 'SUGGEST';
    } else if (msgLower.includes('reject')) {
      return 'REJECT';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Extract quality indicators from content
   */
  extractQualityIndicators(newContent, oldContent) {
    return {
      addedExamples: this.countExamples(newContent) - this.countExamples(oldContent),
      addedCriteria: this.countCriteria(newContent) - this.countCriteria(oldContent),
      clarityImprovement: this.assessClarity(newContent) - this.assessClarity(oldContent),
      specificity: this.assessSpecificity(newContent) - this.assessSpecificity(oldContent)
    };
  }

  /**
   * Calculate content complexity
   */
  calculateComplexity(content) {
    // Simple complexity based on vocabulary and structure
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(/\s+/).length;
    const avgWordsPerSentence = words / Math.max(sentences, 1);
    
    return Math.round(avgWordsPerSentence * 2);
  }

  /**
   * Detect expert type from content
   */
  detectExpertType(content) {
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('security') || contentLower.includes('risk')) return 'security';
    if (contentLower.includes('code') || contentLower.includes('programming')) return 'programming';
    if (contentLower.includes('financial') || contentLower.includes('finance')) return 'financial';
    if (contentLower.includes('data') || contentLower.includes('analytics')) return 'data-analysis';
    
    return 'general';
  }

  /**
   * Check if change is significant
   */
  isSignificantChange(oldContent, newContent) {
    const oldWords = oldContent.split(/\s+/);
    const newWords = newContent.split(/\s+/);
    
    const changeRatio = Math.abs(oldWords.length - newWords.length) / oldWords.length;
    return changeRatio > 0.1; // More than 10% change
  }

  /**
   * Count examples in content
   */
  countExamples(content) {
    const exampleKeywords = /example|for instance|such as|e\.g\./gi;
    return (content.match(exampleKeywords) || []).length;
  }

  /**
   * Count criteria mentions
   */
  countCriteria(content) {
    const criteriaKeywords = /criteria|requirement|must|should|evaluate/gi;
    return (content.match(criteriaKeywords) || []).length;
  }

  /**
   * Assess content clarity (simple heuristic)
   */
  assessClarity(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    // Shorter sentences generally indicate better clarity
    return Math.max(0, 100 - avgLength);
  }

  /**
   * Assess content specificity
   */
  assessSpecificity(content) {
    const specificWords = /specific|exactly|precisely|detailed|explicit|particular/gi;
    return (content.match(specificWords) || []).length;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.versionsCache.clear();
    this.feedbackCycles = [];
  }
}

module.exports = { PromptVersionManager };