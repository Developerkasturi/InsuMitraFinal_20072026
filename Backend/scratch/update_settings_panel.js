const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Insurance/SettingsPanel.tsx');

if (!fs.existsSync(filepath)) {
  console.error("SettingsPanel file does not exist: " + filepath);
  process.exit(1);
}

let content = fs.readFileSync(filepath, 'utf8');

// 1. Add imports at the top
const importsTarget = `import { useState, useEffect } from 'react';`;
const importsRpl = `import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceService } from '@api/index';
import { contactFormSchema } from '../Contacts';
import { leadFormSchema } from '../Leads';
import { policyFormSchema } from '../Policies';
import { claimFormSchema } from '../Claims';`;

content = content.replace(importsTarget, importsRpl);

// 2. Update Rule interface ID type (since ID is now string e.g. "Contact-firstName")
const ruleInterfaceTarget = `interface Rule {
  id: number;
  module: string;
  name: string;
  label: string;
  status: 'Active' | 'Optional';
  required: boolean;
}`;

const ruleInterfaceRpl = `interface Rule {
  id: string;
  module: string;
  name: string;
  label: string;
  status: 'Active' | 'Optional';
  required: boolean;
  isProtected: boolean;
}`;

content = content.replace(ruleInterfaceTarget, ruleInterfaceRpl);

