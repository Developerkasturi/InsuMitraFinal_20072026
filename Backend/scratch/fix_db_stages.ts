import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration to fix malformed LeadStage values...');
  
  // We use $runCommandRaw because Prisma validation blocks stage: 'OPEN' at runtime
  const result = await prisma.$runCommandRaw({
    update: 'product_interests',
    updates: [
      {
        q: { stage: 'OPEN' },
        u: { $set: { stage: 'TO_CONTACT' } },
        multi: true
      }
    ]
  });

  console.log('Migration complete. Result:', JSON.stringify(result, null, 2));
}

main()
  .catch(err => {
    console.error('Error running migration:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
