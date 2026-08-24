const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Insurance/index.tsx');
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

console.log("=== Agent state and form submissions inside Insurance/index.tsx ===");
lines.forEach((line, idx) => {
  if (line.includes('agentsList') || line.includes('agentForm') || line.includes('setAgentsList') || line.includes('handleSubmitAgent')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
