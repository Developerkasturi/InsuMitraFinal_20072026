
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const policies = await prisma.policy.findMany({
    where: { paymentFrequency: { notIn: ['SINGLE', 'Full Payment'] } },
    include: { payments: true },
    take: 3
  });
  console.log(JSON.stringify(policies, null, 2));
}
check().catch(console.error).finally(() => prisma.());

