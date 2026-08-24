const fs = require('fs');
const path = require('path');

const claimsPath = path.resolve(__dirname, '../../Frontend/src/pages/Claims/index.tsx');
if (fs.existsSync(claimsPath)) {
  let content = fs.readFileSync(claimsPath, 'utf8');

  // Add insuranceService to imports on line 10
  const importTarget = `import { claimsService, policiesService, contactsService } from '@api/index';`;
  const importRpl = `import { claimsService, policiesService, contactsService, insuranceService } from '@api/index';`;
  if (content.includes(importTarget)) {
    content = content.replace(importTarget, importRpl);
  } else {
    content = content.replace(`import { claimsService`, `import { insuranceService, claimsService`);
  }

  // Export schemas
  const schemaTarget = `const schema = z.object({`;
  content = content.replace(schemaTarget, `export const claimFormSchema = z.object({`);

  // Replace schemas with standard constant assign so we don't break existing references before component
  content = content.replace(`type Form = z.infer<typeof schema>;`, `const schema = claimFormSchema;\ntype Form = z.infer<typeof schema>;`);

  // Replace useForm calls with dynamic ones
  const useFormTarget = `  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { claimType: 'Cashless', intimatedAt: new Date().toISOString().split('T')[0] },
  });`;

  const useFormRpl = `  const { data: compulsoryRulesRes, isLoading: isLoadingRules } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    if (['policyId', 'contactId', 'claimNumber', 'claimType', 'intimatedAt'].includes(key)) return true; // System protected
    const rule = compulsoryRules.find((r: any) => r.module === 'Claim' && r.fieldKey === key);
    if (rule) return rule.required;
    return defaultRequired;
  };

  const activeSchema = useMemo(() => {
    return z.object({
      policyId: isFieldRequired('policyId', true) ? z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a policy') : z.string().optional().or(z.literal('')),
      contactId: isFieldRequired('contactId', true) ? z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a contact') : z.string().optional().or(z.literal('')),
      claimNumber: isFieldRequired('claimNumber', true) ? z.string().min(1, 'Claim number required') : z.string().optional().or(z.literal('')),
      claimType: isFieldRequired('claimType', true) ? z.string().min(1, 'Select a claim type') : z.string().optional().or(z.literal('')),
      claimAmount: isFieldRequired('claimAmount', true) ? z.coerce.number().min(0) : z.coerce.number().optional().or(z.literal('')),
      intimatedAt: isFieldRequired('intimatedAt', true) ? z.string().min(1, 'Intimation date required') : z.string().optional().or(z.literal('')),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      diagnosis: isFieldRequired('diagnosis', false) ? z.string().min(1, 'Required') : z.string().optional(),
      hospital: isFieldRequired('hospital', false) ? z.string().min(1, 'Required') : z.string().optional(),
      hospitalAddress: isFieldRequired('hospitalAddress', false) ? z.string().min(1, 'Required') : z.string().optional(),
      patientName: isFieldRequired('patientName', false) ? z.string().min(1, 'Required') : z.string().optional(),
      admissionAt: isFieldRequired('admissionAt', false) ? z.string().min(1, 'Required') : z.string().optional(),
      dischargeAt: isFieldRequired('dischargeAt', false) ? z.string().min(1, 'Required') : z.string().optional(),
      amtHospital: z.coerce.number().default(0),
      amtMedicine: z.coerce.number().default(0),
      amtLab: z.coerce.number().default(0),
      amtPreHosp: z.coerce.number().default(0),
      amtPostHosp: z.coerce.number().default(0),
      amtOthers: z.coerce.number().default(0),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional(),
      approvedAmount: z.coerce.number().optional().default(0),
      deductionsNotes: isFieldRequired('deductionsNotes', false) ? z.string().min(1, 'Required') : z.string().optional(),
      subClaimNo: isFieldRequired('subClaimNo', false) ? z.string().min(1, 'Required') : z.string().optional(),
      uiClaimStatus: isFieldRequired('uiClaimStatus', false) ? z.string().min(1, 'Required') : z.string().optional(),
      comment: isFieldRequired('comment', false) ? z.string().min(1, 'Required') : z.string().optional(),
      insuranceCompanyCategory: isFieldRequired('insuranceCompanyCategory', false) ? z.string().min(1, 'Required') : z.string().optional(),
      insuranceCompany: isFieldRequired('insuranceCompany', false) ? z.string().min(1, 'Required') : z.string().optional(),
      insuranceProductName: isFieldRequired('insuranceProductName', false) ? z.string().min(1, 'Required') : z.string().optional(),
      agentName: isFieldRequired('agentName', false) ? z.string().min(1, 'Required') : z.string().optional(),
      deathAdmissionDate: isFieldRequired('deathAdmissionDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      causeOfDeath: isFieldRequired('causeOfDeath', false) ? z.string().min(1, 'Required') : z.string().optional(),
      dateOfOccurance: isFieldRequired('dateOfOccurance', false) ? z.string().min(1, 'Required') : z.string().optional(),
      dateOfDeath: isFieldRequired('dateOfDeath', false) ? z.string().min(1, 'Required') : z.string().optional(),
      wasInComa: isFieldRequired('wasInComa', false) ? z.string().min(1, 'Required') : z.string().optional(),
      deathSumInsured: isFieldRequired('deathSumInsured', false) ? z.string().min(1, 'Required') : z.string().optional(),
      deathTotalClaimedAmount: isFieldRequired('deathTotalClaimedAmount', false) ? z.string().min(1, 'Required') : z.string().optional(),
      deathComment: isFieldRequired('deathComment', false) ? z.string().min(1, 'Required') : z.string().optional(),
      hospitalName: isFieldRequired('hospitalName', false) ? z.string().min(1, 'Required') : z.string().optional(),
      hospitalState: isFieldRequired('hospitalState', false) ? z.string().min(1, 'Required') : z.string().optional(),
      hospitalCity: isFieldRequired('hospitalCity', false) ? z.string().min(1, 'Required') : z.string().optional(),
      hospitalPincode: isFieldRequired('hospitalPincode', false) ? z.string().min(1, 'Required') : z.string().optional(),
      hospitalContactNo: isFieldRequired('hospitalContactNo', false) ? z.string().min(1, 'Required') : z.string().optional(),
    });
  }, [compulsoryRules]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(activeSchema),
    defaultValues: { claimType: 'Cashless', intimatedAt: new Date().toISOString().split('T')[0] },
  });`;

  // Normalize line endings to match safely
  const cleanContent = content.replace(/\r\n/g, '\n');
  const cleanTarget = useFormTarget.replace(/\r\n/g, '\n');

  if (cleanContent.includes(cleanTarget)) {
    const lines = content.split(/\r?\n/);
    const linesTarget = useFormTarget.split(/\r?\n/).map(l => l.trim());
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
      lines.splice(matchIdx, linesTarget.length, ...useFormRpl.split('\n'));
      content = lines.join('\n');
    }
  }

  // Update Claims labels to use dynamic asterisks
  content = content
    .replace(
      `<label className="label text-[10px]">Select Policy <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Select Policy {isFieldRequired('policyId', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Client / Contact Name <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Client / Contact Name {isFieldRequired('contactId', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Claim Reference Number <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Claim Reference Number {isFieldRequired('claimNumber', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Claim Type <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Claim Type {isFieldRequired('claimType', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Claimed Amount (₹) <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Claimed Amount (₹) {isFieldRequired('claimAmount', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Intimation Date <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Intimation Date {isFieldRequired('intimatedAt', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Diagnosis / Cause of Admission</label>`,
      `<label className="label text-[10px]">Diagnosis / Cause of Admission {isFieldRequired('diagnosis', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Hospital City</label>`,
      `<label className="label text-[10px]">Hospital City {isFieldRequired('hospitalCity', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Hospital Pincode</label>`,
      `<label className="label text-[10px]">Hospital Pincode {isFieldRequired('hospitalPincode', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Hospital Contact No</label>`,
      `<label className="label text-[10px]">Hospital Contact No {isFieldRequired('hospitalContactNo', false) && <span className="text-red-500">*</span>}</label>`
    );

  fs.writeFileSync(claimsPath, content, 'utf8');
  console.log("Success updating Claims page!");
} else {
  console.error("Claims path not found!");
  process.exit(1);
}
