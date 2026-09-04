
const mockRawPolicies = [
  {
    id: 'pol-123',
    policyNumber: 'POL-123',
    premiumAmount: 12000,
    paymentFrequency: 'Monthly',
    businessType: 'FRESH',
    plan: {
      name: 'Test Plan',
      category: 'HEALTH',
      company: { name: 'Test Co' }
    },
    contact: { firstName: 'Test', lastName: 'User', phone: '123' },
    payments: [
      { id: '1', amount: 1000, dueDate: '2026-08-01T00:00:00Z', isPaid: true },
      { id: '2', amount: 1000, dueDate: '2026-09-01T00:00:00Z', isPaid: false },
    ]
  }
];

const data = mockRawPolicies.filter(p => p.paymentFrequency && p.paymentFrequency !== 'SINGLE' && p.paymentFrequency !== 'Full Payment').map(p => {
  const payments = p.payments || [];
  const totalEmis = payments.length;
  if (totalEmis === 0) return null;

  const paidEmis = payments.filter((pmt) => pmt.isPaid).length;
  let currentEmiNo = payments.findIndex((pmt) => !pmt.isPaid) + 1;
  if (currentEmiNo === 0) currentEmiNo = totalEmis;
  
  const currentPmt = payments[currentEmiNo - 1] || payments[totalEmis - 1];
  const dueDate = new Date(currentPmt.dueDate);
  const today = new Date();
  today.setHours(0,0,0,0);
  dueDate.setHours(0,0,0,0);
  
  let status = 'UPCOMING';
  if (paidEmis === totalEmis) status = 'PAID';
  else if (dueDate < today) status = 'OVERDUE';
  else if (dueDate.getTime() === today.getTime() || dueDate.getTime() - today.getTime() <= 7 * 86400000) status = 'DUE';

  const c = p.contact || {};
  const plan = p.plan || {};
  const comp = plan.company || {};
  const emp = p.assignedEmployee?.employeeProfile || {};

  return {
    id: p.id,
    policyNo: p.policyNumber || 'N/A',
    customerName: ${c.firstName || ''} .trim() || 'No Name',
    customerContactNo: c.phone || 'N/A',
    insuranceCompanyType: plan.category || 'N/A',
    customerTag: ${plan.category || 'N/A'} - ,
    product: plan.name || 'N/A',
    insurer: comp.name || 'N/A',
    loanProvider: p.notes?.includes('Loan') ? 'FIBE' : 'N/A',
    premiumAmount: p.premiumAmount || 0,
    installmentFrequency: p.paymentFrequency,
    tenure: '1 Year',
    paymentMode: p.paymentFrequency,
    totalEmis,
    paidEmis,
    currentEmiNo,
    dueDate: currentPmt.dueDate ? new Date(currentPmt.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'}) : 'N/A',
    amount: currentPmt.amount || 0,
    paidAmountTotal: payments.filter((pmt) => pmt.isPaid).reduce((acc, val) => acc + (val.amount || 0), 0),
    remainingAmountTotal: payments.filter((pmt) => !pmt.isPaid).reduce((acc, val) => acc + (val.amount || 0), 0),
    status,
    nextAction: status === 'PAID' ? 'View Receipt' : status === 'OVERDUE' ? 'Call Customer' : 'Send Reminder',
    employee: ${emp.firstName || ''} .trim() || 'Unassigned',
    history: [],
    schedule: payments.map((pmt, index) => {
         const d = new Date(pmt.dueDate);
         d.setHours(0,0,0,0);
         let sStatus = 'UPCOMING';
         if (pmt.isPaid) sStatus = 'PAID';
         else if (d <= new Date(Date.now() + 7 * 86400000)) sStatus = 'DUE';
         return {
             emiNo: index + 1,
             dueDate: pmt.dueDate ? new Date(pmt.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'}) : 'N/A',
             amount: pmt.amount || 0,
             status: sStatus,
             paidDate: pmt.createdAt ? new Date(pmt.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric'}) : undefined,
         };
    }),
    notes: p.notes || '',
  };
}).filter(Boolean);

console.log(JSON.stringify(data, null, 2));

