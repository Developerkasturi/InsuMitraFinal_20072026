import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing demo data (Leads, Customers/Contacts, Policies, Claims, Tasks, and Events)...');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo-agency' },
  });

  if (!tenant) {
    console.error('Demo tenant "demo-agency" not found.');
    return;
  }
  const tenantId = tenant.id;
  console.log(`Using Tenant ID: ${tenantId}`);

  // Delete dependent models first to avoid foreign key / reference constraints
  console.log('Deleting policy relations...');
  await prisma.commission.deleteMany({ where: { tenantId } });
  await prisma.policyLoan.deleteMany({
    where: {
      policy: { tenantId },
    },
  });
  await prisma.policyPayment.deleteMany({
    where: {
      policy: { tenantId },
    },
  });
  await prisma.policyMember.deleteMany({
    where: {
      policy: { tenantId },
    },
  });
  await prisma.policyNominee.deleteMany({
    where: {
      policy: { tenantId },
    },
  });
  await prisma.preventiveHealthCheckup.deleteMany({
    where: {
      policy: { tenantId },
    },
  });

  console.log('Deleting claim expenses...');
  await prisma.claimExpense.deleteMany({
    where: {
      claim: { tenantId },
    },
  });

  console.log('Deleting documents...');
  await prisma.document.deleteMany({ where: { tenantId } });

  console.log('Deleting claims...');
  await prisma.claim.deleteMany({ where: { tenantId } });

  console.log('Deleting policies...');
  await prisma.policy.deleteMany({ where: { tenantId } });

  console.log('Deleting lead relations...');
  await prisma.productInterestConsultation.deleteMany({
    where: {
      productInterest: { tenantId },
    },
  });
  await prisma.productInterest.deleteMany({ where: { tenantId } });

  console.log('Deleting contact relations...');
  await prisma.contactRelationship.deleteMany({
    where: {
      OR: [
        { primaryContact: { tenantId } },
        { relatedContact: { tenantId } },
      ],
    },
  });
  await prisma.address.deleteMany({
    where: {
      contact: { tenantId },
    },
  });
  await prisma.occupation.deleteMany({
    where: {
      contact: { tenantId },
    },
  });

  console.log('Deleting contacts...');
  const { count: deletedContacts } = await prisma.contact.deleteMany({ where: { tenantId } });

  console.log('Deleting tasks, events, and whatsapp logs...');
  await prisma.employeeTask.deleteMany({ where: { tenantId } });
  await prisma.calendarEvent.deleteMany({ where: { tenantId } });
  await prisma.whatsappLog.deleteMany({
    where: {
      campaign: { tenantId },
    },
  });
  await prisma.whatsappCampaign.deleteMany({ where: { tenantId } });

  console.log(`✅ Demo data cleared successfully. Deleted ${deletedContacts} contacts and related entities.`);
}

main()
  .catch((err) => {
    console.error('Error clearing data:', err);
  })
  .finally(() => {
    prisma.$disconnect();
  });
