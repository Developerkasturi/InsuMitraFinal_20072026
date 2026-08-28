import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const allLeads = await prisma.productInterest.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, leadId: true, createdAt: true },
    });

    console.log(`Total leads in DB: ${allLeads.length}`);
    const unassigned = allLeads.filter(l => !l.leadId);
    console.log(`Unassigned leads count: ${unassigned.length}`);

    for (const lead of unassigned) {
      const counter = await prisma.counter.upsert({
        where: { id: 'lead_id_seq' },
        update: { seq: { increment: 1 } },
        create: { id: 'lead_id_seq', seq: 1 },
      });
      const nextId = `L${counter.seq}`;
      await prisma.productInterest.update({
        where: { id: lead.id },
        data: { leadId: nextId },
      });
      console.log(`Assigned ${nextId} to lead ${lead.id}`);
    }

    console.log('Backfill complete!');
  } catch (err) {
    console.error('Backfill error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
