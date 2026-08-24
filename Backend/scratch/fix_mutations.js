const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../../Frontend/src/pages/Insurance/index.tsx');

if (!fs.existsSync(filepath)) {
  console.error("File does not exist: " + filepath);
  process.exit(1);
}

const content = fs.readFileSync(filepath, 'utf8');

const target = `  const removeCompany = useMutation({
    mutationFn: (id: string) => insuranceService.deleteCompany(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-companies'] }); setDeleteCompany(null); toast.success('Company deleted'); },
    mutationFn: (planId: string) => insuranceService.deletePlan(planId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-plans', expandedCompany] }); setDeletePlan(null); toast.success('Plan deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete plan'),
  });`;

const replacement = `  const removeCompany = useMutation({
    mutationFn: (id: string) => insuranceService.deleteCompany(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-companies'] }); setDeleteCompany(null); toast.success('Company deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete company'),
  });

  const createPlan = useMutation({
    mutationFn: ({ companyId, body }: { companyId: string; body: PlanForm }) => insuranceService.createPlan(companyId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-plans', expandedCompany] }); setPlanModal(null); planForm.reset({ isActive: true, category: 'LIFE' }); toast.success('Plan created'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create plan'),
  });

  const updatePlan = useMutation({
    mutationFn: ({ planId, body }: { planId: string; body: PlanForm }) => insuranceService.updatePlan(planId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-plans', expandedCompany] }); setEditPlan(null); planForm.reset(); toast.success('Plan updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to update plan'),
  });

  const removePlan = useMutation({
    mutationFn: (planId: string) => insuranceService.deletePlan(planId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-plans', expandedCompany] }); setDeletePlan(null); toast.success('Plan deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete plan'),
  });

  const createHospitalMutation = useMutation({
    mutationFn: (body: any) => insuranceService.createHospital(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitals-list'] });
      toast.success('Hospital created successfully');
      setHospitalModal(false);
      setHospitalForm({
        name: '',
        address: '',
        city: '',
        pincode: '',
        contactNo: '',
        type: 'Network',
        claimsPerson1Name: '',
        claimsPerson1Contact: '',
        claimsPerson2Name: '',
        claimsPerson2Contact: '',
        comment: ''
      });
      setHospitalDoctors([]);
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create hospital'),
  });

  const removeHospitalMutation = useMutation({
    mutationFn: (id: string) => insuranceService.deleteHospital(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitals-list'] });
      toast.success('Hospital deleted successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete hospital'),
  });`;

// Helper function to normalize text (ignore carriage returns, normalize whitespace)
function clean(str) {
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

const cleanedContent = clean(content);
const cleanedTarget = clean(target);

if (cleanedContent.includes(cleanedTarget)) {
  const linesContent = content.split(/\r?\n/);
  const linesTarget = target.split(/\r?\n/).map(l => l.trim());

  let matchIdx = -1;
  for (let i = 0; i <= linesContent.length - linesTarget.length; i++) {
    let match = true;
    for (let j = 0; j < linesTarget.length; j++) {
      if (linesContent[i + j].trim() !== linesTarget[j]) {
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
    linesContent.splice(matchIdx, linesTarget.length, ...replacement.split('\n'));
    fs.writeFileSync(filepath, linesContent.join('\n'), 'utf8');
    console.log("Success replacing via clean line match!");
  } else {
    console.error("Match index not found despite include check!");
    process.exit(1);
  }
} else {
  console.error("Cleaned target not found in cleaned content!");
  process.exit(1);
}
