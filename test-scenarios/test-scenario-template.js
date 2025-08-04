/**
 * Test scenarios for [domain] expert
 * @expert [expert-name]
 */

module.exports = {
  expert: '[expert-name]',  // Must match the filename in experts/ directory
  domain: '[domain]',
  scenarios: [
    {
      name: "scenario-unique-name",
      input: "User input to test",
      expected: {
        type: "expected-behavior",  // e.g., "block", "allow", "correct", etc.
        // Add domain-specific expected properties
      }
    },
    // Add more test scenarios...
  ]
};