import { format, parseISO } from 'date-fns';

/**
 * Formats a given date (string or Date object) into DD/MM/YYYY format.
 * Examples: 03/03/2026, 12/12/2023
 *
 * @param date - The date to format
 * @param fallback - The string to return if the date is invalid (default: 'N/A')
 */
export function formatDate(date?: string | Date | null, fallback = 'N/A'): string {
  if (!date) return fallback;
  
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd/MM/yyyy');
  } catch (error) {
    return fallback;
  }
}
