const { spawnSync } = require('child_process');
const fs = require('fs');

const source = fs.readFileSync('server.js', 'utf8');

if (/\binsertedCategory\b/i.test(source)) {
  console.error('Invalid server source: found forbidden identifier "insertedCategory" in server.js');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--check', 'server.js'], {
  stdio: 'inherit'
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('Runtime validation passed.');
