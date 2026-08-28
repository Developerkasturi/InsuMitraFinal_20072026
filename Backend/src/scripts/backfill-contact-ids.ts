import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const allContacts = await prisma.contact.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, contactId: true, createdAt: true },
    });

    console.log(`Total contacts in DB: ${allContacts.length}`);
    const unassigned = allContacts.filter(c => !(c as any).contactId);
    console.log(`Unassigned contacts count: ${unassigned.length}`);

    for (const contact of unassigned) {
      const counter = await prisma.counter.upsert({
        where: { id: 'contact_id_seq' },
        update: { seq: { increment: 1 } },
        create: { id: 'contact_id_seq', seq: 1 },
      });
      const nextId = `C${counter.seq}`;
      await prisma.contact.update({
        where: { id: contact.id },
        data: { contactId: nextId } as any,
      });
      console.log(`Assigned ${nextId} to contact ${contact.id}`);
    }

    console.log('Contact ID backfill complete!');
  } catch (err) {
    console.error('Backfill error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
