const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get John's user record
  const john = await prisma.user.findFirst({
    where: { email: 'john.doe@example.com' },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  if (!john) {
    console.log('❌ User john.doe@example.com not found');
    return;
  }

  console.log('\n=== User: john.doe@example.com ===');
  console.log(JSON.stringify(john, null, 2));

  // Get ALL daily log records for John (raw, every field)
  const logs = await prisma.employeeDailyLog.findMany({
    where: { userId: john.id },
    orderBy: { logDate: 'desc' },
  });

  console.log('\n=== All employee_daily_logs for John (all fields) ===');
  if (logs.length === 0) {
    console.log('  No records found');
  } else {
    logs.forEach((log, i) => {
      console.log(`\n--- Log [${i + 1}] ---`);
      console.log(JSON.stringify(log, null, 2));
    });
  }

  // Check the Prisma schema fields available on EmployeeDailyLog
  // by looking at what keys exist on the first record
  if (logs.length > 0) {
    console.log('\n=== Field names on EmployeeDailyLog ===');
    console.log(Object.keys(logs[0]));
  }

  // Check seed files
  console.log('\n=== Checking seed directory ===');
  const fs = require('fs');
  const path = require('path');
  const seedDir = path.join(__dirname, 'prisma');
  if (fs.existsSync(seedDir)) {
    const files = fs.readdirSync(seedDir);
    console.log('Files in prisma/:', files);
    // Look for seed file content mentioning john.doe
    files.forEach(f => {
      const fullPath = path.join(seedDir, f);
      if (fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('john.doe') || content.includes('dailyLog') || content.includes('checkIn')) {
          console.log(`\n✅ "${f}" contains relevant seed data:`);
          // Print lines containing john.doe or checkIn/dailyLog
          content.split('\n').forEach((line, idx) => {
            if (line.includes('john.doe') || line.includes('checkIn') || line.includes('logDate') || line.includes('dailyLog')) {
              console.log(`  Line ${idx + 1}: ${line.trim()}`);
            }
          });
        }
      }
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
