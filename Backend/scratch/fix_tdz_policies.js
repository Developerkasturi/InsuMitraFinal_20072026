const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Policies/index.tsx');

if (!fs.existsSync(filepath)) {
  console.error("Policies file does not exist: " + filepath);
  process.exit(1);
}

let content = fs.readFileSync(filepath, 'utf8');

// 1. Remove the misplaced assignments at the top
const badAssignments = `const schema = policyFormSchema;\nconst editSchema = policyEditFormSchema;`;
if (content.includes(badAssignments)) {
  content = content.replace(badAssignments, '');
  console.log("Removed bad assignments from top.");
} else {
  // Let's also check single lines
  content = content.replace("const schema = policyFormSchema;", "");
  content = content.replace("const editSchema = policyEditFormSchema;", "");
}

// 2. We will place the assignments right before type Form definition
// Let's find "type Form = z.infer<typeof schema>;"
const typeFormLine = `type Form = z.infer<typeof schema>;`;

// We want to insert the assignments right before type Form, but wait!
// Is type Form declared before the schema definitions?
// Yes! Line 95 is: type Form = z.infer<typeof schema>;
// If type Form is at Line 95, and we insert const schema = policyFormSchema there,
// it will still be before policyFormSchema is declared!
// Ah! That is correct! type Form must also be declared after the schemas!
// Let's move:
// - const schema = policyFormSchema;
// - const editSchema = policyEditFormSchema;
// - type Form = z.infer<typeof schema>;
// to the end of the schema definitions!
// Where do the schema definitions end?
// policyEditFormSchema ends around lines 190-200.
// Let's find the closing "});" of policyEditFormSchema.
// Let's write a regex that matches the declaration of policyEditFormSchema and its closing block.
// Or we can just find:
// "const watchEditEmiCase = watchEdit('emiCase');"
// or "export default function Policies("
// and place the assignments right before "export default function Policies("!
// That is guaranteed to be after all schema definitions!
// Let's find: "export default function Policies(" in the file.

const componentDecl = `export default function Policies(`;
if (content.includes(componentDecl)) {
  const insertText = `const schema = policyFormSchema;\nconst editSchema = policyEditFormSchema;\ntype Form = z.infer<typeof schema>;\ntype EditForm = z.infer<typeof editSchema>;\n\n`;
  content = content.replace(componentDecl, insertText + componentDecl);
  console.log("Moved schema, editSchema, and Form type declarations right before the component declaration.");
} else {
  console.error("Component declaration not found!");
  process.exit(1);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log("Successfully fixed Policies index.tsx TDZ error!");
