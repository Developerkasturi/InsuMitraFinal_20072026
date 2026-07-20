// ─────────────────────────────────────────────────────────────────────────────
// Queue Constants — single source of truth for all BullMQ queue names.
// Import here rather than scattering string literals across the codebase.
// ─────────────────────────────────────────────────────────────────────────────

/** Policy renewal notifications — daily scan + per-policy notify jobs */
export const POLICY_RENEWAL_QUEUE = 'policy-renewal';

/** Premium payment reminder notifications — daily scan + per-payment jobs */
export const PAYMENT_REMINDER_QUEUE = 'payment-reminder';

/** WhatsApp campaign dispatch — one job per campaign */
export const WHATSAPP_CAMPAIGN_QUEUE = 'whatsapp-campaigns';

/** Generic reminders queue (birthday, follow-up) — kept for backward compat */
export const REMINDER_QUEUE = 'reminders';

// ── Job name enums ────────────────────────────────────────────────────────────

export enum PolicyRenewalJob {
  /** Scheduled daily: scans all tenants for expiring policies */
  SCAN_RENEWALS  = 'scan-renewals',
  /** Triggered per-policy: sends notification to assigned employee */
  NOTIFY_RENEWAL = 'notify-renewal',
}

export enum PaymentReminderJob {
  /** Scheduled daily: scans all tenants for upcoming unpaid premiums */
  SCAN_PAYMENTS  = 'scan-payments',
  /** Triggered per-payment: sends notification to assigned employee */
  NOTIFY_PAYMENT = 'notify-payment',
}

export enum WhatsappCampaignJob {
  /** Triggered by WhatsApp service when a campaign is due for sending */
  SEND_CAMPAIGN = 'send-campaign',
}

export enum ReminderJobType {
  POLICY_RENEWAL   = 'policy-renewal',
  PAYMENT_DUE      = 'payment-due',
  BIRTHDAY_WISH    = 'birthday-wish',
  FOLLOW_UP        = 'follow-up',
  /** Daily scan: finds all contacts whose birthday is today, fans out BIRTHDAY_WISH jobs */
  SCAN_BIRTHDAYS   = 'scan-birthdays',
  /** Daily scan: finds all leads whose follow-up date is today, fans out FOLLOW_UP jobs */
  SCAN_FOLLOW_UPS  = 'scan-follow-ups',
  HEALTH_CHECKUP   = 'health-checkup',
  SCAN_HEALTH_CHECKUPS = 'scan-health-checkups',
  SCAN_FESTIVAL_CAMPAIGNS = 'scan-festival-campaigns',
}
