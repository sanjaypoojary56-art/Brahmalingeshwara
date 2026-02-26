const { spawnSync } = require('child_process');
const fs = require('fs');

const serverPath = 'server.js';
const source = fs.readFileSync(serverPath, 'utf8');

if (/\binsertedCategory\b/.test(source)) {
  console.error(`Invalid server source: found forbidden identifier "insertedCategory" in ${serverPath}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--check', serverPath], {
  stdio: 'inherit'
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('Runtime validation passed.');
