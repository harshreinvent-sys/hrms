/**
 * Mirror of backend/src/modules/employees/employees.catalog.ts (D-021). The
 * API is the guard — a value outside these lists is a 400 there — so this only
 * decides what the dropdowns offer. Change both files together.
 */
export const DEPARTMENTS = ['Engineering', 'Finance', 'HR', 'Marketing', 'Sales'] as const;

export const DESIGNATIONS = [
  'Account Executive',
  'Content Strategist',
  'Designer',
  'DevOps Engineer',
  'Engineering Manager',
  'Financial Analyst',
  'HR Business Partner',
  'Head of People',
  'Marketing Lead',
  'Payroll Specialist',
  'QA Engineer',
  'Sales Development Rep',
  'Sales Manager',
  'Senior Accountant',
  'Senior Financial Analyst',
  'Senior Software Engineer',
  'Software Engineer',
  'Staff Engineer',
] as const;

/** Same rule as the API: letters, with single spaces, hyphens or apostrophes between parts. */
export const NAME_PATTERN = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
