const SENSITIVE_FIELD = /aadhaar|pan|phone|email|medical|diagnosis|notes|prescription|surgery|password|token|contactNo|dependentNo/i;

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (dateOnly) return dateOnly;
  }
  return String(value ?? '');
}

function normalizeValue(field: string, value: unknown): unknown {
  if (value == null) return null;
  if (/(date|At)$/i.test(field)) return normalizeDate(value);
  return value;
}

function displayValue(field: string, value: unknown): string {
  if (value == null || value === '') return '(empty)';
  if (SENSITIVE_FIELD.test(field)) return '(hidden)';
  if (value instanceof Date || (/(date|At)$/i.test(field) && typeof value === 'string')) {
    return normalizeDate(value);
  }
  if (Array.isArray(value)) return value.length
    ? value.map(item => item && typeof item === 'object' ? '(updated)' : String(item)).join(', ')
    : '(empty)';
  if (typeof value === 'object') return '(updated)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function activityValuesDiffer(field: string, before: unknown, after: unknown): boolean {
  return JSON.stringify(normalizeValue(field, before) ?? null) !==
    JSON.stringify(normalizeValue(field, after) ?? null);
}

export function formatActivityChange(
  field: string,
  label: string,
  before: unknown,
  after: unknown,
): string {
  if (SENSITIVE_FIELD.test(field)) return label;
  return `${label}: ${displayValue(field, before)} -> ${displayValue(field, after)}`;
}
