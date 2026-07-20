import { UserRole, SubscriptionStatus } from '@prisma/client';
import { SubscriptionLimitInterceptor } from '../src/common/interceptors/subscription-limit.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function run() {
  console.log('🚀 Starting Subscription Limits Verification...');

  // Boot NestJS Context
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const interceptor = new SubscriptionLimitInterceptor(prisma);

  // Setup test tenant
  const testTenant = await prisma.tenant.upsert({
    where: { slug: 'test-limit-verification-tenant' },
    update: {},
    create: {
      name: 'Test Limit Tenant',
      slug: 'test-limit-verification-tenant',
      email: 'limit-test@verif.com',
      phone: '+919998887770',
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      tenantId: testTenant.id,
      email: 'owner@limit-test.com',
      passwordHash: 'somehash',
      role: UserRole.OWNER,
    },
  });

  // Helper for mock execution context
  const mockContext = (path: string) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: path,
          user: {
            tenantId: testTenant.id,
            id: ownerUser.id,
            role: UserRole.OWNER,
          },
        }),
      }),
    } as any;
  };

  const nextHandler = {
    handle: () => ({
      pipe: () => {}
    })
  } as any;

  // ==========================================
  // Test Case 1: FREE Plan Limits (100 Contacts, 1 Seat)
  // ==========================================
  console.log('\n--- Test Case 1: FREE Tier limit checks ---');

  // A. Contact Creation Limit check
  console.log('Creating 100 dummy contact users...');
  const usersData = Array.from({ length: 100 }).map((_, i) => ({
    tenantId: testTenant.id,
    email: `contact.user.${i}.${Date.now()}@example.com`,
    passwordHash: 'hash',
    role: UserRole.CONTACT,
  }));
  await prisma.user.createMany({ data: usersData });
  const createdUsers = await prisma.user.findMany({
    where: { tenantId: testTenant.id, role: UserRole.CONTACT },
    select: { id: true }
  });

  console.log('Creating 100 dummy contacts mapped to unique users...');
  const contactData = Array.from({ length: 100 }).map((_, i) => ({
    tenantId: testTenant.id,
    userId: createdUsers[i].id,
    firstName: `Contact ${i}`,
    lastName: 'Test',
    phone: `+91111111${String(i).padStart(4, '0')}`,
  }));
  await prisma.contact.createMany({ data: contactData });

  // Call interceptor to simulate the 101st contact creation request
  let contactBlocked = false;
  try {
    await interceptor.intercept(mockContext('/contacts'), nextHandler);
  } catch (e: any) {
    if (e.status === 403 && e.message.includes('reached the contact limit')) {
      console.log(`\x1b[32m✅ [PASS]\x1b[0m 101st Contact Creation blocked correctly. Error: "${e.message}"`);
      contactBlocked = true;
    } else {
      console.log('❌ Unexpected error during contact limit intercept:', e);
    }
  }
  if (!contactBlocked) {
    console.log('❌ [FAIL] 101st Contact was NOT blocked by the interceptor!');
  }

  // B. Seat Limit check
  // Our tenant has 1 active user (ownerUser). Since limit is 1, adding the 2nd user should block.
  let seatBlocked = false;
  try {
    await interceptor.intercept(mockContext('/employees'), nextHandler);
  } catch (e: any) {
    if (e.status === 403 && e.message.includes('reached the user/employee limit')) {
      console.log(`\x1b[32m✅ [PASS]\x1b[0m 2nd Seat User Creation blocked correctly. Error: "${e.message}"`);
      seatBlocked = true;
    } else {
      console.log('❌ Unexpected error during user seat limit intercept:', e);
    }
  }
  if (!seatBlocked) {
    console.log('❌ [FAIL] 2nd Seat User creation was NOT blocked by the interceptor!');
  }

  // ==========================================
  // Test Case 2: Starter Plan limits (400 Contacts, 1 Seat)
  // ==========================================
  console.log('\n--- Test Case 2: Starter Tier limit checks ---');
  let starterPlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Starter' } });
  if (!starterPlan) {
    throw new Error('Starter plan not found in database');
  }

  // Upgrade test tenant to Starter
  await prisma.subscription.create({
    data: {
      tenantId: testTenant.id,
      planId: starterPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
    },
  });

  // Verify that adding a contact now works (since limit is 400 and we have 100)
  try {
    await interceptor.intercept(mockContext('/contacts'), nextHandler);
    console.log('\x1b[32m✅ [PASS]\x1b[0m Starter tier allows contact creation at 100/400 contacts.');
  } catch (e: any) {
    console.log('❌ [FAIL] Starter tier blocked contact creation incorrectly:', e);
  }

  // Add remaining contacts to reach 400
  console.log('Creating 300 more dummy contact users for Starter limit...');
  const additionalUsersData = Array.from({ length: 300 }).map((_, i) => ({
    tenantId: testTenant.id,
    email: `contact.user.extra.${i}.${Date.now()}@example.com`,
    passwordHash: 'hash',
    role: UserRole.CONTACT,
  }));
  await prisma.user.createMany({ data: additionalUsersData });
  const additionalCreatedUsers = await prisma.user.findMany({
    where: { tenantId: testTenant.id, role: UserRole.CONTACT, email: { contains: 'extra' } },
    select: { id: true }
  });

  console.log('Adding 300 more contacts to reach 400 limit...');
  const additionalContacts = Array.from({ length: 300 }).map((_, i) => ({
    tenantId: testTenant.id,
    userId: additionalCreatedUsers[i].id,
    firstName: `Contact Extra ${i}`,
    lastName: 'Test',
    phone: `+91222222${String(i).padStart(4, '0')}`,
  }));
  await prisma.contact.createMany({ data: additionalContacts });

  // Simulate 401st contact creation request
  let contactBlockedStarter = false;
  try {
    await interceptor.intercept(mockContext('/contacts'), nextHandler);
  } catch (e: any) {
    if (e.status === 403 && e.message.includes('reached the contact limit')) {
      console.log(`\x1b[32m✅ [PASS]\x1b[0m 401st Contact Creation blocked correctly under Starter tier. Error: "${e.message}"`);
      contactBlockedStarter = true;
    }
  }
  if (!contactBlockedStarter) {
    console.log('❌ [FAIL] 401st Contact was NOT blocked under Starter tier!');
  }

  // Cleanup
  console.log('\nCleaning up verification records...');
  await prisma.contact.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.subscription.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: testTenant.id } });
  await prisma.tenant.delete({ where: { id: testTenant.id } });

  await app.close();
  console.log('Verification completed successfully! 🎉');
}

run()
  .catch(console.error)
  .finally(() => prismaInstance?.$disconnect());

let prismaInstance: any;
