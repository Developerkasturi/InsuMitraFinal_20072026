const fs = require('fs');
const path = require('path');

const leadsPath = path.resolve(__dirname, '../../Frontend/src/pages/Leads/index.tsx');
if (fs.existsSync(leadsPath)) {
  let content = fs.readFileSync(leadsPath, 'utf8');

  // Add insuranceService to imports on line 10
  const importTarget = `import { leadsService, contactsService, policiesService, claimsService } from '@api/index';`;
  const importRpl = `import { leadsService, contactsService, policiesService, claimsService, insuranceService } from '@api/index';`;
  
  if (content.includes(importTarget)) {
    content = content.replace(importTarget, importRpl);
  } else {
    // try standard
    content = content.replace(`import { leadsService`, `import { insuranceService, leadsService`);
  }

  // Export schema
  const schemaTargetFull = `const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Min 10 digits'),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  dateOfBirth: z.string().optional(),
  height: z.coerce.number().optional().or(z.literal('')),
  weight: z.coerce.number().optional().or(z.literal('')),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  annualIncome: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.string().optional(),
  isActive: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  leadStage: z.string().optional(),
  leadStatus: z.string().optional(),
  leadType: z.string().optional(),
  followUpDate: z.string().optional(),
});`;

  const schemaRplFull = `export const leadFormSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Min 10 digits'),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  dateOfBirth: z.string().optional(),
  height: z.coerce.number().optional().or(z.literal('')),
  weight: z.coerce.number().optional().or(z.literal('')),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  annualIncome: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.string().optional(),
  isActive: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  leadStage: z.string().optional(),
  leadStatus: z.string().optional(),
  leadType: z.string().optional(),
  followUpDate: z.string().optional(),
});

const schema = leadFormSchema;`;

  if (content.replace(/\r\n/g, '\n').includes(schemaTargetFull.replace(/\r\n/g, '\n'))) {
    content = content.replace(schemaTargetFull, schemaRplFull);
  } else {
    content = content.replace(`const schema = z.object({`, `export const leadFormSchema = z.object({`);
  }

  // Replace useForm line in Leads
  const useFormTarget = `  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({ resolver: zodResolver(schema) });`;
  
  const useFormRpl = `  const { data: compulsoryRulesRes, isLoading: isLoadingRules } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    if (['firstName', 'phone'].includes(key)) return true; // System protected
    const rule = compulsoryRules.find((r: any) => (r.module === 'Lead' || r.module === 'Leads') && r.fieldKey === key);
    if (rule) return rule.required;
    return defaultRequired;
  };

  const activeSchema = useMemo(() => {
    return z.object({
      firstName: isFieldRequired('firstName', true) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      lastName: isFieldRequired('lastName', true) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      phone: isFieldRequired('phone', true) ? z.string().min(10, 'Min 10 digits') : z.string().optional().or(z.literal('')),
      alternatePhone: isFieldRequired('alternatePhone', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      email: isFieldRequired('email', false) ? z.string().email('Invalid email') : z.string().email('Invalid email').optional().or(z.literal('')),
      gender: isFieldRequired('gender', false) ? z.enum(['MALE', 'FEMALE', 'OTHER']).refine(val => !!val, { message: 'Required' }) : z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
      dateOfBirth: isFieldRequired('dateOfBirth', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      height: isFieldRequired('height', false) ? z.coerce.number() : z.coerce.number().optional().or(z.literal('')),
      weight: isFieldRequired('weight', false) ? z.coerce.number() : z.coerce.number().optional().or(z.literal('')),
      panNumber: isFieldRequired('panNumber', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      aadhaarNumber: isFieldRequired('aadhaarNumber', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      annualIncome: isFieldRequired('annualIncome', false) ? z.coerce.number().min(0) : z.coerce.number().min(0).optional().or(z.literal('')),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      tags: isFieldRequired('tags', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      isActive: z.string().optional(),
      city: isFieldRequired('city', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      source: isFieldRequired('source', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadStage: isFieldRequired('leadStage', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadStatus: isFieldRequired('leadStatus', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadType: isFieldRequired('leadType', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      followUpDate: isFieldRequired('followUpDate', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
    });
  }, [compulsoryRules]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({ resolver: zodResolver(activeSchema) });`;

  if (content.includes(useFormTarget)) {
    content = content.replace(useFormTarget, useFormRpl);
  }

  // Replace handleLeadSubmit validation checks
  const leadsValidationTarget = `    if (!personalFields.firstName.trim()) {
      toast.error('First Name is required');
      return;
    }
    if (!personalFields.lastName.trim()) {
      toast.error('Last Name is required');
      return;
    }
    if (!personalFields.whatsappNumber.trim()) {
      toast.error('Mobile Number is required');
      return;
    }
    // Strip known country code prefix before validating (CountryPhoneInput stores code+number together)
    const KNOWN_CODES = ['971','966','974','968','965','973','880','977','234','254','353','91','44','49','33','81','86','94','60','62','63','66','84','27','55','52','39','34','31','41','46','47','45','64','65','61','86','1','7'];
    const rawWaDigits = personalFields.whatsappNumber.trim().replace(/\\D/g, '');
    const sortedCodes = [...KNOWN_CODES].sort((a, b) => b.length - a.length);
    const matchedCode = sortedCodes.find(c => rawWaDigits.startsWith(c));
    const waLocalDigits = matchedCode ? rawWaDigits.slice(matchedCode.length) : rawWaDigits;
    if (!/^\\d{10}$/.test(waLocalDigits) && !/^\\d{10}$/.test(rawWaDigits)) {
      toast.error('Mobile Number must be exactly 10 digits');
      return;
    }
    if (!personalFields.aadhaarNumber.trim()) {
      toast.error('Aadhaar Number is required');
      return;
    }
    if (!/^\\d{12}$/.test(personalFields.aadhaarNumber.trim())) {
      toast.error('Aadhaar Number must be exactly 12 digits');
      return;
    }`;

  const leadsValidationRpl = `    if (!personalFields.firstName.trim()) {
      toast.error('First Name is required');
      return;
    }
    if (isFieldRequired('lastName', true) && !personalFields.lastName.trim()) {
      toast.error('Last Name is required');
      return;
    }
    if (isFieldRequired('phone', true) && !personalFields.whatsappNumber.trim()) {
      toast.error('Mobile Number is required');
      return;
    }
    // Strip known country code prefix before validating (CountryPhoneInput stores code+number together)
    const KNOWN_CODES = ['971','966','974','968','965','973','880','977','234','254','353','91','44','49','33','81','86','94','60','62','63','66','84','27','55','52','39','34','31','41','46','47','45','64','65','61','86','1','7'];
    const rawWaDigits = personalFields.whatsappNumber.trim().replace(/\\D/g, '');
    const sortedCodes = [...KNOWN_CODES].sort((a, b) => b.length - a.length);
    const matchedCode = sortedCodes.find(c => rawWaDigits.startsWith(c));
    const waLocalDigits = matchedCode ? rawWaDigits.slice(matchedCode.length) : rawWaDigits;
    if (personalFields.whatsappNumber.trim() && !/^\\d{10}$/.test(waLocalDigits) && !/^\\d{10}$/.test(rawWaDigits)) {
      toast.error('Mobile Number must be exactly 10 digits');
      return;
    }

    const hasAadhaar = !!personalFields.aadhaarNumber.trim();
    if (isFieldRequired('aadhaarNumber', false) && !hasAadhaar) {
      toast.error('Aadhaar Number is required');
      return;
    }
    if (hasAadhaar && !/^\\d{12}$/.test(personalFields.aadhaarNumber.trim())) {
      toast.error('Aadhaar Number must be exactly 12 digits');
      return;
    }

    // Programmatic dynamic compulsory checks
    const fieldsToCheck = [
      { key: 'alternatePhone', label: 'Alternate Phone', value: personalFields.callingNumber, defaultRequired: false },
      { key: 'email', label: 'Email Address', value: personalFields.email, defaultRequired: false },
      { key: 'gender', label: 'Gender', value: personalFields.gender, defaultRequired: false },
      { key: 'dateOfBirth', label: 'Date of Birth', value: personalFields.dateOfBirth, defaultRequired: false },
      { key: 'panNumber', label: 'PAN Number', value: personalFields.panNumber || personalFields.pan, defaultRequired: false },
      { key: 'annualIncome', label: 'Annual Income', value: personalFields.annualIncome, defaultRequired: false },
      { key: 'city', label: 'City', value: personalFields.city, defaultRequired: false },
      { key: 'source', label: 'Source', value: personalFields.source, defaultRequired: false },
      { key: 'assignedEmployeeId', label: 'Assigned Employee', value: leadInfoFields.assignedEmployeeId, defaultRequired: false },
      { key: 'leadStage', label: 'Lead Stage', value: leadInfoFields.leadStage, defaultRequired: false },
      { key: 'leadStatus', label: 'Lead Status', value: leadInfoFields.leadStatus, defaultRequired: false },
      { key: 'leadType', label: 'Lead Type', value: leadInfoFields.leadType, defaultRequired: false },
      { key: 'followUpDate', label: 'Follow-up Date', value: leadInfoFields.followUpDate, defaultRequired: false }
    ];

    for (const f of fieldsToCheck) {
      if (isFieldRequired(f.key, f.defaultRequired) && (!f.value || String(f.value).trim() === '')) {
        toast.error(f.label + ' is required');
        return;
      }
    }`;

  // Clean strings to do replacement ignoring CRLFs
  const contentClean = content.replace(/\r\n/g, '\n');
  const targetClean = leadsValidationTarget.replace(/\r\n/g, '\n');
  
  if (contentClean.includes(targetClean)) {
    // Match line by line
    const lines = content.split(/\r?\n/);
    const linesTarget = leadsValidationTarget.split(/\r?\n/).map(l => l.trim());
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
      lines.splice(matchIdx, linesTarget.length, ...leadsValidationRpl.split('\n'));
      content = lines.join('\n');
    }
  }

  // Replace Leads labels
  content = content
    .replace(
      `<label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">First Name <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">First Name {isFieldRequired('firstName', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Last Name <span className="text-red-500">*</span></label>`,
      `<label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Last Name {isFieldRequired('lastName', true) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>`,
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Email Address {isFieldRequired('email', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Date of Birth</label>`,
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Date of Birth {isFieldRequired('dateOfBirth', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PAN Number</label>`,
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PAN Number {isFieldRequired('panNumber', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Aadhaar Number</label>`,
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Aadhaar Number {isFieldRequired('aadhaarNumber', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Annual Income</label>`,
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Annual Income {isFieldRequired('annualIncome', false) && <span className="text-red-500">*</span>}</label>`
    )
    .replace(
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">City / Town</label>`,
      `<label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">City / Town {isFieldRequired('city', false) && <span className="text-red-500">*</span>}</label>`
    );

  fs.writeFileSync(leadsPath, content, 'utf8');
  console.log("Success updating Leads page!");
} else {
  console.error("Leads path not found!");
  process.exit(1);
}
