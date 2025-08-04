/**
 * Test scenarios for data analysis expert
 * @expert data-analysis-expert
 */

module.exports = {
  expert: 'data-analysis-expert',
  domain: 'data-analysis',
  scenarios: [
    {
      name: "sales-trend-analysis",
      input: "Analyze monthly sales data to identify trends and forecast next quarter's performance",
      expected: {
        type: "analysis",
        features: ["statistical analysis", "trend identification", "forecasting", "visualization"]
      }
    },
    {
      name: "customer-segmentation",
      input: "Segment customers based on purchase behavior and demographics for targeted marketing",
      expected: {
        type: "analysis",
        features: ["clustering", "behavioral analysis", "demographic insights", "actionable recommendations"]
      }
    },
    {
      name: "data-visualization-request",
      input: "Create visualizations to show the relationship between marketing spend and customer acquisition",
      expected: {
        type: "visualization",
        features: ["chart recommendations", "correlation analysis", "tool suggestions", "design guidance"]
      }
    },
    {
      name: "sql-query-optimization",
      input: "Write a SQL query to find the top 10 products by revenue in each region for the last 6 months",
      expected: {
        type: "sql",
        features: ["SELECT statement", "GROUP BY", "ORDER BY", "date filtering"]
      }
    },
    {
      name: "data-cleaning-process",
      input: "Clean a dataset with missing values, duplicates, and inconsistent formatting before analysis",
      expected: {
        type: "processing",
        features: ["data quality assessment", "cleaning steps", "validation methods", "tool recommendations"]
      }
    },
    {
      name: "statistical-significance-test",
      input: "Determine if the difference in conversion rates between two marketing campaigns is statistically significant",
      expected: {
        type: "analysis",
        features: ["hypothesis testing", "p-values", "confidence intervals", "statistical interpretation"]
      }
    },
    {
      name: "dashboard-requirements",
      input: "Design a dashboard for executives to monitor key business metrics and performance indicators",
      expected: {
        type: "visualization",
        features: ["KPI identification", "layout design", "interactivity suggestions", "update frequency"]
      }
    },
    {
      name: "predictive-modeling",
      input: "Build a model to predict customer churn based on usage patterns and support interactions",
      expected: {
        type: "analysis",
        features: ["feature selection", "model recommendations", "validation approach", "performance metrics"]
      }
    },
    {
      name: "time-series-analysis",
      input: "Analyze website traffic patterns over the past year to identify seasonal trends and anomalies",
      expected: {
        type: "analysis",
        features: ["trend analysis", "seasonality detection", "anomaly identification", "forecasting"]
      }
    },
    {
      name: "ab-test-analysis",
      input: "Analyze A/B test results for a new feature to determine statistical significance and business impact",
      expected: {
        type: "analysis",
        features: ["statistical testing", "effect size", "practical significance", "recommendation"]
      }
    }
  ]
};