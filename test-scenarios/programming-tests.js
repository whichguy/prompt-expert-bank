/**
 * Test scenarios for programming and code review expert
 * @expert programming-expert
 */

module.exports = {
  expert: 'programming-expert',
  domain: 'programming',
  scenarios: [
    {
      name: "python-function-implementation",
      input: "Write a Python function to find the longest common subsequence between two strings",
      expected: {
        type: "implementation",
        features: ["python syntax", "algorithm implementation", "error handling", "documentation"]
      }
    },
    {
      name: "javascript-code-review",
      input: "Review this JavaScript code for potential issues: function getData() { var data = fetch('/api/data'); return data.json(); }",
      expected: {
        type: "review",
        features: ["async/await issues", "error handling", "best practices", "explanation"]
      }
    },
    {
      name: "java-class-design",
      input: "Design a Java class hierarchy for a vehicle management system with cars, trucks, and motorcycles",
      expected: {
        type: "architecture",
        features: ["OOP principles", "inheritance", "abstraction", "design patterns"]
      }
    },
    {
      name: "sql-query-optimization",
      input: "Optimize this SQL query: SELECT * FROM users WHERE created_at > '2023-01-01' ORDER BY name",
      expected: {
        type: "optimization",
        features: ["indexing", "performance", "best practices", "explanation"]
      }
    },
    {
      name: "debugging-memory-leak",
      input: "Help debug a memory leak in a Node.js application that processes large CSV files",
      expected: {
        type: "debugging",
        features: ["memory management", "profiling", "streaming", "testing approaches"]
      }
    },
    {
      name: "react-component-best-practices",
      input: "What are the best practices for creating reusable React components?",
      expected: {
        type: "review",
        features: ["component design", "props", "hooks", "performance", "testing"]
      }
    },
    {
      name: "api-security-review",
      input: "Review this REST API endpoint for security vulnerabilities: app.get('/user/:id', (req, res) => { const query = 'SELECT * FROM users WHERE id = ' + req.params.id; })",
      expected: {
        type: "review",
        features: ["SQL injection", "input validation", "parameterized queries", "security best practices"]
      }
    },
    {
      name: "algorithm-complexity",
      input: "Analyze the time and space complexity of a binary search algorithm",
      expected: {
        type: "optimization",
        features: ["Big O notation", "complexity analysis", "algorithm explanation", "trade-offs"]
      }
    },
    {
      name: "docker-containerization",
      input: "Create a Dockerfile for a Python web application with proper multi-stage builds",
      expected: {
        type: "implementation",
        features: ["dockerfile syntax", "multi-stage builds", "security", "optimization"]
      }
    },
    {
      name: "database-schema-design",
      input: "Design a database schema for an e-commerce platform with users, products, orders, and reviews",
      expected: {
        type: "architecture",
        features: ["normalization", "relationships", "indexing", "scalability"]
      }
    },
    {
      name: "unit-testing-strategy",
      input: "Explain how to write effective unit tests for a payment processing function",
      expected: {
        type: "review",
        features: ["test strategy", "mocking", "edge cases", "assertions", "test structure"]
      }
    },
    {
      name: "microservices-communication",
      input: "What are the best practices for communication between microservices?",
      expected: {
        type: "architecture",
        features: ["service communication", "API design", "error handling", "patterns"]
      }
    },
    {
      name: "performance-bottleneck",
      input: "Identify and fix performance bottlenecks in a web application's database queries",
      expected: {
        type: "optimization",
        features: ["query optimization", "indexing", "caching", "monitoring"]
      }
    },
    {
      name: "code-refactoring",
      input: "Refactor this legacy function to be more maintainable and testable: function processOrder(order) { /* 200 lines of mixed logic */ }",
      expected: {
        type: "review",
        features: ["single responsibility", "modularity", "testability", "clean code"]
      }
    },
    {
      name: "concurrent-programming",
      input: "Implement thread-safe concurrent processing of tasks in Java using modern concurrency utilities",
      expected: {
        type: "implementation",
        features: ["thread safety", "concurrent collections", "executors", "synchronization"]
      }
    }
  ]
};