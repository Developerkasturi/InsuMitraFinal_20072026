const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Contacts/index.tsx');
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

console.log("=== Save/mutation references in Contacts/index.tsx ===");
lines.forEach((line, idx) => {
  if (line.includes('save') || line.includes('mutate') || line.includes('submit')) {
    if (line.trim().startsWith('const ') || line.trim().startsWith('async ') || line.includes('function')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
