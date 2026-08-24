const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Policies/index.tsx');
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

console.log("=== Riders references in Policies/index.tsx ===");
lines.forEach((line, idx) => {
  if (line.includes('riders') || line.includes('addon') || line.includes('addOn')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
