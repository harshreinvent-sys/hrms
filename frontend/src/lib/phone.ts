/**
 * Reduce whatever was typed or pasted into a phone field to at most ten
 * digits. A pasted "+91 98450 00001" or "098450 00001" loses its country code
 * or trunk zero rather than its last digits. The API accepts exactly ten digits
 * (`backend/src/modules/employees/employees.schemas.ts`); this only makes the
 * input pleasant, it is not the guard.
 */
export function normalizePhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}
