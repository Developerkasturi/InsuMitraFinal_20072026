const fs = require('fs');
const path = require('path');

const files = [
  { name: 'Contacts', path: '../../Frontend/src/pages/Contacts/index.tsx' },
  { name: 'Leads', path: '../../Frontend/src/pages/Leads/index.tsx' },
  { name: 'Policies', path: '../../Frontend/src/pages/Policies/index.tsx' },
  { name: 'Claims', path: '../../Frontend/src/pages/Claims/index.tsx' }
];

files.forEach(f => {
  const filepath = path.resolve(__dirname, f.path);
  if (!fs.existsSync(filepath)) {
    console.log(`${f.name} does not exist at ${filepath}`);
    return;
  }
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  console.log(`=== ${f.name} ===`);
  lines.forEach((line, idx) => {
    if (line.includes('zodResolver') || line.includes('const schema =') || line.includes('const editSchema =')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
});
