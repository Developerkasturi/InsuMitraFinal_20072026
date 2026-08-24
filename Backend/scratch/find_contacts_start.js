const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Contacts/index.tsx');
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('export default function') || line.includes('function Contacts(')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
