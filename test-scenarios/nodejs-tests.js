/**
 * Test scenarios for Node.js coding expert
 * @expert nodejs-expert
 */

module.exports = {
  expert: 'nodejs-expert',
  domain: 'nodejs',
  scenarios: [
    {
      name: "simple-function-implementation",
      input: "Write a function that reads a JSON file and returns its contents as an object",
      expected: { 
        type: "implementation",
        features: ["fs operations", "error handling", "async/await or promises"]
      }
    },
    {
      name: "async-api-call",
      input: "Create an async function that fetches user data from https://api.example.com/users/123 and handles errors",
      expected: {
        type: "async",
        features: ["async/await", "fetch or axios", "error handling", "try/catch"]
      }
    },
    {
      name: "express-route-handler",
      input: "Write an Express route handler for POST /api/users that validates input and saves to database",
      expected: {
        type: "implementation",
        features: ["express syntax", "validation", "error handling", "status codes"]
      }
    },
    {
      name: "code-review-memory-leak",
      input: "Review this code and identify issues: let users = []; app.get('/users', (req, res) => { users.push(req.user); res.json(users); });",
      expected: {
        type: "review",
        issues: ["memory leak", "unbounded array growth", "no cleanup"]
      }
    },
    {
      name: "security-sql-injection",
      input: "Fix this code that has security issues: db.query(`SELECT * FROM users WHERE id = ${req.params.id}`)",
      expected: {
        type: "security",
        fixes: ["parameterized queries", "input validation", "SQL injection prevention"]
      }
    },
    {
      name: "performance-optimization",
      input: "Optimize this code: for(let i=0; i<arr.length; i++) { for(let j=0; j<arr.length; j++) { if(arr[i] === arr[j] && i !== j) duplicates.push(arr[i]); }}",
      expected: {
        type: "review",
        improvements: ["O(n²) to O(n)", "Set or Map usage", "algorithm explanation"]
      }
    },
    {
      name: "stream-processing",
      input: "Write code to process a large CSV file line by line without loading it all into memory",
      expected: {
        type: "implementation",
        features: ["streams", "readline or csv-parser", "memory efficiency", "error handling"]
      }
    },
    {
      name: "promise-error-handling",
      input: "Convert this callback-based code to use async/await with proper error handling: fs.readFile('data.txt', (err, data) => { if(err) throw err; console.log(data); })",
      expected: {
        type: "async",
        features: ["async/await", "try/catch", "fs.promises", "proper error handling"]
      }
    },
    {
      name: "middleware-implementation",
      input: "Create an Express middleware that logs request duration and adds it to response headers",
      expected: {
        type: "implementation",
        features: ["middleware pattern", "req/res/next", "timing logic", "header manipulation"]
      }
    },
    {
      name: "unit-test-creation",
      input: "Write unit tests for this function: function add(a, b) { if(typeof a !== 'number' || typeof b !== 'number') throw new Error('Invalid input'); return a + b; }",
      expected: {
        type: "implementation",
        features: ["test framework", "test cases", "edge cases", "error testing"]
      }
    }
  ]
};