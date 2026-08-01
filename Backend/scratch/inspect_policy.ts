import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectPolicy() {
  const pol = await prisma.policy.findFirst({
    where: { policyNumber: 'ba004' },
  });
  console.log('POLICY BA004:', JSON.stringify(pol, null, 2));
}

inspectPolicy().finally(() => prisma.$disconnect());
