// This file provides backward compatibility with the old expert system
// while using the new architecture under the hood

const ExpertLoader = require('../lib/expert-loader');
const expertLoader = new ExpertLoader();

// Export individual experts for backward compatibility
module.exports = {
  securityExpert: expertLoader.getExpert('security'),
  // Add more experts here as they are converted
  
  // Export the loader for new usage
  expertLoader: expertLoader,
  
  // Helper to get all experts
  getAllExperts: () => expertLoader.getAllExperts(),
  
  // Helper to detect applicable experts
  detectApplicableExperts: (files) => expertLoader.detectApplicableExperts(files)
};