import { PrismaClient, UserRole, PaymentMode, PolicyStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB POPULATE START ---');

  // Find tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo-agency' }
  });
  if (!tenant) {
    console.error('Demo tenant not found');
    return;
  }
  console.log(`Found Tenant ID: ${tenant.id}`);

  // Find users in tenant
  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    include: { employeeProfile: true }
  });
  console.log('Users found:', users.map(u => ({ id: u.id, email: u.email, role: u.role, name: u.employeeProfile?.firstName })));

  const employee = users.find(u => u.role === UserRole.EMPLOYEE) || users[0];
  if (!employee) {
    console.error('No users found to assign');
    return;
  }

  // Find policies
  const policies = await prisma.policy.findMany({
    where: { tenantId: tenant.id }
  });
  if (policies.length === 0) {
    console.error('No policies found in tenant');
    return;
  }

  const policy = policies[0];
  console.log(`Selected policy for population: ${policy.policyNumber} (ID: ${policy.id})`);

  // Update policy to assign to employee
  await prisma.policy.update({
    where: { id: policy.id },
    data: {
      assignedEmployeeId: employee.id,
      status: PolicyStatus.ACTIVE
    }
  });
  console.log(`Updated policy to be assigned to user ${employee.id}`);

  // Create Commission Year if not exists
  let cy = await prisma.commissionYear.findFirst({
    where: { tenantId: tenant.id, year: 2026 }
  });
  if (!cy) {
    cy = await prisma.commissionYear.create({
      data: {
        tenantId: tenant.id,
        year: 2026,
        name: 'FY 2026-27',
        isActive: true
      }
    });
    console.log(`Created CommissionYear: ${cy.name} (ID: ${cy.id})`);
  } else {
    console.log(`Found existing CommissionYear: ${cy.name}`);
  }

  // Delete existing commissions and loans for clean state
  await prisma.commission.deleteMany({ where: { policyId: policy.id } });
  await prisma.policyLoan.deleteMany({ where: { policyId: policy.id } });

  // Create some commissions
  const comm1 = await prisma.commission.create({
    data: {
      tenantId: tenant.id,
      policyId: policy.id,
      commissionYearId: cy.id,
      beneficiaryId: employee.id,
      amount: 1500,
      rate: 12.5,
      isPaid: true,
      paidAt: new Date(),
      notes: 'First installment commission'
    }
  });
  const comm2 = await prisma.commission.create({
    data: {
      tenantId: tenant.id,
      policyId: policy.id,
      commissionYearId: cy.id,
      beneficiaryId: employee.id,
      amount: 1500,
      rate: 12.5,
      isPaid: false,
      notes: 'Second installment commission pending'
    }
  });
  console.log(`Created 2 commissions`);

  // Create a loan
  const loan = await prisma.policyLoan.create({
    data: {
      policyId: policy.id,
      loanAmount: 50000,
      interestRate: 8.5,
      disbursedDate: new Date('2026-01-15'),
      outstandingAmt: 35000,
      notes: 'Maturity linked policy loan'
    }
  });
  console.log(`Created loan with disbursed amount 50000`);

  // Let's populate some payments
  await prisma.policyPayment.deleteMany({ where: { policyId: policy.id } });
  
  // Let's create a list of payments
  const dates = [
    new Date('2026-06-01'),
    new Date('2026-07-01'),
    new Date('2026-08-01'),
    new Date('2026-09-01'),
    new Date('2026-10-01'),
    new Date('2026-11-01')
  ];

  for (let i = 0; i < dates.length; i++) {
    await prisma.policyPayment.create({
      data: {
        policyId: policy.id,
        amount: 5000,
        dueDate: dates[i],
        isPaid: i < 2, // First 2 paid
        paidDate: i < 2 ? dates[i] : null,
        mode: i < 2 ? PaymentMode.UPI : null,
        referenceNo: i < 2 ? `REF-${1000 + i}` : null
      }
    });
  }
  console.log(`Created 6 payments (2 paid, 4 unpaid)`);

  console.log('--- DB POPULATE END ---');
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
