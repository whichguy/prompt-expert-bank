/**
 * Context Builder for Claude Code
 * Builds comprehensive context from GitHub API data
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

class ContextBuilder {
  constructor(octokit, logger) {
    this.octokit = octokit || new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    this.logger = logger || console;
  }

  /**
   * Build complete context for Claude session
   * @param {Object} params - Context parameters
   * @returns {Object} Complete context object
   */
  async buildContext(params) {
    const {
      repository,
      prNumber,
      issueNumber,
      comment,
      actor
    } = params;
    
    const context = {
      timestamp: new Date().toISOString(),
      actor: actor,
      repository: await this.getRepositoryInfo(repository),
      comment: comment
    };
    
    // Determine context type and fetch appropriate data
    if (prNumber) {
      context.type = 'pr';
      context.pr = await this.getPullRequestContext(repository, prNumber);
    } else if (issueNumber) {
      context.type = 'issue';
      context.issue = await this.getIssueContext(repository, issueNumber);
    } else {
      context.type = 'repository';
    }
    
    // Add environment context
    context.environment = this.getEnvironmentContext();
    
    // Add workflow context if in GitHub Actions
    if (process.env.GITHUB_ACTIONS === 'true') {
      context.workflow = this.getWorkflowContext();
    }
    
    return context;
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(repository) {
    const [owner, name] = repository.split('/');
    
    try {
      const { data: repo } = await this.octokit.repos.get({
        owner,
        repo: name
      });
      
      return {
        owner: owner,
        name: name,
        fullName: repository,
        defaultBranch: repo.default_branch,
        private: repo.private,
        language: repo.language,
        topics: repo.topics || [],
        description: repo.description,
        url: repo.html_url,
        hasIssues: repo.has_issues,
        hasProjects: repo.has_projects,
        hasWiki: repo.has_wiki,
        allowMergeCommit: repo.allow_merge_commit,
        allowSquashMerge: repo.allow_squash_merge,
        allowRebaseMerge: repo.allow_rebase_merge,
        deleteBranchOnMerge: repo.delete_branch_on_merge
      };
    } catch (error) {
      this.logger.log('error', 'Failed to fetch repository info', { 
        error: error.message 
      });
      
      // Return minimal info on error
      return {
        owner: owner,
        name: name,
        fullName: repository
      };
    }
  }

  /**
   * Get Pull Request context
   */
  async getPullRequestContext(repository, prNumber) {
    const [owner, repo] = repository.split('/');
    
    try {
      // Fetch PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Fetch PR files
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100
      });
      
      // Fetch PR reviews
      const { data: reviews } = await this.octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Fetch PR checks
      let checks = { total_count: 0, check_runs: [] };
      if (pr.head.sha) {
        try {
          const { data } = await this.octokit.checks.listForRef({
            owner,
            repo,
            ref: pr.head.sha
          });
          checks = data;
        } catch (e) {
          this.logger.log('warn', 'Failed to fetch PR checks', { error: e.message });
        }
      }
      
      // Fetch recent comments
      const { data: comments } = await this.octokit.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 10,
        sort: 'created',
        direction: 'desc'
      });
      
      return {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        draft: pr.draft,
        mergeable: pr.mergeable,
        mergeableState: pr.mergeable_state,
        merged: pr.merged,
        mergedAt: pr.merged_at,
        mergedBy: pr.merged_by?.login,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        closedAt: pr.closed_at,
        branch: {
          head: pr.head.ref,
          base: pr.base.ref,
          headSha: pr.head.sha,
          baseSha: pr.base.sha
        },
        labels: pr.labels.map(l => l.name),
        assignees: pr.assignees.map(a => a.login),
        reviewers: pr.requested_reviewers.map(r => r.login),
        teams: pr.requested_teams.map(t => t.slug),
        milestone: pr.milestone?.title,
        stats: {
          commits: pr.commits,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changed_files
        },
        files: files.map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          patch: f.patch ? f.patch.substring(0, 500) : null  // Limit patch size
        })),
        reviews: reviews.map(r => ({
          user: r.user.login,
          state: r.state,
          submittedAt: r.submitted_at,
          body: r.body
        })),
        checks: {
          total: checks.total_count,
          status: this.summarizeCheckStatus(checks.check_runs),
          runs: checks.check_runs.slice(0, 10).map(c => ({
            name: c.name,
            status: c.status,
            conclusion: c.conclusion,
            startedAt: c.started_at,
            completedAt: c.completed_at
          }))
        },
        recentComments: comments.slice(0, 5).map(c => ({
          id: c.id,
          user: c.user.login,
          body: c.body.substring(0, 500),  // Limit comment size
          createdAt: c.created_at
        })),
        url: pr.html_url,
        apiUrl: pr.url
      };
    } catch (error) {
      this.logger.log('error', 'Failed to fetch PR context', { 
        error: error.message,
        prNumber 
      });
      throw error;
    }
  }

  /**
   * Get Issue context
   */
  async getIssueContext(repository, issueNumber) {
    const [owner, repo] = repository.split('/');
    
    try {
      // Fetch issue details
      const { data: issue } = await this.octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });
      
      // Fetch recent comments
      const { data: comments } = await this.octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 10,
        sort: 'created',
        direction: 'desc'
      });
      
      // Fetch events
      const { data: events } = await this.octokit.issues.listEvents({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 20
      });
      
      return {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        stateReason: issue.state_reason,
        author: issue.user.login,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        closedBy: issue.closed_by?.login,
        labels: issue.labels.map(l => l.name),
        assignees: issue.assignees.map(a => a.login),
        milestone: issue.milestone?.title,
        locked: issue.locked,
        activeLockReason: issue.active_lock_reason,
        comments: issue.comments,
        recentComments: comments.slice(0, 5).map(c => ({
          id: c.id,
          user: c.user.login,
          body: c.body.substring(0, 500),  // Limit comment size
          createdAt: c.created_at
        })),
        events: events.slice(0, 10).map(e => ({
          event: e.event,
          actor: e.actor?.login,
          createdAt: e.created_at,
          label: e.label?.name,
          assignee: e.assignee?.login,
          reviewer: e.reviewer?.login
        })),
        reactions: {
          '+1': issue.reactions['+1'],
          '-1': issue.reactions['-1'],
          laugh: issue.reactions.laugh,
          hooray: issue.reactions.hooray,
          confused: issue.reactions.confused,
          heart: issue.reactions.heart,
          rocket: issue.reactions.rocket,
          eyes: issue.reactions.eyes
        },
        url: issue.html_url,
        apiUrl: issue.url
      };
    } catch (error) {
      this.logger.log('error', 'Failed to fetch issue context', { 
        error: error.message,
        issueNumber 
      });
      throw error;
    }
  }

  /**
   * Get environment context
   */
  getEnvironmentContext() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      githubActions: process.env.GITHUB_ACTIONS === 'true',
      ci: process.env.CI === 'true',
      debug: process.env.RUNNER_DEBUG === '1',
      workspace: process.env.GITHUB_WORKSPACE,
      eventName: process.env.GITHUB_EVENT_NAME
    };
  }

  /**
   * Get workflow context (GitHub Actions specific)
   */
  getWorkflowContext() {
    return {
      runId: process.env.GITHUB_RUN_ID,
      runNumber: process.env.GITHUB_RUN_NUMBER,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      workflow: process.env.GITHUB_WORKFLOW,
      job: process.env.GITHUB_JOB,
      action: process.env.GITHUB_ACTION,
      actor: process.env.GITHUB_ACTOR,
      triggeredBy: process.env.GITHUB_TRIGGERING_ACTOR,
      eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF,
      refName: process.env.GITHUB_REF_NAME,
      refType: process.env.GITHUB_REF_TYPE,
      sha: process.env.GITHUB_SHA,
      repository: process.env.GITHUB_REPOSITORY,
      serverUrl: process.env.GITHUB_SERVER_URL,
      apiUrl: process.env.GITHUB_API_URL,
      graphqlUrl: process.env.GITHUB_GRAPHQL_URL
    };
  }

  /**
   * Summarize check run status
   */
  summarizeCheckStatus(checkRuns) {
    if (!checkRuns || checkRuns.length === 0) {
      return 'no_checks';
    }
    
    const hasFailure = checkRuns.some(c => c.conclusion === 'failure');
    const hasPending = checkRuns.some(c => c.status === 'in_progress' || c.status === 'queued');
    const allSuccess = checkRuns.every(c => c.conclusion === 'success' || c.conclusion === 'neutral');
    
    if (hasFailure) return 'failure';
    if (hasPending) return 'pending';
    if (allSuccess) return 'success';
    return 'mixed';
  }

  /**
   * Build prompt-specific context
   */
  async buildPromptContext(command, context) {
    const promptContext = {
      command: command,
      expert: command.expert,
      options: command.options,
      prompt: command.prompt,
      timestamp: new Date().toISOString()
    };
    
    // Add repository files context if needed
    if (command.options.includeFiles) {
      promptContext.files = await this.getRelevantFiles(context, command.options.filePattern);
    }
    
    // Add recent activity if requested
    if (command.options.includeActivity) {
      promptContext.recentActivity = await this.getRecentActivity(context);
    }
    
    // Add dependencies if analyzing code
    if (command.expert === 'programming' || command.expert === 'code-reviewer') {
      promptContext.dependencies = await this.getDependencies();
    }
    
    return promptContext;
  }

  /**
   * Get relevant files based on pattern
   */
  async getRelevantFiles(context, pattern = '**/*.{js,ts,py,java,go}') {
    const files = [];
    
    try {
      // This is a simplified version - in production, use a proper glob library
      const { data: tree } = await this.octokit.git.getTree({
        owner: context.repository.owner,
        repo: context.repository.name,
        tree_sha: context.pr?.branch?.headSha || context.repository.defaultBranch,
        recursive: true
      });
      
      // Filter files by pattern (simplified)
      const relevantFiles = tree.tree.filter(item => {
        if (item.type !== 'blob') return false;
        
        // Simple pattern matching (enhance with proper glob matching)
        if (pattern.includes('*.js') && item.path.endsWith('.js')) return true;
        if (pattern.includes('*.ts') && item.path.endsWith('.ts')) return true;
        if (pattern.includes('*.py') && item.path.endsWith('.py')) return true;
        
        return false;
      }).slice(0, 20);  // Limit to 20 files
      
      for (const file of relevantFiles) {
        files.push({
          path: file.path,
          size: file.size,
          sha: file.sha
        });
      }
    } catch (error) {
      this.logger.log('warn', 'Failed to fetch file tree', { error: error.message });
    }
    
    return files;
  }

  /**
   * Get recent repository activity
   */
  async getRecentActivity(context) {
    const activity = {
      commits: [],
      issues: [],
      prs: []
    };
    
    try {
      // Recent commits
      const { data: commits } = await this.octokit.repos.listCommits({
        owner: context.repository.owner,
        repo: context.repository.name,
        per_page: 10
      });
      
      activity.commits = commits.map(c => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author.name,
        date: c.commit.author.date
      }));
      
      // Recent issues
      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: context.repository.owner,
        repo: context.repository.name,
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 5
      });
      
      activity.issues = issues.filter(i => !i.pull_request).map(i => ({
        number: i.number,
        title: i.title,
        author: i.user.login,
        createdAt: i.created_at,
        labels: i.labels.map(l => l.name)
      }));
      
      // Recent PRs
      const { data: prs } = await this.octokit.pulls.list({
        owner: context.repository.owner,
        repo: context.repository.name,
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 5
      });
      
      activity.prs = prs.map(pr => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        createdAt: pr.created_at,
        draft: pr.draft
      }));
    } catch (error) {
      this.logger.log('warn', 'Failed to fetch recent activity', { error: error.message });
    }
    
    return activity;
  }

  /**
   * Get project dependencies
   */
  async getDependencies() {
    const dependencies = {
      languages: [],
      frameworks: [],
      packages: {}
    };
    
    try {
      // Check for package.json
      try {
        const packageJson = await fs.readFile('package.json', 'utf8');
        const pkg = JSON.parse(packageJson);
        
        dependencies.languages.push('javascript');
        dependencies.packages.npm = {
          dependencies: Object.keys(pkg.dependencies || {}),
          devDependencies: Object.keys(pkg.devDependencies || {})
        };
        
        // Detect frameworks
        const deps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
        if (deps.includes('react')) dependencies.frameworks.push('react');
        if (deps.includes('vue')) dependencies.frameworks.push('vue');
        if (deps.includes('express')) dependencies.frameworks.push('express');
        if (deps.includes('jest')) dependencies.frameworks.push('jest');
      } catch (e) {
        // No package.json
      }
      
      // Check for requirements.txt
      try {
        const requirements = await fs.readFile('requirements.txt', 'utf8');
        dependencies.languages.push('python');
        dependencies.packages.pip = requirements.split('\n').filter(l => l && !l.startsWith('#'));
      } catch (e) {
        // No requirements.txt
      }
      
      // Check for go.mod
      try {
        const goMod = await fs.readFile('go.mod', 'utf8');
        dependencies.languages.push('go');
        dependencies.packages.go = goMod.split('\n')
          .filter(l => l.trim().startsWith('require'))
          .map(l => l.trim().split(' ')[1]);
      } catch (e) {
        // No go.mod
      }
    } catch (error) {
      this.logger.log('debug', 'Failed to detect dependencies', { error: error.message });
    }
    
    return dependencies;
  }
}

module.exports = { ContextBuilder };