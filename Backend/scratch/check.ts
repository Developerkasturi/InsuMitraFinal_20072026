import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching users from DB...');
  const users = await prisma.user.findMany({
    include: { tenant: true },
  });
  console.log('Users in DB:', JSON.stringify(users, null, 2));

  const superAdmins = await prisma.superAdmin.findMany();
  console.log('SuperAdmins in DB:', JSON.stringify(superAdmins, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
