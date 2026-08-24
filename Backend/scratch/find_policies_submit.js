const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Claims/index.tsx');
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

console.log("=== Claims onSubmit/handleSubmit lines ===");
lines.forEach((line, idx) => {
  if (line.includes('onSubmit') || line.includes('handleSubmit')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
