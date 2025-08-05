const fs = require('fs');
const path = require('path');
const BaseExpert = require('./base-expert');

class ExpertLoader {
  constructor() {
    this.experts = new Map();
    this.loadExperts();
  }
  
  loadExperts() {
    // Load all expert definitions from the expert-definitions directory
    const expertsDir = path.join(__dirname, '..', 'expert-definitions');
    
    if (!fs.existsSync(expertsDir)) {
      throw new Error(`Expert definitions directory not found: ${expertsDir}`);
    }
    
    const expertFiles = fs.readdirSync(expertsDir)
      .filter(file => file.endsWith('.md') && !file.includes('enhanced'));
    
    expertFiles.forEach(file => {
      try {
        const expertPath = path.join(expertsDir, file);
        const domain = path.basename(file, '.md').replace('-expert', '');
        
        // Find corresponding test scenarios
        const testScenariosPath = path.join(__dirname, '..', 'test-scenarios', `${domain}-tests.json`);
        
        if (fs.existsSync(testScenariosPath)) {
          const expert = new BaseExpert(expertPath, testScenariosPath);
          this.experts.set(domain, expert);
          console.log(`Loaded expert: ${expert.name} (${expert.domain})`);
        } else {
          console.warn(`No test scenarios found for domain: ${domain}`);
        }
      } catch (error) {
        console.error(`Failed to load expert from ${file}:`, error.message);
      }
    });
  }
  
  getExpert(domain) {
    const expert = this.experts.get(domain);
    if (!expert) {
      throw new Error(`No expert found for domain: ${domain}. Available domains: ${this.getExpertDomains().join(', ')}`);
    }
    return expert;
  }
  
  getAllExperts() {
    return Array.from(this.experts.values());
  }
  
  getExpertDomains() {
    return Array.from(this.experts.keys());
  }
  
  async detectApplicableExperts(files) {
    const applicableExperts = [];
    
    // Check each file against expert domain patterns
    for (const file of files) {
      const content = file.content || '';
      const filename = file.filename || '';
      
      // Programming expert for code-related prompts
      if (filename.includes('code') || filename.includes('programming') || filename.includes('developer') ||
          content.includes('code') || content.includes('programming') || content.includes('function')) {
        const programmingExpert = this.experts.get('programming');
        if (programmingExpert && !applicableExperts.includes(programmingExpert)) {
          applicableExperts.push(programmingExpert);
        }
      }
      
      // Security expert for security-related prompts
      if (filename.includes('security') || filename.includes('safety') ||
          content.includes('security') || content.includes('risk') || 
          content.includes('vulnerab')) {
        const securityExpert = this.experts.get('security');
        if (securityExpert && !applicableExperts.includes(securityExpert)) {
          applicableExperts.push(securityExpert);
        }
      }
      
      // Financial expert for financial prompts
      if (filename.includes('financ') || filename.includes('trading') || filename.includes('investment') ||
          content.includes('financial') || content.includes('investment') || content.includes('budget')) {
        const financialExpert = this.experts.get('financial');
        if (financialExpert && !applicableExperts.includes(financialExpert)) {
          applicableExperts.push(financialExpert);
        }
      }
      
      // Data analysis expert for data-related prompts
      if (filename.includes('data') || filename.includes('analysis') || filename.includes('chart') ||
          content.includes('data') || content.includes('analysis') || content.includes('visualization')) {
        const dataExpert = this.experts.get('data-analysis');
        if (dataExpert && !applicableExperts.includes(dataExpert)) {
          applicableExperts.push(dataExpert);
        }
      }
    }
    
    // If no specific expert found, return general expert if available
    if (applicableExperts.length === 0) {
      const generalExpert = this.experts.get('general');
      if (generalExpert) {
        applicableExperts.push(generalExpert);
      }
    }
    
    return applicableExperts;
  }
}

module.exports = ExpertLoader;