// 3. Remove initialFieldRules block and replace fieldRules state + toggle handler
const targetRulesBlock = `  const initialFieldRules: Rule[] = [
    // Insurance Company
    { id: 1, module: 'Insurance Company', name: 'company_category', label: 'Company Category', status: 'Active', required: true },
    { id: 2, module: 'Insurance Company', name: 'official_name', label: 'Company Name - Official', status: 'Active', required: true },
    // Plan
    { id: 3, module: 'Plan', name: 'plan_category', label: 'Plan Category', status: 'Active', required: true },
    { id: 4, module: 'Plan', name: 'plan_name', label: 'Plan Name', status: 'Active', required: true },
    // Contact
    { id: 9, module: 'Contact', name: 'firstName', label: 'First Name', status: 'Active', required: true },
    { id: 10, module: 'Contact', name: 'lastName', label: 'Last Name', status: 'Active', required: true },
    { id: 11, module: 'Contact', name: 'phone', label: 'Phone Number', status: 'Active', required: true },
    { id: 12, module: 'Contact', name: 'email', label: 'Email Address', status: 'Optional', required: false },
    { id: 13, module: 'Contact', name: 'gender', label: 'Gender', status: 'Optional', required: false },
    { id: 14, module: 'Contact', name: 'dateOfBirth', label: 'Date of Birth', status: 'Optional', required: false },
    // Leads
    { id: 15, module: 'Leads', name: 'firstName', label: 'First Name', status: 'Active', required: true },
    { id: 16, module: 'Leads', name: 'lastName', label: 'Last Name', status: 'Active', required: true },
    { id: 17, module: 'Leads', name: 'phone', label: 'Phone Number', status: 'Active', required: true },
    { id: 18, module: 'Leads', name: 'email', label: 'Email Address', status: 'Optional', required: false },
    // Policy
    { id: 19, module: 'Policy', name: 'contactId', label: 'Contact Name / Client', status: 'Active', required: true },
    { id: 20, module: 'Policy', name: 'planId', label: 'Plan / Product Name', status: 'Active', required: true },
    { id: 21, module: 'Policy', name: 'policyNumber', label: 'Policy Number', status: 'Active', required: true },
    { id: 22, module: 'Policy', name: 'sumAssured', label: 'Sum Assured', status: 'Active', required: true },
    { id: 23, module: 'Policy', name: 'premiumAmount', label: 'Premium Amount', status: 'Active', required: true },
    { id: 24, module: 'Policy', name: 'startDate', label: 'Risk Start Date', status: 'Active', required: true },
    { id: 25, module: 'Policy', name: 'endDate', label: 'Risk End Date', status: 'Active', required: true },
    { id: 26, module: 'Policy', name: 'paymentFrequency', label: 'Payment Frequency', status: 'Active', required: true },
    // Claim
    { id: 27, module: 'Claim', name: 'policyId', label: 'Policy Number / ID', status: 'Active', required: true },
    { id: 28, module: 'Claim', name: 'contactId', label: 'Client / Contact ID', status: 'Active', required: true },
    { id: 29, module: 'Claim', name: 'claimNumber', label: 'Claim Reference Number', status: 'Active', required: true },
    { id: 30, module: 'Claim', name: 'claimType', label: 'Claim Type / Category', status: 'Active', required: true },
    { id: 31, module: 'Claim', name: 'claimAmount', label: 'Claimed Amount', status: 'Active', required: true },
    { id: 32, module: 'Claim', name: 'intimatedAt', label: 'Intimation Date', status: 'Active', required: true },
    // Agent
    { id: 5, module: 'Agent', name: 'agent_name', label: 'Agent Name', status: 'Active', required: true },
    { id: 6, module: 'Agent', name: 'agency_code', label: 'Agency Code', status: 'Optional', required: false },
    // Hospital
    { id: 7, module: 'Hospital', name: 'hospital_name', label: 'Hospital Name', status: 'Active', required: true },
    { id: 8, module: 'Hospital', name: 'city', label: 'City', status: 'Active', required: true },
  ];
  const [fieldRules, setFieldRules] = useState<Rule[]>(initialFieldRules);`;

  const rplRulesBlock = `  const qc = useQueryClient();

  const { data: compulsoryRulesRes } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const updateCompulsoryMutation = useMutation({
    mutationFn: (rulesList: any[]) => insuranceService.updateCompulsoryRules(rulesList),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compulsory-rules'] });
      toast.success('Compulsory rules updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update rules');
    }
  });

  const fieldRules = useMemo(() => {
    const modules = [
      { name: 'Contact', schema: contactFormSchema, critical: ['firstName', 'phone'] },
      { name: 'Leads', schema: leadFormSchema, critical: ['firstName', 'phone'] },
      { name: 'Policy', schema: policyFormSchema, critical: ['contactId', 'planId', 'policyNumber', 'startDate', 'endDate'] },
      { name: 'Claim', schema: claimFormSchema, critical: ['policyId', 'contactId', 'claimNumber', 'claimType', 'intimatedAt'] }
    ];

    const list: Rule[] = [];
    modules.forEach(mod => {
      const keys = Object.keys(mod.schema.shape);
      keys.forEach(key => {
        const fieldLabelMap: Record<string, string> = {
          firstName: "First Name",
          lastName: "Last Name",
          phone: "Phone Number",
          alternatePhone: "Alternate Phone",
          email: "Email Address",
          gender: "Gender",
          dateOfBirth: "Date of Birth",
          panNumber: "PAN Number",
          aadhaarNumber: "Aadhaar Number",
          annualIncome: "Annual Income",
          notes: "Notes",
          tags: "Tags",
          isActive: "Is Active",
          city: "City",
          source: "Source",
          assignedEmployeeId: "Assigned Employee",
          leadStage: "Lead Stage",
          leadStatus: "Lead Status",
          leadType: "Lead Type",
          followUpDate: "Follow-up Date",
          contactId: "Contact ID / Client",
          planId: "Plan ID / Product Name",
          policyNumber: "Policy Number",
          sumAssured: "Sum Assured",
          premiumAmount: "Premium Amount",
          startDate: "Risk Start Date",
          endDate: "Risk End Date",
          paymentFrequency: "Payment Frequency",
          riders: "Riders",
          deductible: "Deductible",
          status: "Status",
          nextDueDate: "Next Due Date",
          maturityDate: "Maturity Date",
          agentCode: "Agent Code",
          firstPremiumDate: "First Premium Date",
          premiumPaymentPeriod: "Premium Payment Period",
          lastPremiumDate: "Last Premium Date",
          emiCase: "EMI Case",
          emiGateway: "EMI Gateway",
          emiDate: "EMI Date",
          emiPremium: "EMI Premium",
          phcRequired: "PHC Required",
          phcAmount: "PHC Amount",
          phcStatus: "PHC Status",
          phcClaimSettled: "PHC Claim Settled",
          firstYearPremium: "First Year Premium",
          secondYearPremium: "Second Year Premium",
          policyId: "Policy ID / Number",
          claimNumber: "Claim Reference Number",
          claimType: "Claim Type / Category",
          claimAmount: "Claimed Amount",
          intimatedAt: "Intimation Date",
          diagnosis: "Diagnosis / Cause of Admission",
          hospital: "Hospital",
          hospitalAddress: "Hospital Address",
          patientName: "Patient Name",
          admissionAt: "Admission Date",
          dischargeAt: "Discharge Date",
          amtHospital: "Hospital Amount",
          amtMedicine: "Medicine Amount",
          amtLab: "Lab Amount",
          amtPreHosp: "Pre-Hospitalization Amount",
          amtPostHosp: "Post-Hospitalization Amount",
          amtOthers: "Other Amount",
          approvedAmount: "Approved Amount",
          deductionsNotes: "Deductions Notes",
          subClaimNo: "Sub Claim Number",
          uiClaimStatus: "Claim Status",
          comment: "Comment",
          insuranceCompanyCategory: "Insurance Company Category",
          insuranceCompany: "Insurance Company",
          insuranceProductName: "Insurance Product Name",
          agentName: "Agent Name",
          deathAdmissionDate: "Death Admission Date",
          causeOfDeath: "Cause of Death",
          dateOfOccurance: "Date of Occurrence",
          dateOfDeath: "Date of Death",
          wasInComa: "Was in Coma",
          deathSumInsured: "Death Sum Insured",
          deathTotalClaimedAmount: "Death Total Claimed Amount",
          deathComment: "Death Comment",
          hospitalName: "Hospital Name",
          hospitalState: "Hospital State",
          hospitalCity: "Hospital City",
          hospitalPincode: "Hospital Pincode",
          hospitalContactNo: "Hospital Contact No"
        };

        const label = fieldLabelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const isProtected = mod.critical.includes(key);

        const defaultRequiredMap: Record<string, string[]> = {
          Contact: ['firstName', 'lastName', 'phone'],
          Leads: ['firstName', 'lastName', 'phone'],
          Policy: ['contactId', 'planId', 'policyNumber', 'sumAssured', 'premiumAmount', 'startDate', 'endDate', 'paymentFrequency'],
          Claim: ['policyId', 'contactId', 'claimNumber', 'claimType', 'claimAmount', 'intimatedAt']
        };
        const defaultRequired = (defaultRequiredMap[mod.name] || []).includes(key);

        const savedRule = compulsoryRules.find(r => r.module === mod.name && r.fieldKey === key);
        const required = isProtected ? true : (savedRule ? savedRule.required : defaultRequired);

        list.push({
          id: \`\${mod.name}-\${key}\`,
          module: mod.name,
          name: key,
          label,
          status: required ? 'Active' : 'Optional',
          required,
          isProtected
        });
      });
    });
    return list;
  }, [compulsoryRules]);`;

