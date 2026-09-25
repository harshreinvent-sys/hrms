/**
 * Request-shape rules that need no database (D-021): the fixed department and
 * designation lists, letters-only names, and "a manager is required unless the
 * role is ADMIN" on create. The update-side manager rule needs the current row
 * and is covered in tests/integration/employees.test.ts.
 */
import { createEmployeeSchema, updateEmployeeSchema } from '../../src/modules/employees/employees.schemas';
import { DEPARTMENTS, DESIGNATIONS, requiresManager } from '../../src/modules/employees/employees.catalog';

const valid = {
  firstName: 'Tara',
  lastName: 'Bhat',
  email: 'tara.bhat@company.com',
  department: 'Engineering',
  designation: 'QA Engineer',
  joiningDate: '2026-10-01',
  managerId: 'EMP010',
  password: 'Welcome@12345',
};

const paths = (input: object) => {
  const result = createEmployeeSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('createEmployeeSchema', () => {
  it('accepts the documented example', () => {
    expect(createEmployeeSchema.safeParse(valid).success).toBe(true);
  });

  it.each(DEPARTMENTS)('accepts department %s', (department) => {
    expect(paths({ ...valid, department })).toEqual([]);
  });

  it.each(DESIGNATIONS)('accepts designation %s', (designation) => {
    expect(paths({ ...valid, designation })).toEqual([]);
  });

  it('rejects a department or designation outside the catalog', () => {
    expect(paths({ ...valid, department: 'Ops' })).toEqual(['department']);
    expect(paths({ ...valid, designation: 'Intern' })).toEqual(['designation']);
    expect(paths({ ...valid, department: 'engineering' })).toEqual(['department']);
  });

  it.each([
    ['Anne-Marie', true],
    ["O'Brien", true],
    ['Mary Jane', true],
    ['Neha2', false],
    ['Kulkarni_', false],
    ['-Neha', false],
    ['Neha--Rao', false],
    ['Neha ', true], // trimmed before the pattern runs
    ['', false],
  ])('name %p → %s', (value, ok) => {
    expect(paths({ ...valid, firstName: value }).includes('firstName')).toBe(!ok);
  });

  it('requires a manager for EMPLOYEE and MANAGER, not for ADMIN', () => {
    expect(paths({ ...valid, managerId: undefined })).toEqual(['managerId']);
    expect(paths({ ...valid, managerId: null })).toEqual(['managerId']);
    expect(paths({ ...valid, role: 'MANAGER', managerId: null })).toEqual(['managerId']);
    expect(paths({ ...valid, role: 'ADMIN', managerId: null })).toEqual([]);
    expect(paths({ ...valid, role: 'ADMIN', managerId: undefined })).toEqual([]);
  });
});

describe('updateEmployeeSchema', () => {
  it('applies the same catalog and name rules to partial bodies', () => {
    expect(updateEmployeeSchema.safeParse({ designation: 'Staff Engineer' }).success).toBe(true);
    expect(updateEmployeeSchema.safeParse({ designation: 'CTO' }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ firstName: 'R2D2' }).success).toBe(false);
  });

  it('still accepts managerId: null at the schema level (the service decides by role)', () => {
    expect(updateEmployeeSchema.safeParse({ managerId: null }).success).toBe(true);
  });
});

describe('requiresManager', () => {
  it('is false only for ADMIN', () => {
    expect(requiresManager('ADMIN')).toBe(false);
    expect(requiresManager('MANAGER')).toBe(true);
    expect(requiresManager('EMPLOYEE')).toBe(true);
  });
});
