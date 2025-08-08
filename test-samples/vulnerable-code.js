// Sample code with various issues for testing
const express = require('express');
const app = express();

// Hardcoded credentials (security issue)
const API_KEY = 'sk-12345-secret-key';
const DB_PASSWORD = 'admin123';

// SQL injection vulnerability
app.get('/user/:id', (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  db.query(query, (err, result) => {
    res.json(result);
  });
});

// No input validation
app.post('/transfer', (req, res) => {
  const amount = req.body.amount;
  const to = req.body.to;
  
  // Direct transfer without validation
  transferMoney(amount, to);
  res.send('Transfer complete');
});

// Weak password hashing
function hashPassword(password) {
  return Buffer.from(password).toString('base64');
}

module.exports = app;