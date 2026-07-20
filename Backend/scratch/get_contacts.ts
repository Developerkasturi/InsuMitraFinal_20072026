import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.contact.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      tags: true,
      productInterests: {
        select: {
          id: true,
          interests: true,
          stage: true
        }
      }
    }
  });
  console.log('CONTACTS IN DB:', JSON.stringify(contacts, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
