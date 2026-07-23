import api from './api';

/* ─── Contacts ───────────────────────────────────────────────────────────── */
export const contactsService = {
  list:              (params?: Record<string, any>) => api.get('/contacts',                   { params }).then(r => r.data),
  get:               (id: string)                   => api.get(`/contacts/${id}`).then(r => r.data),
  create:            (body: any)                    => api.post('/contacts', body).then(r => r.data),
  createFull:        (body: any)                    => api.post('/contacts/full', body).then(r => r.data),
  bulkImport:        (body: any)                    => api.post('/contacts/bulk', body).then(r => r.data),
  update:            (id: string, body: any)        => api.patch(`/contacts/${id}`, body).then(r => r.data),
  remove:            (id: string)                   => api.delete(`/contacts/${id}`).then(r => r.data),
  stats:             ()                             => api.get('/contacts/stats').then(r => r.data),
  birthdays:         (days = 30)                    => api.get('/contacts/upcoming-birthdays', { params: { days } }).then(r => r.data),
  exportCsv:         ()                             => api.get('/contacts/export', { responseType: 'blob' }).then(r => r.data),
  bulkTag:           (body: any)                    => api.post('/contacts/bulk-tag', body).then(r => r.data),
  bulkDelete:        (body: any)                    => api.post('/contacts/bulk-delete', body).then(r => r.data),
  addAddress:        (id: string, body: any)        => api.post(`/contacts/${id}/addresses`, body).then(r => r.data),
  removeAddress:     (id: string, addrId: string)   => api.delete(`/contacts/${id}/addresses/${addrId}`).then(r => r.data),
  addOccupation:     (id: string, body: any)        => api.post(`/contacts/${id}/occupations`, body).then(r => r.data),
  removeOccupation:  (id: string, occId: string)    => api.delete(`/contacts/${id}/occupations/${occId}`).then(r => r.data),
  addRelationship:   (id: string, body: any)        => api.post(`/contacts/${id}/relationships`, body).then(r => r.data),
  removeRelationship:(id: string, relId: string)    => api.delete(`/contacts/${id}/relationships/${relId}`).then(r => r.data),
  activity:          (id: string, params?: any)     => api.get(`/contacts/${id}/activity`, { params }).then(r => r.data),
  inviteToPortal:    (id: string)                   => api.post(`/contacts/${id}/invite`).then(r => r.data),
  updateContactRole: (id: string, arg2: any, arg3?: any) => {
    const body = Array.isArray(arg2) ? { permissions: arg2, role: arg3 ?? 'CONTACT' } : arg2;
    return api.patch(`/contacts/${id}/role`, body).then(r => r.data);
  },
  importCsv:         (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/contacts/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  logInteraction:    (id: string, body: any) => api.post(`/contacts/${id}/interaction`, body).then(r => r.data),
};

/* ─── Leads ──────────────────────────────────────────────────────────────── */
export const leadsService = {
  list:            (params?: Record<string, any>) => api.get('/leads',       { params }).then(r => r.data),
  kanban:          (params?: Record<string, any>) => api.get('/leads/board', { params }).then(r => r.data),
  get:             (id: string)                   => api.get(`/leads/${id}`).then(r => r.data),
  create:          (body: any)                    => api.post('/leads', body).then(r => r.data),
  update:          (id: string, body: any)        => api.put(`/leads/${id}`, body).then(r => r.data),
  patch:           (id: string, body: any)        => api.patch(`/leads/${id}`, body).then(r => r.data),
  moveStage:       (id: string, stage: string)    => api.patch(`/leads/${id}/stage`, { stage }).then(r => r.data),
  remove:          (id: string)                   => api.delete(`/leads/${id}`).then(r => r.data),
  addConsultation: (id: string, body: { notes: string; scheduledAt?: string }) =>
    api.post(`/leads/${id}/consultations`, body).then(r => r.data),
  updateAssignee:  (id: string, assignedEmployeeId: string | null) =>
    api.patch(`/leads/${id}/assignee`, { assignedEmployeeId }).then(r => r.data),
  importCsv:   (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/leads/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  getRenewalWindow: () => api.get('/leads/config/renewal-window').then(r => r.data),
};

/* ─── Policies ───────────────────────────────────────────────────────────── */
export const policiesService = {
  list:             (params?: Record<string, any>) => api.get('/policies',       { params }).then(r => r.data),
  plans:            (search?: string)              => api.get('/policies/plans', { params: search ? { search } : {} }).then(r => r.data),
  get:              (id: string)                   => api.get(`/policies/${id}`).then(r => r.data),
  create:           (body: any)                    => api.post('/policies', body).then(r => r.data),
  update:           (id: string, body: any)        => api.patch(`/policies/${id}`, body).then(r => r.data),
  remove:           (id: string)                   => api.delete(`/policies/${id}`).then(r => r.data),
  addPayment:       (id: string, body: any)        => api.post(`/policies/${id}/payments`, body).then(r => r.data),
  upcomingRenewals: (days = 30)                    => api.get('/policies', { params: { status: 'ACTIVE', limit: 10, sortBy: 'endDate', sortOrder: 'asc', endDateTo: new Date(Date.now() + days * 86400000).toISOString() } }).then(r => r.data),
  addMember:        (id: string, body: any)          => api.post(`/policies/${id}/members`, body).then(r => r.data),
  removeMember:     (id: string, memberId: string)   => api.delete(`/policies/${id}/members/${memberId}`).then(r => r.data),
  addNominee:       (id: string, body: any)          => api.post(`/policies/${id}/nominees`, body).then(r => r.data),
  removeNominee:    (id: string, nomineeId: string)  => api.delete(`/policies/${id}/nominees/${nomineeId}`).then(r => r.data),
  importCsv:        (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/policies/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  bulkAssign:       (ids: string[], assignedEmployeeId: string | null) => api.post('/policies/bulk-assign', { ids, assignedEmployeeId }).then(r => r.data),
};

/* ─── Claims ─────────────────────────────────────────────────────────────── */
export const claimsService = {
  list:        (params?: Record<string, any>) => api.get('/claims',    { params }).then(r => r.data),
  get:         (id: string)                   => api.get(`/claims/${id}`).then(r => r.data),
  create:      (body: any)                    => api.post('/claims', body).then(r => r.data),
  update:      (id: string, body: any)        => api.patch(`/claims/${id}`, body).then(r => r.data),
  updateStatus:(id: string, payload: string | { status: string; [key: string]: any }) => {
    const body = typeof payload === 'string' ? { status: payload } : payload;
    return api.patch(`/claims/${id}/status`, body).then(r => r.data);
  },
  remove:      (id: string)                   => api.delete(`/claims/${id}`).then(r => r.data),
  summary:     ()                             => api.get('/claims/summary').then(r => r.data),
  addExpense:  (id: string, body: any)        => api.post(`/claims/${id}/expenses`, body).then(r => r.data),
  removeExpense:(id: string, expenseId: string) => api.delete(`/claims/${id}/expenses/${expenseId}`).then(r => r.data),
  importCsv:   (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/claims/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
};


/* ─── Employees ──────────────────────────────────────────────────────────── */
export const employeesService = {
  list:        (params?: Record<string, any>) => api.get('/employees',    { params }).then(r => r.data),
  create:      (body: any)                    => api.post('/employees', body).then(r => r.data),
  get:         (id: string)                   => api.get(`/employees/${id}`).then(r => r.data),
  update:      (id: string, body: any)        => api.put(`/employees/${id}`, body).then(r => r.data),
  deactivate:  (id: string)                   => api.delete(`/employees/${id}`).then(r => r.data),
  stats:       (id: string)                   => api.get(`/employees/${id}/stats`).then(r => r.data),
  tasks:       (id: string)                   => api.get(`/employees/${id}/tasks`).then(r => r.data),
  addTask:     (id: string, body: any)        => api.post(`/employees/${id}/tasks`, body).then(r => r.data),
  dailyLog:    (id: string, body: any)        => api.post(`/employees/${id}/log`, body).then(r => r.data),
  getLogs:     (id: string, params?: { startDate?: string; endDate?: string }) => api.get(`/employees/${id}/logs`, { params }).then(r => r.data),
  updateRole:  (id: string, body: { role: string; permissions?: string[] }) => api.patch(`/employees/${id}/role`, body).then(r => r.data),
  getEmployeeDetail: (id: string) => api.get(`/employees/${id}`).then(r => r.data),
  createEmployeeTask: (id: string, body: any) => api.post(`/employees/${id}/tasks`, body).then(r => r.data),
  updateEmployeeProfile: (id: string, body: any) => api.put(`/employees/${id}`, body).then(r => r.data),
  getEmployeeLogs: (id: string, params?: { startDate?: string; endDate?: string }) => api.get(`/employees/${id}/logs`, { params }).then(r => r.data),
  // Employee personal dashboard endpoints
  getTasks:         (params?: any)            => api.get('/employees/tasks/list', { params }).then(r => r.data),
  createTask:       (body: any)               => api.post('/employees/tasks', body).then(r => r.data),
  updateTaskStatus: (taskId: string, status: string) => api.patch(`/employees/tasks/${taskId}/status`, { status }).then(r => r.data),
  getDailyLogs:     (params?: any)            => api.get('/employees/logs/daily', { params }).then(r => r.data),
  upsertDailyLog:   (body: any)               => api.post('/employees/logs/daily', body).then(r => r.data),
};



/* ─── Commissions ────────────────────────────────────────────────────────── */
export const commissionsService = {
  list:       (params?: Record<string, any>) => api.get('/commissions',            { params }).then(r => r.data),
  overview:   ()                             => api.get('/commissions/overview').then(r => r.data),
  summary:    (yearId: string)               => api.get(`/commissions/summary/${yearId}`).then(r => r.data),
  create:     (body: any)                    => api.post('/commissions', body).then(r => r.data),
  markPaid:   (id: string)                   => api.patch(`/commissions/${id}/pay`).then(r => r.data),
  remove:     (id: string)                   => api.delete(`/commissions/${id}`).then(r => r.data),
  years:      ()                             => api.get('/commissions/years').then(r => r.data),
  createYear: (body: any)                    => api.post('/commissions/years', body).then(r => r.data),
};

/* ─── WhatsApp ───────────────────────────────────────────────────────────── */
export const whatsappService = {
  templates:       (params?: any)               => api.get('/whatsapp/templates', { params }).then(r => r.data),
  createTemplate:  (body: any)                  => api.post('/whatsapp/templates', body).then(r => r.data),
  deleteTemplate:  (id: string)                 => api.delete(`/whatsapp/templates/${id}`).then(r => r.data),
  campaigns:       (params?: any)               => api.get('/whatsapp/campaigns', { params }).then(r => r.data),
  createCampaign:  (body: any)                  => api.post('/whatsapp/campaigns', body).then(r => r.data),
  launchCampaign:  (id: string)                 => api.post(`/whatsapp/campaigns/${id}/launch`).then(r => r.data),
  scheduleCampaign:(id: string, scheduledAt: string) => api.patch(`/whatsapp/campaigns/${id}/schedule`, { scheduledAt }).then(r => r.data),
  campaignLogs:    (id: string)                 => api.get(`/whatsapp/campaigns/${id}/logs`).then(r => r.data),
  wallet:          ()                           => api.get('/whatsapp/wallet').then(r => r.data),
  topupWallet:     (body: any)                  => api.post('/whatsapp/wallet/topup', body).then(r => r.data),
};

/* ─── Calendar ───────────────────────────────────────────────────────────── */
export const calendarService = {
  list:   (params?: any) => api.get('/calendar', { params }).then(r => r.data),
  create: (body: any)    => api.post('/calendar', body).then(r => r.data),
  update: (id: string, body: any) => api.patch(`/calendar/${id}`, body).then(r => r.data),
  remove: (id: string)  => api.delete(`/calendar/${id}`).then(r => r.data),
};

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
export const dashboardService = {
  kpis:      () => api.get('/dashboard/kpis').then(r => r.data),
  revenue:   (months?: number) => api.get('/dashboard/revenue', { params: { months } }).then(r => r.data),
  portfolio: () => api.get('/dashboard/portfolio').then(r => r.data),
  pipeline:  () => api.get('/dashboard/pipeline').then(r => r.data),
  events:    () => api.get('/dashboard/events').then(r => r.data),
  claims:    () => api.get('/dashboard/claims').then(r => r.data),
  dbSummary: () => api.get('/dashboard/db-summary').then(r => r.data),
};

/* ─── Subscriptions ──────────────────────────────────────────────────────── */
export const subscriptionsService = {
  plans:   ()              => api.get('/subscriptions/plans').then(r => r.data),
  current: ()              => api.get('/subscriptions/current').then(r => r.data),
  upgrade: (planId: string)=> api.post(`/subscriptions/upgrade/${planId}`).then(r => r.data),
  billing: ()              => api.get('/subscriptions/billing').then(r => r.data),
};

/* ─── Notifications ──────────────────────────────────────────────────────── */
export const notificationsService = {
  list:        (params?: any) => api.get('/notifications', { params }).then(r => r.data),
  markRead:    (id: string)   => api.patch(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: ()             => api.patch('/notifications/read-all').then(r => r.data),
};

/* ─── Documents ──────────────────────────────────────────────────────────── */
export const documentsService = {
  list:   (params?: any) => api.get('/documents', { params }).then(r => r.data),
  url:    (id: string)   => api.get(`/documents/${id}/url`).then(r => r.data),
  remove: (id: string)   => api.delete(`/documents/${id}`).then(r => r.data),
  upload: (file: File, meta: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/documents/upload', form, {
      params: meta,
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

/* ─── Search ─────────────────────────────────────────────────────────────── */
export const searchService = {
  search: (q: string) => api.get('/search', { params: { q } }).then(r => r.data),
};

/* ─── Insurance Companies & Plans ────────────────────────────────────────── */
export const insuranceService = {
  listCompanies:  ()                           => api.get('/insurance/companies').then(r => r.data),
  createCompany:  (body: any)                  => api.post('/insurance/companies', body).then(r => r.data),
  updateCompany:  (id: string, body: any)      => api.patch(`/insurance/companies/${id}`, body).then(r => r.data),
  deleteCompany:  (id: string)                 => api.delete(`/insurance/companies/${id}`).then(r => r.data),
  listPlans:      (companyId: string)          => api.get(`/insurance/companies/${companyId}/plans`).then(r => r.data),
  createPlan:     (companyId: string, body: any) => api.post(`/insurance/companies/${companyId}/plans`, body).then(r => r.data),
  updatePlan:     (planId: string, body: any)  => api.patch(`/insurance/plans/${planId}`, body).then(r => r.data),
  deletePlan:     (planId: string)             => api.delete(`/insurance/plans/${planId}`).then(r => r.data),
};

/* ─── Tenant ─────────────────────────────────────────────────────────────── */
export const tenantService = {
  getCurrent: ()           => api.get('/auth/tenants/current').then(r => r.data),
  update:     (body: any)  => api.patch('/auth/tenants/current', body).then(r => r.data),
};

export const agencyDetailsService = {
  findAll: ()                   => api.get('/agency-details').then(r => r.data),
  create:  (body: any)          => api.post('/agency-details', body).then(r => r.data),
  update:  (id: string, body: any) => api.put(`/agency-details/${id}`, body).then(r => r.data),
  remove:  (id: string)         => api.delete(`/agency-details/${id}`).then(r => r.data),
};

export const bannersService = {
  findAll: ()                   => api.get('/banners').then(r => r.data),
  create:  (body: any)          => api.post('/banners', body).then(r => r.data),
  update:  (id: string, body: any) => api.put(`/banners/${id}`, body).then(r => r.data),
  remove:  (id: string)         => api.delete(`/banners/${id}`).then(r => r.data),
};

/* ─── Workspace ──────────────────────────────────────────────────────────── */
export const workspaceService = {
  getData:  ()                   => api.get('/workspace').then(r => r.data),
  clockIn:  ()                   => api.post('/workspace/clock-in').then(r => r.data),
  clockOut: ()                   => api.post('/workspace/clock-out').then(r => r.data),
  saveEod:  (eodData: {
    notes?: string;
    callsMade?: number;
    visitsCompleted?: number;
    premiumCollected?: number;
    nextDayPlan?: string;
  }) => api.post('/workspace/log', eodData).then(r => r.data),
};

/* ─── Feature Feedback ──────────────────────────────────────────────────── */
export const feedbackService = {
  submit:  (message: string, rating?: number) =>
    api.post('/feedback', { message, rating }).then(r => r.data),
  list:    ()  => api.get('/feedback').then(r => r.data),
};

/* ─── Subscription Limits ───────────────────────────────────────────────── */
export const subscriptionLimitsService = {
  contacts:  () => api.get('/subscriptions/limits/contacts').then(r => r.data),
  employees: () => api.get('/subscriptions/limits/employees').then(r => r.data),
};
