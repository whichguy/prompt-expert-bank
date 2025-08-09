/**
 * Prompt Role Manager
 * Loads prompt files as Claude personas/system prompts
 * Enables Claude to adopt expert roles from prompt-expert-bank
 */

const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');

class PromptRoleManager {
  constructor(options = {}) {
    this.octokit = options.octokit;
    this.repoOwner = options.repoOwner;
    this.repoName = options.repoName;
    this.workspace = options.workspace || process.cwd();
    this.roleCache = new Map();
  }

  /**
   * Load a prompt as a system role
   * @param {string} roleIdentifier - Either filename or expert domain
   * @returns {Object} Role definition with system prompt
   */
  async loadRole(roleIdentifier) {
    // Check cache first
    if (this.roleCache.has(roleIdentifier)) {
      return this.roleCache.get(roleIdentifier);
    }

    let role;
    
    // Try to load as file path first
    if (roleIdentifier.includes('/') || roleIdentifier.endsWith('.md') || roleIdentifier.endsWith('.txt')) {
      role = await this.loadFromFile(roleIdentifier);
    } else {
      // Try as expert domain
      role = await this.loadFromDomain(roleIdentifier);
    }

    if (!role) {
      throw new Error(`Could not load role: ${roleIdentifier}`);
    }

    // Cache the role
    this.roleCache.set(roleIdentifier, role);
    return role;
  }

  /**
   * Load role from file path
   */
  async loadFromFile(filePath) {
    try {
      // Try local file first
      const fullPath = path.resolve(this.workspace, filePath);
      const content = await fs.readFile(fullPath, 'utf8');
      
      return {
        name: path.basename(filePath, path.extname(filePath)),
        source: 'file',
        path: filePath,
        systemPrompt: this.extractSystemPrompt(content),
        metadata: this.extractMetadata(content)
      };
    } catch (localError) {
      // Try GitHub repository
      if (this.octokit && this.repoOwner && this.repoName) {
        try {
          const { data } = await this.octokit.repos.getContent({
            owner: this.repoOwner,
            repo: this.repoName,
            path: filePath
          });

          const content = Buffer.from(data.content, 'base64').toString('utf8');
          
          return {
            name: path.basename(filePath, path.extname(filePath)),
            source: 'github',
            path: filePath,
            sha: data.sha,
            systemPrompt: this.extractSystemPrompt(content),
            metadata: this.extractMetadata(content)
          };
        } catch (githubError) {
          console.warn(`Could not load ${filePath} from GitHub:`, githubError.message);
        }
      }
      return null;
    }
  }

  /**
   * Load role from expert domain
   */
  async loadFromDomain(domain) {
    // Check if it matches existing expert definitions
    const expertPath = `expert-definitions/${domain}-expert.md`;
    return await this.loadFromFile(expertPath);
  }

  /**
   * Extract system prompt from markdown content
   */
  extractSystemPrompt(content) {
    // Remove markdown headers and formatting for cleaner system prompt
    let prompt = content
      .replace(/^#+ .+$/gm, '') // Remove headers
      .replace(/^\*+.*$/gm, '') // Remove emphasis lines
      .replace(/^-+$/gm, '') // Remove separator lines
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
      .trim();

    // If content starts with a clear instruction, use as-is
    if (prompt.toLowerCase().startsWith('you are') || 
        prompt.toLowerCase().startsWith('act as') ||
        prompt.toLowerCase().includes('expert')) {
      return prompt;
    }

    // Otherwise, wrap in standard format
    return `You are an expert assistant. Follow these guidelines:\n\n${prompt}`;
  }

  /**
   * Extract metadata from content
   */
  extractMetadata(content) {
    const metadata = {
      domain: null,
      version: null,
      lastModified: null,
      evaluationCriteria: [],
      testScenarios: []
    };

    // Extract domain from filename or content
    const domainMatch = content.match(/(?:domain|area|field):\s*([^\n]+)/i);
    if (domainMatch) {
      metadata.domain = domainMatch[1].trim();
    }

    // Extract version
    const versionMatch = content.match(/(?:version|v):\s*([^\n]+)/i);
    if (versionMatch) {
      metadata.version = versionMatch[1].trim();
    }

    // Extract evaluation criteria
    const criteriaSection = content.match(/(?:evaluation criteria|criteria):\s*((?:.|\n)*?)(?:\n\n|$)/i);
    if (criteriaSection) {
      metadata.evaluationCriteria = criteriaSection[1]
        .split('\n')
        .filter(line => line.trim().match(/^\d+\.|^-/))
        .map(line => line.replace(/^\d+\.|^-\s*/, '').trim())
        .filter(Boolean);
    }

    return metadata;
  }

  /**
   * Get available roles
   */
  async getAvailableRoles() {
    const roles = [];

    try {
      // Scan expert-definitions directory
      const expertPath = path.join(this.workspace, 'expert-definitions');
      
      try {
        const files = await fs.readdir(expertPath);
        for (const file of files) {
          if (file.endsWith('-expert.md')) {
            const domain = file.replace('-expert.md', '');
            roles.push({
              identifier: domain,
              name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Expert`,
              source: 'local',
              path: `expert-definitions/${file}`
            });
          }
        }
      } catch (localError) {
        // Try GitHub if local fails
        if (this.octokit && this.repoOwner && this.repoName) {
          try {
            const { data } = await this.octokit.repos.getContent({
              owner: this.repoOwner,
              repo: this.repoName,
              path: 'expert-definitions'
            });

            for (const item of data) {
              if (item.name.endsWith('-expert.md')) {
                const domain = item.name.replace('-expert.md', '');
                roles.push({
                  identifier: domain,
                  name: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Expert`,
                  source: 'github',
                  path: item.path,
                  sha: item.sha
                });
              }
            }
          } catch (githubError) {
            console.warn('Could not list roles from GitHub:', githubError.message);
          }
        }
      }
    } catch (error) {
      console.warn('Error getting available roles:', error.message);
    }

    return roles;
  }

  /**
   * Create role-enhanced system message
   */
  buildRoleSystemMessage(role, baseContext) {
    let systemMessage = role.systemPrompt;

    // Add context integration
    systemMessage += `\n\nContext:\n- Repository: ${baseContext.repository}\n- Actor: ${baseContext.actor}`;
    
    if (baseContext.pr) {
      systemMessage += `\n- Pull Request: #${baseContext.pr.number}`;
    }
    
    if (baseContext.issue) {
      systemMessage += `\n- Issue: #${baseContext.issue.number}`;
    }

    // Add role-specific instructions
    systemMessage += `\n\nYou are operating in the role of: ${role.name}`;
    
    if (role.metadata.domain) {
      systemMessage += `\nDomain expertise: ${role.metadata.domain}`;
    }

    if (role.metadata.evaluationCriteria.length > 0) {
      systemMessage += `\nEvaluation criteria: ${role.metadata.evaluationCriteria.join(', ')}`;
    }

    systemMessage += `\n\nYou have access to GitHub repository tools. Apply your domain expertise to complete the requested task.`;

    return systemMessage;
  }

  /**
   * Clear role cache
   */
  clearCache() {
    this.roleCache.clear();
  }
}

module.exports = { PromptRoleManager };