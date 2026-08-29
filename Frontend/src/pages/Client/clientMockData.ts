// ─────────────────────────────────────────────────────────────────────────────
// Client Portal Fallback / Demo Data
// Used to provide realistic demonstration data aligned with InsuMitra CRM
// ─────────────────────────────────────────────────────────────────────────────

export const FALLBACK_CLIENT_PROFILE = {
  id: 'contact_client_101',
  firstName: 'Rajesh',
  lastName: 'Verma',
  gender: 'MALE',
  dob: '1985-06-15',
  phone: '+91 98230 44556',
  email: 'rajesh.verma@example.com',
  panNumber: 'ABCDE1234F',
  annualIncome: 1800000,
  notes: 'Preferred communication via WhatsApp. Renewal reminder 15 days in advance.',
  addresses: [
    {
      id: 'addr_1',
      street: 'Flat 402, Green Meadows Apt, Baner',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
      type: 'RESIDENTIAL',
    }
  ],
  occupations: [
    {
      id: 'occ_1',
      title: 'Senior Software Architect',
      company: 'Tech Solutions Pvt Ltd',
    }
  ],
  createdByUser: {
    id: 'emp_01',
    firstName: 'Sarang',
    lastName: 'Taralekar',
    phone: '+91 98220 12345',
    email: 'sarang.taralekar@sampadainvestments.com',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&auto=format&fit=crop&q=80',
  },
  tenant: {
    name: 'Sampada Investment Solutions',
    tagline: 'Your Trusted IRDAI Certified Insurance & Wealth Advisory Partner',
    logoUrl: '',
    agentPhotoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&auto=format&fit=crop&q=80',
    primaryColor: '#2563eb',
    phone: '+91 98220 12345',
    email: 'contact@sampadainvestments.com',
    website: 'https://www.sampadainvestments.com',
    address: 'Office 301, Fortune Business Center, SB Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411016',
    banners: [
      {
        id: 'b1',
        title: 'Instant Cashless Hospitalization Assistance',
        description: '24x7 Dedicated InsuMitra desk for pre-auth approvals across 14,000+ network hospitals.',
        imageUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&auto=format&fit=crop&q=80',
      },
      {
        id: 'b2',
        title: 'Tax Savings under Section 80D & 80C',
        description: 'Download your annual consolidated premium tax receipts in one click from the Documents vault.',
        imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
      }
    ],
  },
};

