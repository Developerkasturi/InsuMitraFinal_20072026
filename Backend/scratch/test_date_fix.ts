import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDateFix() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const in45Days = new Date(startOfToday.getTime() + 45 * 24 * 60 * 60 * 1000);
  in45Days.setHours(23, 59, 59, 999);

  console.log('Start of today:', startOfToday.toISOString());
  console.log('In 45 days:', in45Days.toISOString());

  const expiringPolicies = await prisma.policy.findMany({
    where: {
      tenantId: '6a31205bfcfb847be69f6651',
      status: 'ACTIVE',
      deletedAt: null,
      endDate: { gte: startOfToday, lte: in45Days },
    },
    include: { plan: { include: { company: true } } },
  });

  console.log(`Found ${expiringPolicies.length} expiring policies!`);
  for (const pol of expiringPolicies) {
    console.log(`- Policy #${pol.policyNumber}, End Date: ${pol.endDate}`);
  }
}

testDateFix().finally(() => prisma.$disconnect());
