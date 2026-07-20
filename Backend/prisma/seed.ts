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

  // ── 6. Insurance Plans ────────────────────────────────────────────────────
  await prisma.insurancePlan.upsert({
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

  await prisma.insurancePlan.upsert({
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
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
