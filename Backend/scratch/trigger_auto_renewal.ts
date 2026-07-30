import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function triggerAutoRenewalNow() {
  try {
    const contact = await prisma.contact.findFirst({
      where: {
        firstName: { contains: 'Kritika', mode: 'insensitive' },
      },
      include: {
        policies: true,
        productInterests: true,
      },
    });

    if (!contact) {
      console.log('Kritika not found');
      return;
    }

    const tenantId = contact.tenantId;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const in45Days = new Date();
    in45Days.setDate(startOfToday.getDate() + 45);
    in45Days.setHours(23, 59, 59, 999);

    console.log(`Checking policies for tenant: ${tenantId}`);
    const expiringPolicies = await prisma.policy.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        endDate: { gte: startOfToday, lte: in45Days },
      },
      include: { plan: { include: { company: true } } },
    });

    console.log(`Found ${expiringPolicies.length} expiring policies.`);

    const existingLeads = await prisma.productInterest.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, contactId: true, notes: true },
    });

    for (const pol of expiringPolicies) {
      const alreadyExists = existingLeads.some(l => {
        if (l.contactId !== pol.contactId) return false;
        if (!l.notes) return false;
        return l.notes.includes(pol.id) || l.notes.includes(pol.policyNumber);
      });

      console.log(`Policy #${pol.policyNumber} already has renewal lead: ${alreadyExists}`);

      if (!alreadyExists) {
        const category = pol.plan?.category || 'Health';
        const interestName = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
        const notesObj = {
          leadStatus: 'INTERESTED',
          leadType: 'RENEWAL',
          policyId: pol.id,
          policyNumber: pol.policyNumber,
          companyName: pol.plan?.company?.name || '',
          planName: pol.plan?.name || '',
          sumAssured: pol.sumAssured,
          premiumAmount: pol.premiumAmount,
          startDate: pol.startDate,
          endDate: pol.endDate,
          cleanNotes: `Auto-generated Renewal Lead for Policy #${pol.policyNumber}`,
        };

        const createdLead = await prisma.productInterest.create({
          data: {
            tenantId: pol.tenantId,
            contactId: pol.contactId,
            planId: pol.planId,
            assignedEmployeeId: pol.assignedEmployeeId,
            source: 'Renewal',
            stage: 'OPEN',
            interests: [interestName],
            premiumBudget: pol.premiumAmount,
            sumAssuredRequired: pol.sumAssured,
            notes: JSON.stringify(notesObj),
          },
        });

        console.log('CREATED RENEWAL LEAD FOR KRITIKA KHOT:', createdLead.id);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

triggerAutoRenewalNow();
