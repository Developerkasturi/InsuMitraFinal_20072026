
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    try {
        const hdfcErgo = await prisma.insuranceCompany.findFirst({ where: { name: { contains: 'HDFC ERGO' } } });
        const hdfcLife = await prisma.insuranceCompany.findFirst({ where: { name: { contains: 'HDFC Life' } } });
        const osPlus = await prisma.insurancePlan.findFirst({ where: { planCode: 'HDFC-OS-PLUS' } });
        const c2pPlus = await prisma.insurancePlan.findFirst({ where: { planCode: 'HDFC-C2P-3D' } });
        
        if (!hdfcErgo || !hdfcLife || !osPlus || !c2pPlus) {
             console.log('Error: Could not find required companies or plans');
             process.exit(1);
        }
        
        const tenantId = hdfcErgo.tenantId;

        // 1. Fix Case 5: Health PORT HDFC Ergo OS+
        const portScenario = await prisma.policyScenario.findFirst({
             where: { tenantId, policyType: 'HEALTH', businessType: 'PORT', companyId: hdfcErgo.id, planId: osPlus.id }
        });
        if (portScenario) {
             const newPayments = Array.from(new Set([...portScenario.paymentOptions, 'EMI']));
             const emiMonths = ['3 Months', '6 Months', '9 Months', '12 Months', '18 Months', '24 Months', '36 Months'];
             await prisma.policyScenario.update({
                 where: { id: portScenario.id },
                 data: { paymentOptions: newPayments, emiMonths }
             });
             console.log('Fixed Case 5 (PORT EMI)');
        }

        // 2. Fix Case 8: Health RENEWAL HDFC Ergo OS+
        const renScenario = await prisma.policyScenario.findFirst({
             where: { tenantId, policyType: 'HEALTH', businessType: 'RENEWAL', companyId: hdfcErgo.id, planId: osPlus.id }
        });
        if (renScenario) {
             const newPayments = Array.from(new Set([...renScenario.paymentOptions, 'EMI']));
             const emiMonths = ['3 Months', '6 Months', '9 Months', '12 Months', '18 Months', '24 Months', '36 Months'];
             await prisma.policyScenario.update({
                 where: { id: renScenario.id },
                 data: { paymentOptions: newPayments, emiMonths }
             });
             console.log('Fixed Case 8 (RENEWAL EMI)');
        }

        // 3. Fix Case 10 & 11: Term FRESH HDFC Life
        const fullPeriods = Array.from({length: 99}, (_, i) => (i+1) + ' Yr');
        const termFresh = await prisma.policyScenario.findFirst({
             where: { tenantId, policyType: 'TERM', businessType: 'FRESH', companyId: hdfcLife.id, planId: c2pPlus.id }
        });
        if (termFresh) {
             await prisma.policyScenario.update({
                 where: { id: termFresh.id },
                 data: { policyPeriods: fullPeriods }
             });
             console.log('Fixed Case 10 & 11 (TERM FRESH 1-99)');
        }

        // 4. Fix Case 12 & 13: Term RENEWAL HDFC Life
        // Need to create it if it doesn't exist
        const termRen = await prisma.policyScenario.findFirst({
             where: { tenantId, policyType: 'TERM', businessType: 'RENEWAL', companyId: hdfcLife.id, planId: c2pPlus.id }
        });
        if (!termRen) {
             await prisma.policyScenario.create({
                 data: {
                     tenantId,
                     policyType: 'TERM',
                     businessType: 'RENEWAL',
                     companyId: hdfcLife.id,
                     planId: c2pPlus.id,
                     policyPeriods: fullPeriods,
                     paymentOptions: ['Full Payment', 'Monthly', 'Quarterly', 'Half-Yearly'],
                     emiMonths: [],
                     paymentTerms: ['1 Yr', '5 Yr', '10 Yr', '15 Yr', '20 Yr', 'Pay till 60', 'Regular Term (1 to 99 Yr)']
                 }
             });
             console.log('Fixed Case 12 & 13 (Created TERM RENEWAL)');
        } else {
             await prisma.policyScenario.update({
                 where: { id: termRen.id },
                 data: { 
                     policyPeriods: fullPeriods,
                     paymentOptions: ['Full Payment', 'Monthly', 'Quarterly', 'Half-Yearly']
                 }
             });
             console.log('Fixed Case 12 & 13 (Updated TERM RENEWAL)');
        }

    } catch(err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
})();

