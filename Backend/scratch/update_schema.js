const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../prisma/schema.prisma');

if (!fs.existsSync(filepath)) {
  console.error("Prisma schema file does not exist: " + filepath);
  process.exit(1);
}

let content = fs.readFileSync(filepath, 'utf8');

// 1. Add relation to model Tenant
const targetRelation = `  hospitals                 Hospital[]`;
const replacementRelation = `  hospitals                 Hospital[]\n  compulsoryFieldRules      CompulsoryFieldRule[]`;

if (content.includes(targetRelation)) {
  content = content.replace(targetRelation, replacementRelation);
  console.log("Added compulsoryFieldRules relation to Tenant model.");
} else {
  console.error("Could not find hospitals relation inside Tenant model!");
  process.exit(1);
}

// 2. Append CompulsoryFieldRule model to the end of the file
const modelString = `

model CompulsoryFieldRule {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @map("tenant_id") @db.ObjectId
  module    String   // "Contact" | "Lead" | "Policy" | "Claim"
  fieldKey  String   // e.g. "email"
  required  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, module, fieldKey])
  @@map("compulsory_field_rules")
}
`;

content = content.trim() + modelString;
fs.writeFileSync(filepath, content, 'utf8');
console.log("Successfully appended CompulsoryFieldRule model to schema.prisma!");
