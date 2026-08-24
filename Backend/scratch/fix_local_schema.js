const fs = require('fs');
const path = require('path');

const files = [
  { name: 'Contacts', path: '../../Frontend/src/pages/Contacts/index.tsx', schemaName: 'contactFormSchema' },
  { name: 'Leads', path: '../../Frontend/src/pages/Leads/index.tsx', schemaName: 'leadFormSchema' }
];

files.forEach(f => {
  const filepath = path.resolve(__dirname, f.path);
  if (!fs.existsSync(filepath)) {
    console.log(`File not found: ${filepath}`);
    return;
  }
  let content = fs.readFileSync(filepath, 'utf8');

  const target = `type Form = z.infer<typeof schema>;`;
  const replacement = `const schema = ${f.schemaName};\ntype Form = z.infer<typeof schema>;`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`[Success] Declared local schema in ${f.name}`);
  } else {
    console.log(`[Error] type Form target not found in ${f.name}`);
  }
});
