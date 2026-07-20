const BASE_URL = 'http://127.0.0.1:3000/api/v1';

async function main() {
  console.log('--- API VERIFICATION START ---');

  // 1. Login
  console.log('\nLogging in...');
  let loginRes;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@demo-agency.com',
        password: 'Owner@1234!'
      })
    });
    loginRes = await res.json() as any;
  } catch (err: any) {
    console.error('Login failed:', err.message);
    return;
  }

  if (!loginRes?.data?.accessToken) {
    console.error('Login response does not contain access token:', loginRes);
    return;
  }

  const { accessToken } = loginRes.data;
  console.log('Login successful!');

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // Helper request function
  async function testApi(url: string) {
    try {
      const res = await fetch(url, { headers });
      const status = res.status;
      const body = await res.json() as any;
      return { status, body };
    } catch (err: any) {
      return { status: 0, error: err.message };
    }
  }

  // 2. Fetch Policies
  console.log('\n--- 2.1 Fetching All Policies ---');
  const allRes = await testApi(`${BASE_URL}/policies`);
  console.log(`Status: ${allRes.status}`);
  if (allRes.body) {
    console.log(`Total Policies: ${allRes.body.data?.length}`);
    for (const p of allRes.body.data) {
      console.log(`Policy Number: ${p.policyNumber}, ID: ${p.id}, Assignee: ${p.assignedEmployee?.employeeProfile ? `${p.assignedEmployee.employeeProfile.firstName} ${p.assignedEmployee.employeeProfile.lastName}` : '—'}`);
    }
  }

  // 3. Plans
  console.log('\n--- 2.2 Insurance Plans (Product Type list) ---');
  const plansRes = await testApi(`${BASE_URL}/policies/plans`);
  console.log(`Status: ${plansRes.status}`);
  if (plansRes.body) {
    console.log('Plans:', plansRes.body.data?.map((pl: any) => ({ id: pl.id, name: pl.name, category: pl.category })));
  }

  // 4. Filter by Product Type (Family Health Optima vs Jeevan Anand)
  for (const pl of plansRes.body?.data || []) {
    console.log(`\n--- 2.3 Filtering by Product Type (${pl.name}, id=${pl.id}) ---`);
    const planFilterRes = await testApi(`${BASE_URL}/policies?planId=${pl.id}`);
    console.log(`Status: ${planFilterRes.status}`);
    console.log(`Matching Policies: ${planFilterRes.body?.data?.length}`);
    if (planFilterRes.body?.data?.length > 0) {
      console.log(`Matching Policy numbers:`, planFilterRes.body.data.map((p: any) => p.policyNumber));
    }
  }

  // 5. Status Filter (ACTIVE)
  console.log('\n--- 2.4 Filtering by Status=ACTIVE ---');
  const activeRes = await testApi(`${BASE_URL}/policies?status=ACTIVE`);
  console.log(`Status: ${activeRes.status}`);
  console.log(`Active Policies:`, activeRes.body?.data?.map((p: any) => p.policyNumber));

  // 6. Status Filter (LAPSED)
  console.log('\n--- 2.5 Filtering by Status=LAPSED ---');
  const lapsedRes = await testApi(`${BASE_URL}/policies?status=LAPSED`);
  console.log(`Status: ${lapsedRes.status}`);
  console.log(`Lapsed Policies:`, lapsedRes.body?.data?.map((p: any) => p.policyNumber));

  // 7. Renewal Due Filter
  console.log('\n--- 2.6 Filtering by Renewal Due (2026-06-01 to 2027-12-31) ---');
  const renewalRes = await testApi(`${BASE_URL}/policies?endDateFrom=2026-06-01&endDateTo=2027-12-31`);
  console.log(`Status: ${renewalRes.status}`);
  console.log(`Expiring Policies:`, renewalRes.body?.data?.map((p: any) => p.policyNumber));

  // 8. Payment Due Filter (nextDueDate check)
  console.log('\n--- 2.7 Filtering by Payment Due (2026-06-01 to 2026-08-31) ---');
  const payDueRes = await testApi(`${BASE_URL}/policies?nextDueDateFrom=2026-06-01&nextDueDateTo=2026-08-31`);
  console.log(`Status: ${payDueRes.status}`);
  console.log(`Payment Due Policies:`, payDueRes.body?.data?.map((p: any) => p.policyNumber));

  // 9. Sorting (premiumAmount asc/desc)
  console.log('\n--- 2.8 Sorting by premiumAmount asc ---');
  const sortAsc = await testApi(`${BASE_URL}/policies?sortBy=premiumAmount&sortOrder=asc`);
  console.log('Premium Amounts (ASC):', sortAsc.body?.data?.map((p: any) => p.premiumAmount));

  console.log('\n--- 2.9 Sorting by assignedEmployee.employeeProfile.firstName asc ---');
  const sortAssignee = await testApi(`${BASE_URL}/policies?sortBy=assignedEmployee.employeeProfile.firstName&sortOrder=asc`);
  console.log('Assignees (ASC):', sortAssignee.body?.data?.map((p: any) => p.assignedEmployee?.employeeProfile ? `${p.assignedEmployee.employeeProfile.firstName} ${p.assignedEmployee.employeeProfile.lastName}` : '—'));

  // 10. Fetch Details for BOTH policies
  for (const pSummary of allRes.body?.data || []) {
    console.log(`\n--- 3. Fetching Details for Policy ${pSummary.policyNumber} (ID: ${pSummary.id}) ---`);
    const detail = await testApi(`${BASE_URL}/policies/${pSummary.id}`);
    console.log(`Status: ${detail.status}`);
    if (detail.body?.data) {
      const p = detail.body.data;
      console.log(`Policy Number: ${p.policyNumber}`);
      console.log(`Assignee Name: ${p.assignedEmployee?.employeeProfile ? `${p.assignedEmployee.employeeProfile.firstName} ${p.assignedEmployee.employeeProfile.lastName}` : '—'}`);
      console.log(`Payments count: ${p.payments?.length}`);
      if (p.payments?.length > 0) {
        console.log(`Payments (first 6):`, p.payments?.slice(0, 6).map((pm: any) => ({ dueDate: pm.dueDate?.slice(0, 10), amount: pm.amount, isPaid: pm.isPaid, paidDate: pm.paidDate?.slice(0, 10) })));
      }
      console.log(`Commissions count: ${p.commissions?.length}`);
      if (p.commissions?.length > 0) {
        console.log(`Commissions:`, p.commissions.map((c: any) => ({ amount: c.amount, rate: c.rate, isPaid: c.isPaid, beneficiary: c.beneficiaryId })));
      }
      console.log(`Loans count: ${p.loans?.length}`);
      if (p.loans?.length > 0) {
        console.log(`Loans:`, p.loans.map((l: any) => ({ loanAmount: l.loanAmount, interestRate: l.interestRate, outstandingAmt: l.outstandingAmt })));
      }
    }
  }

  console.log('\n--- API VERIFICATION END ---');
}

main().catch(err => console.error(err));
