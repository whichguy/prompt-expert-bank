// Adapter to make legacy experts compatible with new architecture
class LegacyExpertAdapter {
  constructor(legacyExpert) {
    this.legacyExpert = legacyExpert;
    this.name = legacyExpert.name;
    this.domain = legacyExpert.domain;
    this.description = legacyExpert.description;
  }
  
  async evaluatePrompts(oldPrompt, newPrompt, anthropic) {
    // Use the legacy expert's evaluate method directly
    return await this.legacyExpert.evaluatePrompts(oldPrompt, newPrompt, anthropic);
  }
}

module.exports = LegacyExpertAdapter;