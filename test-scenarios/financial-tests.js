/**
 * Test scenarios for financial analysis expert
 * @expert financial-expert
 */

module.exports = {
  expert: 'financial-expert',
  domain: 'financial',
  scenarios: [
    {
      name: "compound-interest-calculation",
      input: "Calculate the future value of $10,000 invested at 7% annual interest for 10 years with monthly compounding",
      expected: {
        type: "calculation",
        features: ["formula", "compound interest", "specific numbers"]
      }
    },
    {
      name: "retirement-planning",
      input: "I'm 35 years old with $50,000 saved. How much should I save monthly to retire at 65 with $2 million?",
      expected: {
        type: "advice",
        features: ["calculations", "time value", "retirement planning", "risk discussion"]
      }
    },
    {
      name: "investment-portfolio-advice",
      input: "Should I invest my $100,000 inheritance in stocks, bonds, or real estate?",
      expected: {
        type: "investment",
        features: ["diversification", "risk assessment", "asset allocation", "disclaimer"]
      }
    },
    {
      name: "mortgage-comparison",
      input: "Compare a 15-year mortgage at 6% vs a 30-year mortgage at 6.5% for a $300,000 home",
      expected: {
        type: "calculation",
        features: ["monthly payments", "total interest", "comparison table"]
      }
    },
    {
      name: "tax-optimization",
      input: "How can I reduce my tax burden if I make $150,000 per year?",
      expected: {
        type: "tax",
        features: ["tax strategies", "deductions", "retirement accounts", "disclaimer"]
      }
    },
    {
      name: "emergency-fund-advice",
      input: "How much should I have in my emergency fund if my monthly expenses are $4,000?",
      expected: {
        type: "advice",
        features: ["3-6 months rule", "risk factors", "liquidity discussion"]
      }
    },
    {
      name: "debt-payoff-strategy",
      input: "I have $5,000 on a credit card at 18% APR and a $20,000 student loan at 5%. Which should I pay off first?",
      expected: {
        type: "advice",
        features: ["interest rate comparison", "avalanche vs snowball", "calculations"]
      }
    },
    {
      name: "inflation-impact",
      input: "How will 3% annual inflation affect my purchasing power over 20 years?",
      expected: {
        type: "calculation",
        features: ["inflation formula", "real value calculation", "examples"]
      }
    },
    {
      name: "stock-valuation",
      input: "Is a stock with P/E ratio of 25 and 15% annual growth overvalued?",
      expected: {
        type: "investment",
        features: ["valuation metrics", "PEG ratio", "market context", "risk warning"]
      }
    },
    {
      name: "budget-creation",
      input: "Create a budget for someone making $5,000/month after taxes",
      expected: {
        type: "advice",
        features: ["50/30/20 rule", "categories", "savings allocation", "practical tips"]
      }
    }
  ]
};