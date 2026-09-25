import { Role } from '@prisma/client';

/**
 * Fixed option lists for `department` and `designation` (D-021). The API
 * rejects anything outside them with a 400, so the forms can offer dropdowns
 * and the dashboard grouping stays tidy. Mirrored in `frontend/src/lib/catalog.ts`;
 * change both together, and keep the seed inside the lists.
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

export type Department = (typeof DEPARTMENTS)[number];
export type Designation = (typeof DESIGNATIONS)[number];

/**
 * Org-structure rule, not an authorization rule: everyone reports to someone
 * except an administrator, who may sit at the top of the tree. Used by the
 * create schema and by `update` (where the effective role and manager are only
 * known once the current row is loaded).
 */
export function requiresManager(role: Role): boolean {
  return role !== Role.ADMIN;
}
