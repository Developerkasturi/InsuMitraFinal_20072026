const SENSITIVE_SECRET = /password|token|otp|secret/i;

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateOnly = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (dateOnly) return dateOnly;
    return trimmed;
  }
  return String(value ?? '').trim();
}

function normalizeValue(field: string, value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'N/A' || trimmed.toLowerCase() === '(empty)') return null;
    if (/(date|At)$/i.test(field)) return normalizeDate(trimmed);
    return trimmed;
  }
  if (value instanceof Date) {
    return normalizeDate(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value;
  }
  return value;
}

function displayValue(field: string, value: unknown): string {
  if (value == null) return '(empty)';
  if (SENSITIVE_SECRET.test(field)) return '(hidden)';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'N/A' || trimmed.toLowerCase() === '(empty)') return '(empty)';
    if (/(date|At)$/i.test(field)) return normalizeDate(trimmed);
    return trimmed;
  }
  if (value instanceof Date || (/(date|At)$/i.test(field) && typeof value === 'string')) {
    return normalizeDate(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)';
    return value.map(item => item && typeof item === 'object' ? '(updated)' : String(item)).join(', ');
  }
  if (typeof value === 'object') return '(updated)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).trim();
}

export function activityValuesDiffer(field: string, before: unknown, after: unknown): boolean {
  const normBefore = normalizeValue(field, before);
  const normAfter = normalizeValue(field, after);

  // Both empty: not different
  if (normBefore === null && normAfter === null) return false;
  // One empty, other has value: different
  if (normBefore === null || normAfter === null) return true;

  // Primitives (strings, numbers, booleans)
  if (typeof normBefore !== 'object' && typeof normAfter !== 'object') {
    return String(normBefore).trim() !== String(normAfter).trim();
  }

  return JSON.stringify(normBefore) !== JSON.stringify(normAfter);
}

export function formatActivityChange(
  field: string,
  label: string,
  before: unknown,
  after: unknown,
): string {
  const dispBefore = displayValue(field, before);
  const dispAfter = displayValue(field, after);
  if (dispBefore === dispAfter) return '';
  if (dispBefore === '(empty)' && dispAfter === '(empty)') return '';
  if (dispBefore === '(empty)') return `${label}: ${dispAfter}`;
  return `${label}: ${dispBefore} -> ${dispAfter}`;
}
