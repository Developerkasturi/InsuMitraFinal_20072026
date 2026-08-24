const fs = require('fs');
const path = require('path');

const files = [
  { name: 'Contacts', path: '../../Frontend/src/pages/Contacts/index.tsx', schemaName: 'contactFormSchema' },
  { name: 'Leads', path: '../../Frontend/src/pages/Leads/index.tsx', schemaName: 'leadFormSchema' },
  { name: 'Policies', path: '../../Frontend/src/pages/Policies/index.tsx', schemaName: 'policyFormSchema' },
  { name: 'Claims', path: '../../Frontend/src/pages/Claims/index.tsx', schemaName: 'claimFormSchema' }
];

files.forEach(f => {
  const filepath = path.resolve(__dirname, f.path);
  if (!fs.existsSync(filepath)) {
    console.log(`[Error] File not found: ${filepath}`);
    return;
  }
  let content = fs.readFileSync(filepath, 'utf8');

  // Search for the schema declaration
  const regex = /const schema = z\.object\(\{/;
  if (regex.test(content)) {
    console.log(`[Found] 'const schema = z.object({' in ${f.name}`);
    content = content.replace(regex, `export const ${f.schemaName} = z.object({`);
    
    // Also check if schema needs to be declared as const schema = schemaName
    if (!content.includes(`const schema = ${f.schemaName};`)) {
      content = content.replace(`export const ${f.schemaName} = z.object({`, `export const ${f.schemaName} = z.object({\n  // System fields mapping`);
      // We will define it right below the closing block of schema
      // To find the closing block, let's find the closing }); for the schema definition.
      // Or we can just insert `const schema = schemaName;` right after type Form or interface definition.
    }
    
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`[Updated] ${f.name} schema exported.`);
  } else {
    console.log(`[Not Found] 'const schema = z.object({' in ${f.name}`);
  }
});
