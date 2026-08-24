const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Contacts/index.tsx');
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

console.log("=== Labels inside Contacts/index.tsx ===");
lines.forEach((line, idx) => {
  if (line.includes('<label') && (line.includes('Name') || line.includes('Phone') || line.includes('Email') || line.includes('Gender') || line.includes('Birth') || line.includes('PAN') || line.includes('Aadhaar') || line.includes('Income') || line.includes('City') || line.includes('Source'))) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
