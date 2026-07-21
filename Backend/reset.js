const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'employee@demo-agency.com' } });
  console.log('Employee found:', !!user);
  if (user) {
    console.log('Role:', user.role);
    console.log('IsActive:', user.isActive);
    const hash = await bcrypt.hash('Employee@1234!', 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash }
    });
    console.log('Password reset successfully to Employee@1234!');
  }
}
main().finally(() => prisma.$disconnect());
