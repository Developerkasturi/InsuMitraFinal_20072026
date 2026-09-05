export function getPolicyStatusDisplay(policy: any): { label: string; badgeClass: string } {
  if (!policy) return { label: 'Inforce', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };

  if (policy.displayStatus) {
    const raw = String(policy.lifecycleStatus || policy.status || '').toUpperCase();
    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (raw === 'RENEWAL_DUE') badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    else if (raw === 'GRACE_PERIOD') badgeClass = 'bg-orange-100 text-orange-800 border-orange-300';
    else if (raw === 'LAPSED') badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
    else if (raw === 'INACTIVE_OLD') badgeClass = 'bg-slate-100 text-slate-600 border-slate-300';
    else badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';

    return { label: policy.displayStatus, badgeClass };
  }

  const rawStatus = String(policy.status || 'ACTIVE').toUpperCase();
  if (rawStatus === 'INACTIVE_OLD') return { label: 'Inactive(Old)', badgeClass: 'bg-slate-100 text-slate-600 border-slate-300' };

  if (!policy.endDate) return { label: 'Inforce', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };

  const end = new Date(policy.endDate);
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const diffDays = Math.round((todayMs - endMs) / (1000 * 60 * 60 * 24));

  if (diffDays < -45) return { label: 'Inforce', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (diffDays >= -45 && diffDays <= 0) return { label: 'Renewal Due', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
  if (diffDays >= 1 && diffDays <= 30) return { label: `Grace Period - Day ${diffDays} of 30`, badgeClass: 'bg-orange-100 text-orange-800 border-orange-300' };
  return { label: 'Lapsed', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' };
}
