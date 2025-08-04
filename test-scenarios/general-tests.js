/**
 * Test scenarios for general purpose expert
 * @expert general-expert
 */

module.exports = {
  expert: 'general-expert',
  domain: 'general',
  scenarios: [
    {
      name: "how-to-explanation",
      input: "How do I write a professional email?",
      expected: {
        type: "instruction",
        features: ["step-by-step", "examples", "clear structure", "actionable advice"]
      }
    },
    {
      name: "concept-explanation",
      input: "What is artificial intelligence and how does it work?",
      expected: {
        type: "explanation",
        features: ["clear definition", "reasoning", "examples", "comprehensive coverage"]
      }
    },
    {
      name: "problem-solving",
      input: "I'm having trouble staying motivated while working from home. What can I do?",
      expected: {
        type: "instruction",
        features: ["actionable suggestions", "understanding of problem", "multiple solutions", "practical advice"]
      }
    },
    {
      name: "creative-writing",
      input: "Write a short story about a time traveler who gets stuck in the past",
      expected: {
        type: "creative",
        features: ["narrative structure", "character development", "creativity", "engaging content"]
      }
    },
    {
      name: "comparison-analysis",
      input: "Compare the advantages and disadvantages of electric cars vs gasoline cars",
      expected: {
        type: "analysis",
        features: ["balanced comparison", "multiple factors", "structured format", "objective analysis"]
      }
    },
    {
      name: "research-summary",
      input: "Summarize the main causes of climate change",
      expected: {
        type: "explanation",
        features: ["factual accuracy", "clear organization", "comprehensive coverage", "scientific reasoning"]
      }
    },
    {
      name: "decision-making",
      input: "Should I pursue a master's degree or start working immediately after college?",
      expected: {
        type: "analysis",
        features: ["pros and cons", "considerations", "personalized factors", "balanced perspective"]
      }
    },
    {
      name: "technical-explanation",
      input: "Explain how the internet works in simple terms",
      expected: {
        type: "explanation",
        features: ["simplified concepts", "analogies", "step-by-step process", "accessible language"]
      }
    },
    {
      name: "planning-advice",
      input: "How should I plan a two-week vacation to Europe?",
      expected: {
        type: "instruction",
        features: ["systematic approach", "multiple considerations", "practical steps", "helpful tips"]
      }
    },
    {
      name: "troubleshooting",
      input: "My computer is running slowly. What could be causing this and how can I fix it?",
      expected: {
        type: "instruction",
        features: ["diagnostic approach", "multiple causes", "step-by-step solutions", "troubleshooting logic"]
      }
    },
    {
      name: "philosophical-question",
      input: "What is the meaning of life?",
      expected: {
        type: "analysis",
        features: ["multiple perspectives", "thoughtful reasoning", "philosophical depth", "balanced approach"]
      }
    },
    {
      name: "health-wellness",
      input: "What are some effective ways to reduce stress in daily life?",
      expected: {
        type: "instruction",
        features: ["practical strategies", "variety of options", "actionable advice", "health awareness"]
      }
    }
  ]
};