// Normalize content to replace the targetRulesBlock
const cleanContent = content.replace(/\r\n/g, '\n');
const cleanTarget = targetRulesBlock.replace(/\r\n/g, '\n');

if (cleanContent.includes(cleanTarget)) {
  const lines = content.split(/\r?\n/);
  const linesTarget = targetRulesBlock.split(/\r?\n/).map(l => l.trim());
  let matchIdx = -1;
  for (let i = 0; i <= lines.length - linesTarget.length; i++) {
    let match = true;
    for (let j = 0; j < linesTarget.length; j++) {
      if (lines[i + j].trim() !== linesTarget[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      matchIdx = i;
      break;
    }
  }
  if (matchIdx !== -1) {
    lines.splice(matchIdx, linesTarget.length, ...rplRulesBlock.split('\n'));
    content = lines.join('\n');
    console.log("Replaced fieldRules definitions successfully.");
  }
} else {
  // Try fallback string replace
  content = content.replace(targetRulesBlock, rplRulesBlock);
}

// 4. Update handleToggleRequired handler
const toggleHandlerTarget = `  const handleToggleRequired = (id: number) => {
    setFieldRules(prev => prev.map(rule => {
      if (rule.id === id) {
        const nextRequired = !rule.required;
        return {
          ...rule,
          required: nextRequired,
          status: nextRequired ? 'Active' : 'Optional',
        };
      }
      return rule;
    }));
    toast.success('Field rule updated successfully!');
  };`;

const toggleHandlerRpl = `  const handleToggleRequired = (ruleId: string) => {
    const rule = fieldRules.find(r => r.id === ruleId);
    if (!rule) return;
    if (rule.isProtected) {
      toast.error('This field is system-critical and cannot be relaxed.');
      return;
    }

    updateCompulsoryMutation.mutate([
      {
        module: rule.module,
        fieldKey: rule.name,
        required: !rule.required
      }
    ]);
  };`;

content = content.replace(toggleHandlerTarget, toggleHandlerRpl);

// 5. Update handleResetCompulsory
const resetHandlerTarget = `  const handleResetCompulsory = () => {
    setFieldRules(initialFieldRules);
    setCompulsorySearch('');
    setCompulsoryModuleFilter('All Modules');
    toast.success('Compulsory fields reset to default');
  };`;

const resetHandlerRpl = `  const handleResetCompulsory = () => {
    const resetList = fieldRules.map(r => ({
      module: r.module,
      fieldKey: r.name,
      required: r.isProtected ? true : (['lastName', 'phone', 'sumAssured', 'premiumAmount', 'paymentFrequency', 'claimAmount', 'claimType'].includes(r.name) ? true : false)
    }));
    updateCompulsoryMutation.mutate(resetList);
    setCompulsorySearch('');
    setCompulsoryModuleFilter('All Modules');
  };`;

content = content.replace(resetHandlerTarget, resetHandlerRpl);

// 6. Disable switch button UI in table if rule is protected
const tableSwitchTarget = `                          <button
                            onClick={() => handleToggleRequired(rule.id)}
                            className={\`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none \${
                              rule.required ? 'bg-primary-600' : 'bg-slate-200'
                            }\`}
                          >`;

const tableSwitchRpl = `                          <button
                            disabled={rule.isProtected}
                            onClick={() => handleToggleRequired(rule.id)}
                            className={\`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none \${
                              rule.isProtected ? 'opacity-50 cursor-not-allowed' : ''
                            } \${
                              rule.required ? 'bg-primary-600' : 'bg-slate-200'
                            }\`}
                          >`;

content = content.replace(tableSwitchTarget, tableSwitchRpl);

fs.writeFileSync(filepath, content, 'utf8');
console.log("Success updating SettingsPanel.tsx!");
