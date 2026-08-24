const fs = require('fs');
const path = require('path');

// ═════════════════════════════════════════════════════════════════════════════
// 1. UPDATE CONTACTS PAGE (index.tsx)
// ═════════════════════════════════════════════════════════════════════════════
const contactsPath = path.resolve(__dirname, '../../Frontend/src/pages/Contacts/index.tsx');
if (fs.existsSync(contactsPath)) {
  let content = fs.readFileSync(contactsPath, 'utf8');

  // Add insuranceService to import on line 10
  const importTarget = `import { contactsService, policiesService, claimsService, leadsService } from '@api/index';`;
  const importRpl = `import { contactsService, policiesService, claimsService, leadsService, insuranceService } from '@api/index';`;
  if (content.includes(importTarget)) {
    content = content.replace(importTarget, importRpl);
  }

  // Export schema
  const schemaTarget = `const schema = z.object({`;
  const schemaRpl = `export const contactFormSchema = z.object({\n  // System critical fields (cannot be relaxed)\n  firstName: z.string().min(1, 'Required'),\n  phone: z.string().min(10, 'Min 10 digits'),\n\n  // Configurable fields`;
  
  // Make sure we replace the first z.object keys correctly
  const schemaTargetFull = `const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Min 10 digits'),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  dateOfBirth: z.string().optional(),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  annualIncome: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.string().optional(), // comma-separated, split on submit
  isActive: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  leadStage: z.string().optional(),
  leadStatus: z.string().optional(),
  leadType: z.string().optional(),
  followUpDate: z.string().optional(),
});`;

  const schemaRplFull = `export const contactFormSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Min 10 digits'),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  dateOfBirth: z.string().optional(),
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

const schema = contactFormSchema;`;

  if (content.replace(/\r\n/g, '\n').includes(schemaTargetFull.replace(/\r\n/g, '\n'))) {
    content = content.replace(schemaTargetFull, schemaRplFull);
  } else {
    // Fallback simple replace
    content = content.replace(schemaTarget, `export const contactFormSchema = z.object({`);
  }

  // Replace useForm line with dynamic rules loading
  const useFormTarget = `  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });`;
  
  const useFormRpl = `  const { data: compulsoryRulesRes, isLoading: isLoadingRules } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    if (['firstName', 'phone'].includes(key)) return true; // System protected
    const rule = compulsoryRules.find((r: any) => r.module === 'Contact' && r.fieldKey === key);
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

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(activeSchema) });`;

  if (content.includes(useFormTarget)) {
    content = content.replace(useFormTarget, useFormRpl);
  }

  // Inject validation checks inside handleLeadSubmit in Contacts
  const leadSubmitValidationStart = `    const isDep = !!personalFields?.isDependent;
    const guardianNo = (personalFields?.dependentNo || '').trim();

    if (!firstName) {
      toast.error('First Name is required');
      return;
    }
    if (!lastName) {
      toast.error('Last Name is required');
      return;
    }`;

  const leadSubmitValidationRpl = `    const isDep = !!personalFields?.isDependent;
    const guardianNo = (personalFields?.dependentNo || '').trim();

    if (!firstName) {
      toast.error('First Name is required');
      return;
    }
    if (isFieldRequired('lastName', true) && !lastName) {
      toast.error('Last Name is required');
      return;
    }

    // Programmatic dynamic compulsory checks
    const fieldsToCheck = [
      { key: 'alternatePhone', label: 'Alternate Phone', value: personalFields.callingNumber, defaultRequired: false },
      { key: 'email', label: 'Email Address', value: personalFields.email, defaultRequired: false },
      { key: 'gender', label: 'Gender', value: personalFields.gender, defaultRequired: false },
      { key: 'dateOfBirth', label: 'Date of Birth', value: personalFields.dateOfBirth, defaultRequired: false },
      { key: 'panNumber', label: 'PAN Number', value: personalFields.panNumber || personalFields.pan, defaultRequired: false },
      { key: 'aadhaarNumber', label: 'Aadhaar Number', value: personalFields.aadhaarNumber, defaultRequired: false },
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

  if (content.includes(leadSubmitValidationStart)) {
    content = content.replace(leadSubmitValidationStart, leadSubmitValidationRpl);
  }

  // Update Contacts form labels to use dynamic asterisks
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

  fs.writeFileSync(contactsPath, content, 'utf8');
  console.log("Success updating Contacts page!");
} else {
  console.error("Contacts path not found!");
  process.exit(1);
}
