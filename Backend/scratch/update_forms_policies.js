const fs = require('fs');
const path = require('path');

const policiesPath = path.resolve(__dirname, '../../Frontend/src/pages/Policies/index.tsx');
if (fs.existsSync(policiesPath)) {
  let content = fs.readFileSync(policiesPath, 'utf8');

  // Add insuranceService to imports
  const importTarget = `import { policiesService, contactsService, plansService } from '@api/index';`;
  const importRpl = `import { policiesService, contactsService, plansService, insuranceService } from '@api/index';`;
  if (content.includes(importTarget)) {
    content = content.replace(importTarget, importRpl);
  } else {
    content = content.replace(`import { policiesService`, `import { insuranceService, policiesService`);
  }

  // Export schemas
  const schemaTarget = `const schema = z.object({`;
  content = content.replace(schemaTarget, `export const policyFormSchema = z.object({`);

  const editSchemaTarget = `const editSchema = z.object({`;
  content = content.replace(editSchemaTarget, `export const policyEditFormSchema = z.object({`);

  // Replace schemas with standard constant assign so we don't break existing references before component
  content = content.replace(`type Form = z.infer<typeof schema>;`, `const schema = policyFormSchema;\nconst editSchema = policyEditFormSchema;\ntype Form = z.infer<typeof schema>;`);

  // Replace useForm calls with dynamic ones
  const useFormTarget = `  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { paymentFrequency: 'YEARLY' },
  });
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, setValue: setEditValue, watch: watchEdit } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });`;

  const useFormRpl = `  const { data: compulsoryRulesRes, isLoading: isLoadingRules } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    if (['contactId', 'planId', 'policyNumber', 'startDate', 'endDate'].includes(key)) return true; // System protected
    const rule = compulsoryRules.find((r: any) => r.module === 'Policy' && r.fieldKey === key);
    if (rule) return rule.required;
    return defaultRequired;
  };

  const activeSchema = useMemo(() => {
    return z.object({
      contactId: isFieldRequired('contactId', true) ? z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a contact') : z.string().optional().or(z.literal('')),
      planId: isFieldRequired('planId', true) ? z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a plan') : z.string().optional().or(z.literal('')),
      policyNumber: isFieldRequired('policyNumber', true) ? z.string().min(1, 'Policy number required') : z.string().optional().or(z.literal('')),
      sumAssured: isFieldRequired('sumAssured', true) ? z.coerce.number().positive('Enter a valid sum assured') : z.coerce.number().optional().or(z.literal('')),
      premiumAmount: isFieldRequired('premiumAmount', true) ? z.coerce.number().positive('Enter a valid premium') : z.coerce.number().optional().or(z.literal('')),
      startDate: isFieldRequired('startDate', true) ? z.string().min(1, 'Start date required') : z.string().optional().or(z.literal('')),
      endDate: isFieldRequired('endDate', true) ? z.string().min(1, 'End date required') : z.string().optional().or(z.literal('')),
      paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
      riders: z.array(z.string()).optional(),
      deductible: isFieldRequired('deductible', false) ? z.string().min(1, 'Required') : z.string().optional(),
      status: z.enum(['ACTIVE', 'EXPIRED', 'LAPSED', 'CANCELLED', 'SURRENDERED']).optional(),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional(),
      nextDueDate: isFieldRequired('nextDueDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      maturityDate: isFieldRequired('maturityDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      agentCode: isFieldRequired('agentCode', false) ? z.string().min(1, 'Required') : z.string().optional(),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional(),
      firstPremiumDate: isFieldRequired('firstPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      premiumPaymentPeriod: isFieldRequired('premiumPaymentPeriod', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      lastPremiumDate: isFieldRequired('lastPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiCase: z.boolean().optional(),
      emiGateway: isFieldRequired('emiGateway', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiDate: isFieldRequired('emiDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiPremium: isFieldRequired('emiPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      phcRequired: z.boolean().optional(),
      phcAmount: isFieldRequired('phcAmount', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      phcStatus: isFieldRequired('phcStatus', false) ? z.string().min(1, 'Required') : z.string().optional(),
      phcClaimSettled: z.boolean().optional(),
      firstYearPremium: isFieldRequired('firstYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      secondYearPremium: isFieldRequired('secondYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
    });
  }, [compulsoryRules]);

  const activeEditSchema = useMemo(() => {
    return z.object({
      status: z.enum(['ACTIVE', 'EXPIRED', 'LAPSED', 'CANCELLED', 'SURRENDERED']),
      premiumAmount: isFieldRequired('premiumAmount', true) ? z.coerce.number().positive('Enter a valid premium') : z.coerce.number().optional().or(z.literal('')),
      sumAssured: isFieldRequired('sumAssured', true) ? z.coerce.number().positive() : z.coerce.number().optional(),
      endDate: isFieldRequired('endDate', true) ? z.string().min(1, 'End date required') : z.string().optional().or(z.literal('')),
      nextDueDate: isFieldRequired('nextDueDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      maturityDate: isFieldRequired('maturityDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
      agentCode: isFieldRequired('agentCode', false) ? z.string().min(1, 'Required') : z.string().optional(),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional(),
      riders: z.array(z.string()).optional(),
      deductible: isFieldRequired('deductible', false) ? z.string().min(1, 'Required') : z.string().optional(),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional(),
      firstPremiumDate: isFieldRequired('firstPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      premiumPaymentPeriod: isFieldRequired('premiumPaymentPeriod', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      lastPremiumDate: isFieldRequired('lastPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiCase: z.boolean().optional(),
      emiGateway: isFieldRequired('emiGateway', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiDate: isFieldRequired('emiDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiPremium: isFieldRequired('emiPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      phcRequired: z.boolean().optional(),
      phcAmount: isFieldRequired('phcAmount', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      phcStatus: isFieldRequired('phcStatus', false) ? z.string().min(1, 'Required') : z.string().optional(),
      phcClaimSettled: z.boolean().optional(),
      firstYearPremium: isFieldRequired('firstYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      secondYearPremium: isFieldRequired('secondYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
    });
  }, [compulsoryRules]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(activeSchema),
    defaultValues: { paymentFrequency: 'YEARLY' },
  });
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, setValue: setEditValue, watch: watchEdit } = useForm<EditForm>({
    resolver: zodResolver(activeEditSchema),
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

  // Update Policies labels to use dynamic asterisks
  content = content
    .replace(
      `<label className="label text-[10px]">Client / Contact Name <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Client / Contact Name {isFieldRequired('contactId', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Plan Name / Product Name <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Plan Name / Product Name {isFieldRequired('planId', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Policy Number <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Policy Number {isFieldRequired('policyNumber', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Sum Assured (₹) <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Sum Assured (₹) {isFieldRequired('sumAssured', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Premium Amount (₹) <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Premium Amount (₹) {isFieldRequired('premiumAmount', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Risk Start Date <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Risk Start Date {isFieldRequired('startDate', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Risk End Date <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px]">Risk End Date {isFieldRequired('endDate', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Deductible</label>`,
      `<label className="label text-[10px]">Deductible {isFieldRequired('deductible', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px]">Assigned Employee</label>`,
      `<label className="label text-[10px]">Assigned Employee {isFieldRequired('assignedEmployeeId', false) && <span className="text-red-500">*</span>}</label>`
    );

  fs.writeFileSync(policiesPath, content, 'utf8');
  console.log("Success updating Policies page!");
} else {
  console.error("Policies path not found!");
  process.exit(1);
}
