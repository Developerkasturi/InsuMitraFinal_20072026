import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrphanedPolicyPlans() {
  console.log('=== CHECKING AND FIXING ORPHANED POLICY PLANS ===\n');

  // 1. Fetch all insurance plans
  const plans = await prisma.insurancePlan.findMany({ select: { id: true } });
  const validPlanIds = new Set(plans.map(p => p.id));
  console.log(`Found ${validPlanIds.size} valid insurance plans in database.`);

  const fallbackPlan = plans[0]?.id;
  if (!fallbackPlan) {
    console.error('No insurance plans found in database to link as fallback!');
    return;
  }

  // 2. Fetch raw policies directly
  const policies = await prisma.policy.findMany({
    select: { id: true, policyNumber: true, planId: true }
  });
  console.log(`Checking ${policies.length} policies...`);

  let fixedCount = 0;
  for (const pol of policies) {
    if (!pol.planId || !validPlanIds.has(pol.planId)) {
      console.log(`Policy ${pol.policyNumber} (${pol.id}) has invalid/missing planId "${pol.planId}". Updating to valid planId "${fallbackPlan}"...`);
      await prisma.policy.update({
        where: { id: pol.id },
        data: { planId: fallbackPlan }
      });
      fixedCount++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed ${fixedCount} policies with orphaned/missing planId.`);
  await prisma.$disconnect();
}

fixOrphanedPolicyPlans().catch(console.error);
