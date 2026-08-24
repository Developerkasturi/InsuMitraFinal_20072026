const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Insurance/SettingsPanel.tsx');
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

console.log("=== Subtab switches/rendering inside SettingsPanel.tsx ===");
lines.forEach((line, idx) => {
  if (line.includes('activeTab ===') || line.includes('activeTab === \'') || line.includes('audit') || line.includes('employee_access') || line.includes('backup')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
