// Sample code for context
function processUserData(users) {
  const results = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].age > 18) {
      results.push({
        name: users[i].name,
        status: 'active'
      });
    }
  }
  return results;
}

module.exports = { processUserData };