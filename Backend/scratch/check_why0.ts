import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkWhy0() {
  const p1 = await prisma.policy.findFirst({ where: { policyNumber: 'ba004' } });
  console.log('p1:', p1);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const in45Days = new Date(startOfToday.getTime() + 45 * 24 * 60 * 60 * 1000);
  in45Days.setHours(23, 59, 59, 999);

  const p2 = await prisma.policy.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: startOfToday, lte: in45Days },
    },
  });
  console.log('p2 count:', p2.length);
}

checkWhy0().finally(() => prisma.$disconnect());
