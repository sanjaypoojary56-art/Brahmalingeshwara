const fs = require('fs');

const serverPath = 'server.js';
const source = fs.readFileSync(serverPath, 'utf8');

const insertedCategoryMatches = source.match(/\bconst\s+insertedCategory\b/g) || [];

if (insertedCategoryMatches.length > 1) {
  console.error(
    `Invalid server source: found ${insertedCategoryMatches.length} declarations of insertedCategory in ${serverPath}.`
  );
  process.exit(1);
}

console.log('Runtime validation passed.');
