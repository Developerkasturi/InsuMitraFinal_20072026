import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating nextDueDate...');
  await prisma.policy.updateMany({
    where: { policyNumber: 'LIC' },
    data: { nextDueDate: new Date('2026-07-15') }
  });
  await prisma.policy.updateMany({
    where: { policyNumber: 'POL-AUDIT-101' },
    data: { nextDueDate: new Date('2026-09-15') }
  });
  console.log('Update complete.');
}

main().finally(() => prisma.$disconnect());
