import os

filepath = r"d:\Infoyashonand_Technology\Insumitra17072026\Frontend\src\pages\Insurance\index.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """  const removeCompany = useMutation({
    mutationFn: (id: string) => insuranceService.deleteCompany(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-companies'] }); setDeleteCompany(null); toast.success('Company deleted'); },
    mutationFn: (planId: string) => insuranceService.deletePlan(planId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-plans', expandedCompany] }); setDeletePlan(null); toast.success('Plan deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete plan'),
  });"""

replacement = """  const removeCompany = useMutation({
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
  });"""

# Normalize line endings to do matching
content_normalized = content.replace('\r\n', '\n').replace('\r', '\n')
target_normalized = target.replace('\r\n', '\n').replace('\r', '\n')

if target_normalized in content_normalized:
    # Try line-by-line fallback directly
    lines_content = content.splitlines()
    lines_target = target.splitlines()
    
    match_idx = -1
    for i in range(len(lines_content) - len(lines_target) + 1):
        match = True
        for j in range(len(lines_target)):
            if lines_content[i+j].strip() != lines_target[j].strip():
                match = False
                break
        if match:
            match_idx = i
            break
            
    if match_idx != -1:
        lines_content[match_idx : match_idx + len(lines_target)] = replacement.splitlines()
        new_content = '\n'.join(lines_content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Success line-by-line!")
    else:
        print("Target found but couldn't replace line-by-line!")
        exit(1)
else:
    print("Target not found at all!")
    exit(1)
