// Deep check - find actual deletedAt values in contacts
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '6a31205bfcfb847be69f6651';

  // Check deletedAt distribution
  const contacts = await prisma.contact.findMany({
    where: { tenantId },
    select: { id: true, firstName: true, lastName: true, deletedAt: true, isActive: true },
    take: 10
  });

  console.log('\n=== CONTACTS deletedAt VALUES ===');
  contacts.forEach(c => {
    console.log(`  ${c.firstName} ${c.lastName} | deletedAt=${JSON.stringify(c.deletedAt)} | isActive=${c.isActive}`);
  });

  // Count with various filters
  const total = await prisma.contact.count({ where: { tenantId } });
  const deletedAtNull = await prisma.contact.count({ where: { tenantId, deletedAt: null } });
  const deletedAtNotNull = await prisma.contact.count({ where: { tenantId, NOT: { deletedAt: null } } });

  console.log(`\nTotal: ${total}`);
  console.log(`deletedAt IS null: ${deletedAtNull}`);
  console.log(`deletedAt IS NOT null: ${deletedAtNotNull}`);

  // Check policies
  const policies = await prisma.policy.findMany({
    where: { tenantId },
    select: { id: true, policyNumber: true, deletedAt: true },
    take: 5
  });
  console.log('\n=== POLICIES deletedAt VALUES ===');
  policies.forEach(p => console.log(`  ${p.policyNumber} | deletedAt=${JSON.stringify(p.deletedAt)}`));

  const polTotal = await prisma.policy.count({ where: { tenantId } });
  const polNullDeleted = await prisma.policy.count({ where: { tenantId, deletedAt: null } });
  console.log(`Policies: total=${polTotal}, deletedAt=null: ${polNullDeleted}`);

  // What contacts.repository.ts uses for listing — check if contacts list works without deletedAt filter
  const contactsNoFilter = await prisma.contact.findMany({
    where: { tenantId, OR: [
      { firstName: { contains: 'a', mode: 'insensitive' } },
      { lastName: { contains: 'a', mode: 'insensitive' } },
    ]},
    take: 5,
    select: { firstName: true, lastName: true, deletedAt: true }
  });
  console.log(`\nContacts matching "a" WITHOUT deletedAt filter: ${contactsNoFilter.length}`);
  contactsNoFilter.forEach(c => console.log(`  ${c.firstName} ${c.lastName} | deletedAt=${c.deletedAt}`));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
