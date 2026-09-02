/// <reference types="node" />
import { PrismaClient, UserRole, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT   = 12;

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Subscription Plans ─────────────────────────────────────────────────
  // Spec plans: Free, Starter, Growth, Business
  // Note: "Enterprise" was previous alias for Business — kept for backward compat (inactive)

  // Free plan (0 ops — base tier)
  await prisma.subscriptionPlan.upsert({
    where:  { name: 'Free' },
    update: { maxUsers: 1, maxContacts: 100, isActive: true },
    create: {
      name:         'Free',
      priceMonthly: 0,
      priceYearly:  0,
      trialDays:    0,
      maxUsers:     1,
      maxContacts:  100,
      maxPolicies:  50,
      features:     { contacts: true, policies: true, claims: true, calendar: true, workspace: true },
      isActive:     true,
    },
  });

  const starter = await prisma.subscriptionPlan.upsert({
    where:  { name: 'Starter' },
    update: { priceMonthly: 999, priceYearly: 9990, maxUsers: 1, maxContacts: 400, maxPolicies: 200, isActive: true },
    create: {
      name:         'Starter',
      priceMonthly: 999,
      priceYearly:  9990,
      trialDays:    14,
      maxUsers:     1,
      maxContacts:  400,
      maxPolicies:  200,
      features:     { contacts: true, policies: true, claims: true, calendar: true, workspace: true, dashboard: true, leads: true, operations: true },
      isActive:     true,
    },
  });

  const growth = await prisma.subscriptionPlan.upsert({
    where:  { name: 'Growth' },
    update: { priceMonthly: 2499, priceYearly: 24990, maxUsers: 3, maxContacts: 600, maxPolicies: 1000, isActive: true },
    create: {
      name:         'Growth',
      priceMonthly: 2499,
      priceYearly:  24990,
      trialDays:    14,
      maxUsers:     3,
      maxContacts:  600,
      maxPolicies:  1000,
      features:     { contacts: true, policies: true, claims: true, calendar: true, workspace: true, dashboard: true, leads: true, operations: true, employees: true, commissions: true, branding: true },
      isActive:     true,
    },
  });

  // Business plan (spec name) — replaces "Enterprise"
  await prisma.subscriptionPlan.upsert({
    where:  { name: 'Business' },
    update: { priceMonthly: 7999, priceYearly: 79990, maxUsers: -1, maxContacts: -1, maxPolicies: -1, isActive: true },
    create: {
      name:         'Business',
      priceMonthly: 7999,
      priceYearly:  79990,
      trialDays:    30,
      maxUsers:     -1,
      maxContacts:  -1,
      maxPolicies:  -1,
      features:     { contacts: true, policies: true, claims: true, calendar: true, workspace: true, dashboard: true, leads: true, operations: true, employees: true, commissions: true, branding: true, whatsapp: true, documents: true, analytics: true },
      isActive:     true,
    },
  });

  // Keep Enterprise as inactive alias for backward compat with existing subscriptions
  await prisma.subscriptionPlan.upsert({
    where:  { name: 'Enterprise' },
    update: { isActive: false },
    create: {
      name:         'Enterprise',
      priceMonthly: 7999,
      priceYearly:  79990,
      trialDays:    30,
      maxUsers:     -1,
      maxContacts:  -1,
      maxPolicies:  -1,
      features:     { contacts: true, policies: true, claims: true, calendar: true, workspace: true, dashboard: true, leads: true, operations: true, employees: true, commissions: true, branding: true, whatsapp: true, documents: true, analytics: true },
      isActive:     false,
    },
  });

  // ── 2. Platform Settings ──────────────────────────────────────────────────
  await prisma.platformSetting.upsert({
    where:  { key: 'maintenance_mode' },
    update: {},
    create: { key: 'maintenance_mode', value: 'false' },
  });
  await prisma.platformSetting.upsert({
    where:  { key: 'default_country' },
    update: {},
    create: { key: 'default_country', value: 'IN' },
  });
  await prisma.platformSetting.upsert({
    where:  { key: 'default_currency' },
    update: {},
    create: { key: 'default_currency', value: 'INR' },
  });

  // ── 3. Super Admin ────────────────────────────────────────────────────────
  const superAdminHash = await bcrypt.hash('insumitra@123', SALT);
  await prisma.superAdmin.upsert({
    where:  { email: 'insumitra@gmail.com' },
    update: {},
    create: {
      email:        'insumitra@gmail.com',
      passwordHash: superAdminHash,
      name:         'Platform Admin',
    },
  });

  // ── 4. Demo Tenant + Owner ────────────────────────────────────────────────
  const demoTenant = await prisma.tenant.upsert({
    where:  { slug: 'demo-agency' },
    update: {},
    create: {
      name:      'Demo Insurance Agency',
      slug:      'demo-agency',
      phone:    '+919000000000',
      email:    'owner@demo-agency.com',
      isActive:  true,
    },
  });

  const ownerHash = await bcrypt.hash('Owner@1234!', SALT);
  const owner = await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: demoTenant.id, email: 'owner@demo-agency.com' } },
    update: {},
    create: {
      tenantId:     demoTenant.id,
      email:        'owner@demo-agency.com',
      passwordHash: ownerHash,
      role:         UserRole.OWNER,
      isActive:     true,
    },
  });

  await prisma.employeeProfile.upsert({
    where:  { userId: owner.id },
    update: {},
    create: {
      userId:        owner.id,
      tenantId:      demoTenant.id,
      firstName:     'Rahul',
      lastName:      'Mehta',
      phone:         '+919000000001',
      department:    'Management',
      designation:   'Broker-Owner',
      dateOfJoining: new Date('2020-01-01'),
    },
  });

  // ── Demo Employee ─────────────────────────────────────────────────────────
  const employeeHash = await bcrypt.hash('Employee@1234!', SALT);
  const employee = await prisma.user.upsert({
    where:  { tenantId_email: { tenantId: demoTenant.id, email: 'employee@demo-agency.com' } },
    update: {},
    create: {
      tenantId:     demoTenant.id,
      email:        'employee@demo-agency.com',
      passwordHash: employeeHash,
      role:         UserRole.EMPLOYEE,
      isActive:     true,
    },
  });

  await prisma.employeeProfile.upsert({
    where:  { userId: employee.id },
    update: {},
    create: {
      userId:        employee.id,
      tenantId:      demoTenant.id,
      firstName:     'Priya',
      lastName:      'Sharma',
      phone:         '+919000000002',
      department:    'Sales',
      designation:   'Insurance Agent',
      dateOfJoining: new Date('2022-06-01'),
    },
  });


  const testUserHash = await bcrypt.hash('Test@1234', SALT);

