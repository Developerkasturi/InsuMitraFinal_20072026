import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DATABASE VERIFICATION START ---');

  const usersCount = await prisma.user.count();
  const tenantsCount = await prisma.tenant.count();
  const contactsCount = await prisma.contact.count();
  const plansCount = await prisma.insurancePlan.count();
  const policiesCount = await prisma.policy.count();
  const paymentsCount = await prisma.policyPayment.count();
  const loansCount = await prisma.policyLoan.count();
  const commissionsCount = await prisma.commission.count();

  console.log(`Tenants: ${tenantsCount}`);
  console.log(`Users: ${usersCount}`);
  console.log(`Contacts: ${contactsCount}`);
  console.log(`Insurance Plans: ${plansCount}`);
  console.log(`Policies: ${policiesCount}`);
  console.log(`Payments: ${paymentsCount}`);
  console.log(`Loans: ${loansCount}`);
  console.log(`Commissions: ${commissionsCount}`);

  // Fetch some sample policies
  const samplePolicies = await prisma.policy.findMany({
    include: {
      contact: true,
      plan: { include: { company: true } },
      assignedEmployee: { include: { employeeProfile: true } },
      payments: true,
      loans: true,
      commissions: true,
    },
    take: 5
  });

  for (const p of samplePolicies) {
    console.log(`\nPolicy #: ${p.policyNumber}`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Client: ${p.contact?.firstName} ${p.contact?.lastName}`);
    console.log(`  Plan: ${p.plan?.name} (${p.plan?.company?.name})`);
    console.log(`  Assignee: ${p.assignedEmployee?.employeeProfile?.firstName} ${p.assignedEmployee?.employeeProfile?.lastName}`);
    console.log(`  Payments count: ${p.payments.length}`);
    console.log(`  Loans count: ${p.loans.length}`);
    console.log(`  Commissions count: ${p.commissions.length}`);
    if (p.payments.length > 0) {
      console.log(`  Sample Payments (first 3):`, p.payments.slice(0, 3).map(pay => ({
        id: pay.id,
        amount: pay.amount,
        dueDate: pay.dueDate,
        isPaid: (pay as any).isPaid,
        paidDate: (pay as any).paidDate
      })));
    }
    if (p.loans.length > 0) {
      console.log(`  Sample Loans:`, p.loans);
    }
    if (p.commissions.length > 0) {
      console.log(`  Sample Commissions:`, p.commissions);
    }
  }

  console.log('--- DATABASE VERIFICATION END ---');
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
