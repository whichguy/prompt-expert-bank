const fs = require('fs');
const path = require('path');

class ExpertLoader {
  constructor() {
    this.experts = new Map();
    this.loadExperts();
  }
  
  loadExperts() {
    // Load all expert implementations from lib directory
    const libDir = __dirname;
    const files = fs.readdirSync(libDir);
    
    files.forEach(file => {
      if (file.endsWith('-expert.js') && file !== 'base-expert.js') {
        try {
          const ExpertClass = require(path.join(libDir, file));
          const expertInstance = new ExpertClass();
          
          // Register by domain
          this.experts.set(expertInstance.domain, expertInstance);
          
          console.log(`Loaded expert: ${expertInstance.name} (${expertInstance.domain})`);
        } catch (error) {
          console.error(`Failed to load expert from ${file}:`, error.message);
        }
      }
    });
  }
  
  getExpert(domain) {
    return this.experts.get(domain);
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
      
      // Security expert for security-related prompts
      if (filename.includes('security') || filename.includes('safety') ||
          content.includes('security') || content.includes('risk') || 
          content.includes('vulnerab')) {
        const securityExpert = this.experts.get('security');
        if (securityExpert && !applicableExperts.includes(securityExpert)) {
          applicableExperts.push(securityExpert);
        }
      }
      
      // Add more domain detection logic here as we add more experts
      // Financial expert for financial prompts
      if (filename.includes('financ') || filename.includes('trading') ||
          content.includes('financial') || content.includes('investment')) {
        const financialExpert = this.experts.get('financial');
        if (financialExpert && !applicableExperts.includes(financialExpert)) {
          applicableExperts.push(financialExpert);
        }
      }
      
      // Code quality expert for code generation prompts
      if (filename.includes('code') || filename.includes('developer') ||
          content.includes('code quality') || content.includes('programming')) {
        const codeExpert = this.experts.get('code-quality');
        if (codeExpert && !applicableExperts.includes(codeExpert)) {
          applicableExperts.push(codeExpert);
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