await prisma.user.upsert({
  where: {
    tenantId_email: {
      tenantId: demoTenant.id,
      email: 'test@example.com',
    },
  },
  update: {
    passwordHash: testUserHash,
    isActive: true,
  },
  create: {
    tenantId: demoTenant.id,
    email: 'test@example.com',
    passwordHash: testUserHash,
    role: UserRole.EMPLOYEE,
    isActive: true,
  },
});

await prisma.employeeProfile.upsert({
  where: { userId: (await prisma.user.findFirst({
    where: { email: 'test@example.com' }
  }))!.id },
  update: {},
  create: {
    tenantId: demoTenant.id,
    userId: (await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    }))!.id,
    firstName: 'Test',
    lastName: 'User',
    phone: '+919999999999',
    department: 'Testing',
    designation: 'Test Employee',
    dateOfJoining: new Date(),
  },
});
  // Demo subscription (trial)
  await prisma.subscription.upsert({
    where:  { id: demoTenant.id }, // won't match; will create
    update: {},
    create: {
      tenantId:  demoTenant.id,
      planId:    growth.id,
      status:    SubscriptionStatus.TRIAL,
      startDate: new Date(),
      endDate:   new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  }).catch(() => { /* already exists */ });

  // ── Demo Contact (CONTACT role — for client portal login) ─────────────────
  const contactHash = await bcrypt.hash('Client@1234!', SALT);

  // First create/upsert the contact record
  const demoContact = await prisma.contact.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'contact@demo-agency.com' } },
    update: {},
    create: {
      tenantId:    demoTenant.id,
      firstName:   'Rajesh',
      lastName:    'Verma',
      email:       'contact@demo-agency.com',
      phone:       '+919823044556',
      gender:      'MALE',
      createdById: owner.id,
    },
  });

  // Then create/upsert the User with CONTACT role linked to the contact
  const contactUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'contact@demo-agency.com' } },
    update: { passwordHash: contactHash },
    create: {
      tenantId:     demoTenant.id,
      email:        'contact@demo-agency.com',
      passwordHash: contactHash,
      role:         UserRole.CONTACT,
      isActive:     true,
    },
  });

  // Link the contact record to the user account
  await prisma.contact.update({
    where: { id: demoContact.id },
    data:  { userId: contactUser.id },
  });


  // ── 5. Insurance Companies ────────────────────────────────────────────────
  const lifeInsurer = await prisma.insuranceCompany.upsert({
    where:  { tenantId_shortCode: { shortCode: 'LIC', tenantId: demoTenant.id } },
    update: {},
    create: {
      tenantId:    demoTenant.id,
      name:        'LIC of India',
      shortCode:   'LIC',
      website:     'https://licindia.in',
      isActive:    true,
    },
  });

  const generalInsurer = await prisma.insuranceCompany.upsert({
    where:  { tenantId_shortCode: { shortCode: 'STARHEALTH', tenantId: demoTenant.id } },
    update: {},
    create: {
      tenantId:    demoTenant.id,
      name:        'Star Health Insurance',
      shortCode:   'STARHEALTH',
      website:     'https://starhealth.in',
      isActive:    true,
    },
  });

  const hdfcErgo = await prisma.insuranceCompany.upsert({
    where:  { tenantId_shortCode: { shortCode: 'HDFC-ERGO', tenantId: demoTenant.id } },
    update: {},
    create: {
      tenantId:    demoTenant.id,
      name:        'HDFC ERGO General Insurance',
      shortCode:   'HDFC-ERGO',
      website:     'https://hdfcergo.com',
      isActive:    true,
    },
  });

  const hdfcLife = await prisma.insuranceCompany.upsert({
    where:  { tenantId_shortCode: { shortCode: 'HDFC-LIFE', tenantId: demoTenant.id } },
    update: {},
    create: {
      tenantId:    demoTenant.id,
      name:        'HDFC Life Insurance',
      shortCode:   'HDFC-LIFE',
      website:     'https://hdfclife.com',
      isActive:    true,
    },
  });

  // ── 6. Insurance Plans ────────────────────────────────────────────────────
  const jeevanAnandPlan = await prisma.insurancePlan.upsert({
    where:  { tenantId_planCode_companyId: { tenantId: demoTenant.id, planCode: 'LIC-JEEVAN-ANAND', companyId: lifeInsurer.id } },
    update: {},
    create: {
      tenantId:   demoTenant.id,
      companyId:  lifeInsurer.id,
      name:       'Jeevan Anand',
      planCode:   'LIC-JEEVAN-ANAND',
      category:   'LIFE',
      isActive:   true,
    },
  });

  const familyHealthPlan = await prisma.insurancePlan.upsert({
    where:  { tenantId_planCode_companyId: { tenantId: demoTenant.id, planCode: 'STARHEALTH-FAMILY', companyId: generalInsurer.id } },
    update: {},
    create: {
      tenantId:   demoTenant.id,
      companyId:  generalInsurer.id,
      name:       'Family Health Optima',
      planCode:   'STARHEALTH-FAMILY',
      category:   'HEALTH',
      isActive:   true,
    },
  });

  const osPlusPlan = await prisma.insurancePlan.upsert({
    where:  { tenantId_planCode_companyId: { tenantId: demoTenant.id, planCode: 'HDFC-OS-PLUS', companyId: hdfcErgo.id } },
    update: {},
    create: {
      tenantId:   demoTenant.id,
      companyId:  hdfcErgo.id,
      name:       'Optima Secure (OS+)',
      planCode:   'HDFC-OS-PLUS',
      category:   'HEALTH',
      isActive:   true,
    },
  });

  const click2ProtectPlan = await prisma.insurancePlan.upsert({
    where:  { tenantId_planCode_companyId: { tenantId: demoTenant.id, planCode: 'HDFC-C2P-3D', companyId: hdfcLife.id } },
    update: {},
    create: {
      tenantId:   demoTenant.id,
      companyId:  hdfcLife.id,
      name:       'Click 2 Protect Plus',
      planCode:   'HDFC-C2P-3D',
      category:   'TERM',
      isActive:   true,
    },
  });

  // ── 6.1 Policy Scenarios ──────────────────────────────────────────────────
  // Health - Fresh (HDFC Ergo OS+)
  await (prisma as any).policyScenario.upsert({
    where: { tenantId_policyType_businessType_companyId_planId: { tenantId: demoTenant.id, policyType: 'HEALTH', businessType: 'FRESH', companyId: hdfcErgo.id, planId: osPlusPlan.id } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      policyType: 'HEALTH',
      businessType: 'FRESH',
      companyId: hdfcErgo.id,
      planId: osPlusPlan.id,
      policyPeriods: ['1 Yr', '2 Yr', '3 Yr', '4 Yr', '5 Yr'],
      paymentOptions: ['Full Payment', 'EMI', 'Monthly', 'Quarterly', 'Half-Yearly'],
      emiMonths: ['3 Months', '6 Months', '9 Months', '12 Months', '18 Months', '24 Months', '36 Months'],
      paymentTerms: [],
      isActive: true,
    },
  });

  // Health - Port (HDFC Ergo OS+)
  await (prisma as any).policyScenario.upsert({
    where: { tenantId_policyType_businessType_companyId_planId: { tenantId: demoTenant.id, policyType: 'HEALTH', businessType: 'PORT', companyId: hdfcErgo.id, planId: osPlusPlan.id } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      policyType: 'HEALTH',
      businessType: 'PORT',
      companyId: hdfcErgo.id,
      planId: osPlusPlan.id,
      policyPeriods: ['1 Yr', '2 Yr', '3 Yr'],
      paymentOptions: ['Full Payment', 'Monthly', 'Quarterly', 'Half-Yearly'],
      emiMonths: [],
      paymentTerms: [],
      isActive: true,
    },
  });

  // Health - Renewal (HDFC Ergo OS+)
  await (prisma as any).policyScenario.upsert({
    where: { tenantId_policyType_businessType_companyId_planId: { tenantId: demoTenant.id, policyType: 'HEALTH', businessType: 'RENEWAL', companyId: hdfcErgo.id, planId: osPlusPlan.id } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      policyType: 'HEALTH',
      businessType: 'RENEWAL',
      companyId: hdfcErgo.id,
      planId: osPlusPlan.id,
      policyPeriods: ['1 Yr', '2 Yr', '3 Yr'],
      paymentOptions: ['Full Payment', 'Monthly', 'Quarterly', 'Half-Yearly'],
      emiMonths: [],
      paymentTerms: [],
      isActive: true,
    },
  });

  // Term - Fresh (HDFC Life C2P)
  await (prisma as any).policyScenario.upsert({
    where: { tenantId_policyType_businessType_companyId_planId: { tenantId: demoTenant.id, policyType: 'TERM', businessType: 'FRESH', companyId: hdfcLife.id, planId: click2ProtectPlan.id } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      policyType: 'TERM',
      businessType: 'FRESH',
      companyId: hdfcLife.id,
      planId: click2ProtectPlan.id,
      policyPeriods: ['10 Yr', '15 Yr', '20 Yr', '25 Yr', '30 Yr', '40 Yr', '50 Yr', '80 Yr', '99 Yr'],
      paymentOptions: ['Full Payment', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'],
      emiMonths: [],
      paymentTerms: ['1 Yr', '5 Yr', '10 Yr', '15 Yr', '20 Yr', 'Pay till 60', 'Regular Term (1 to 99 Yr)'],
      isActive: true,
    },
  });

  // Star Health Family Health Optima - Fresh
  await (prisma as any).policyScenario.upsert({
    where: { tenantId_policyType_businessType_companyId_planId: { tenantId: demoTenant.id, policyType: 'HEALTH', businessType: 'FRESH', companyId: generalInsurer.id, planId: familyHealthPlan.id } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      policyType: 'HEALTH',
      businessType: 'FRESH',
      companyId: generalInsurer.id,
      planId: familyHealthPlan.id,
      policyPeriods: ['1 Yr', '2 Yr', '3 Yr'],
      paymentOptions: ['Full Payment', 'Monthly', 'Quarterly', 'Half-Yearly'],
      emiMonths: [],
      paymentTerms: [],
      isActive: true,
    },
  });

  // ── 7. WhatsApp Wallet ────────────────────────────────────────────────────
  await prisma.whatsappWallet.upsert({
    where:  { tenantId: demoTenant.id },
    update: {},
    create: { tenantId: demoTenant.id, balance: 500 },
  });

  // ── 8. WhatsApp Templates ─────────────────────────────────────────────────
  await prisma.whatsappTemplate.upsert({
    where:  { tenantId_name: { tenantId: demoTenant.id, name: 'policy_renewal_reminder' } },
    update: {},
    create: {
      tenantId:    demoTenant.id,
      name:        'policy_renewal_reminder',
      body:        'Dear {{name}}, your policy {{policyNumber}} is due for renewal on {{date}}. Please contact us to renew. - {{agencyName}}',
      variables:   ['name', 'policyNumber', 'date', 'agencyName'],
      category:    'TRANSACTIONAL',
      language:    'en',
      isActive:    true,
    },
  });

  await prisma.whatsappTemplate.upsert({
    where:  { tenantId_name: { tenantId: demoTenant.id, name: 'birthday_wish' } },
    update: {},
    create: {
      tenantId:  demoTenant.id,
      name:      'birthday_wish',
      body:      'Happy Birthday {{name}}! 🎂 Wishing you health and happiness. - {{agencyName}}',
      variables: ['name', 'agencyName'],
      category:  'PROMOTIONAL',
      language:  'en',
      isActive:  true,
    },
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Super Admin : insumitra@gmail.com       / insumitra@123');
  console.log('  Owner       : owner@demo-agency.com    / Owner@1234!');
  console.log('  Employee    : employee@demo-agency.com / Employee@1234!');
  console.log('  Contact     : contact@demo-agency.com  / Client@1234!');

}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