export const FALLBACK_CLIENT_POLICIES = [
  {
    id: 'pol_101',
    policyNumber: 'STAR/HL/2026/99412',
    status: 'ACTIVE',
    sumAssured: 1500000,
    premiumAmount: 24500,
    paymentFrequency: 'YEARLY',
    paymentMode: 'UPI',
    startDate: '2025-09-15',
    endDate: '2026-09-14',
    nextDueDate: '2026-09-14',
    maturityDate: '2026-09-14',
    agentCode: 'YS-AG-8821',
    documentUrl: 'https://example.com/StarHealth_Policy.pdf',
    plan: {
      id: 'plan_1',
      name: 'Star Health Comprehensive Floater',
      type: 'HEALTH',
      company: {
        id: 'comp_1',
        name: 'Star Health & Allied Insurance',
        logoUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=100&auto=format&fit=crop&q=80',
      },
    },
    nominees: [
      {
        id: 'nom_1',
        name: 'Pooja Verma',
        relationship: 'SPOUSE',
        sharePercent: 100,
        dob: '1988-03-22',
        phone: '+91 98230 44557',
      }
    ],
    members: [
      { id: 'm1', name: 'Rajesh Verma', relationship: 'SELF', gender: 'MALE', dob: '1985-06-15', sumAssured: 1500000 },
      { id: 'm2', name: 'Pooja Verma', relationship: 'SPOUSE', gender: 'FEMALE', dob: '1988-03-22', sumAssured: 1500000 },
      { id: 'm3', name: 'Aarav Verma', relationship: 'CHILD', gender: 'MALE', dob: '2016-11-10', sumAssured: 1500000 },
    ],
    payments: [
      { id: 'pay_1', amount: 24500, dueDate: '2025-09-15', paidDate: '2025-09-12', status: 'PAID', mode: 'UPI', isPaid: true }
    ],
    claims: [
      { id: 'c1', claimNumber: 'CLM/2026/0892', status: 'IN_REVIEW', claimAmount: 72000, approvedAmount: 68500, intimatedAt: '2026-08-14' }
    ]
  },
  {
    id: 'pol_102',
    policyNumber: 'HDFC/ERGO/2026/4108',
    status: 'ACTIVE',
    sumAssured: 2500000,
    premiumAmount: 11800,
    paymentFrequency: 'YEARLY',
    paymentMode: 'NET_BANKING',
    startDate: '2025-11-01',
    endDate: '2026-10-31',
    nextDueDate: '2026-10-31',
    maturityDate: '2026-10-31',
    agentCode: 'YS-AG-8821',
    plan: {
      id: 'plan_2',
      name: 'Optima Secure Top-up 25L',
      type: 'HEALTH',
      company: {
        id: 'comp_2',
        name: 'HDFC ERGO General Insurance',
        logoUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=100&auto=format&fit=crop&q=80',
      },
    },
    nominees: [
      { id: 'nom_2', name: 'Pooja Verma', relationship: 'SPOUSE', sharePercent: 100, dob: '1988-03-22' }
    ],
    members: [
      { id: 'm4', name: 'Rajesh Verma', relationship: 'SELF', gender: 'MALE', dob: '1985-06-15', sumAssured: 2500000 }
    ],
    payments: [
      { id: 'pay_2', amount: 11800, dueDate: '2025-11-01', paidDate: '2025-10-28', status: 'PAID', mode: 'NET_BANKING', isPaid: true }
    ],
    claims: []
  },
  {
    id: 'pol_103',
    policyNumber: 'TATA/AIA/TRM/88129',
    status: 'ACTIVE',
    sumAssured: 15000000,
    premiumAmount: 18200,
    paymentFrequency: 'YEARLY',
    paymentMode: 'AUTO_DEBIT',
    startDate: '2024-04-10',
    endDate: '2054-04-09',
    nextDueDate: '2027-04-10',
    maturityDate: '2054-04-09',
    agentCode: 'YS-AG-8821',
    plan: {
      id: 'plan_3',
      name: 'Sampoorna Raksha Supreme Pure Term 1.5 Cr',
      type: 'LIFE',
      company: {
        id: 'comp_3',
        name: 'Tata AIA Life Insurance',
        logoUrl: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=100&auto=format&fit=crop&q=80',
      },
    },
    nominees: [
      { id: 'nom_3', name: 'Pooja Verma', relationship: 'SPOUSE', sharePercent: 70, dob: '1988-03-22' },
      { id: 'nom_4', name: 'Aarav Verma', relationship: 'CHILD', sharePercent: 30, dob: '2016-11-10' },
    ],
    members: [
      { id: 'm5', name: 'Rajesh Verma', relationship: 'SELF', gender: 'MALE', dob: '1985-06-15', sumAssured: 15000000 }
    ],
    payments: [
      { id: 'pay_3', amount: 18200, dueDate: '2026-04-10', paidDate: '2026-04-05', status: 'PAID', mode: 'AUTO_DEBIT', isPaid: true }
    ],
    claims: []
  },
  {
    id: 'pol_104',
    policyNumber: 'ICICI/MOT/2026/5529',
    status: 'ACTIVE',
    sumAssured: 950000,
    premiumAmount: 14600,
    paymentFrequency: 'YEARLY',
    paymentMode: 'CREDIT_CARD',
    startDate: '2025-10-20',
    endDate: '2026-10-19',
    nextDueDate: '2026-10-19',
    maturityDate: '2026-10-19',
    agentCode: 'YS-AG-8821',
    plan: {
      id: 'plan_4',
      name: 'Private Car Comprehensive (Zero Dep)',
      type: 'MOTOR',
      company: {
        id: 'comp_4',
        name: 'ICICI Lombard General Insurance',
        logoUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=100&auto=format&fit=crop&q=80',
      },
    },
    nominees: [
      { id: 'nom_5', name: 'Pooja Verma', relationship: 'SPOUSE', sharePercent: 100, dob: '1988-03-22' }
    ],
    members: [],
    payments: [
      { id: 'pay_4', amount: 14600, dueDate: '2025-10-20', paidDate: '2025-10-19', status: 'PAID', mode: 'CREDIT_CARD', isPaid: true }
    ],
    claims: []
  }
];

export const FALLBACK_CLIENT_CLAIMS = [
  {
    id: 'clm_101',
    claimNumber: 'CLM/2026/0892',
    claimType: 'CASHLESS',
    status: 'IN_REVIEW',
    claimAmount: 72000,
    approvedAmount: 68500,
    intimatedAt: '2026-08-14',
    settledDate: null,
    notes: 'Knee Arthroscopy surgery at Apollo Hospital. Pre-authorization approved for ₹68,500. Final discharge invoice verification in progress.',
    policy: {
      policyNumber: 'STAR/HL/2026/99412',
      plan: {
        name: 'Star Health Comprehensive Floater',
        company: {
          name: 'Star Health & Allied Insurance',
          logoUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=100&auto=format&fit=crop&q=80',
        }
      }
    }
  },
  {
    id: 'clm_102',
    claimNumber: 'CLM/2025/1104',
    claimType: 'REIMBURSEMENT',
    status: 'SETTLED',
    claimAmount: 28400,
    approvedAmount: 28400,
    intimatedAt: '2025-12-10',
    settledDate: '2025-12-22',
    notes: 'Post-hospitalization diagnostic scans and specialist consultations at Ruby Hall Clinic. Discharged and reimbursement credited to bank account.',
    policy: {
      policyNumber: 'STAR/HL/2026/99412',
      plan: {
        name: 'Star Health Comprehensive Floater',
        company: {
          name: 'Star Health & Allied Insurance',
          logoUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=100&auto=format&fit=crop&q=80',
        }
      }
    }
  }
];
