const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Policies/index.tsx');

if (!fs.existsSync(filepath)) {
  console.error("Policies file does not exist: " + filepath);
  process.exit(1);
}

let content = fs.readFileSync(filepath, 'utf8');

// We will find and remove type Form and type EditForm that are defined before their schemas
const lines = content.split(/\r?\n/);

let removedForm = false;
let removedEditForm = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line === 'type Form = z.infer<typeof schema>;' && i < 150) {
    lines[i] = ''; // remove
    removedForm = true;
    console.log(`Removed duplicate type Form at line ${i+1}`);
  }
  if (line === 'type EditForm = z.infer<typeof editSchema>;' && i < 250) {
    lines[i] = ''; // remove
    removedEditForm = true;
    console.log(`Removed duplicate type EditForm at line ${i+1}`);
  }
}

fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
console.log("Success cleaning up old types in Policies index.tsx!");
