/**
 * Dashboard numbers must be scoped exactly like the employee list. Expected
 * values are computed from the database with the same predicate the policy
 * defines, so the assertions stay true regardless of what other test files
 * have created (D-009).
 */
import request from 'supertest';
import { prisma } from '../../src/utils/prisma';
import { bearer, getApp, loginAs } from '../helpers/app';
import { SEED } from '../helpers/seedUsers';

const app = getApp();

afterAll(async () => {
  await prisma.$disconnect();
});

const stats = (token: string) => request(app).get('/api/dashboard/stats').set(bearer(token));

interface Stats {
  total: number;
  active: number;
  inactive: number;
  byDepartment: { department: string; count: number }[];
}

function expectInternallyConsistent(body: Stats): void {
  expect(body.active + body.inactive).toBe(body.total);
  expect(body.byDepartment.reduce((sum, row) => sum + row.count, 0)).toBe(body.total);
  const names = body.byDepartment.map((row) => row.department);
  expect([...names].sort()).toEqual(names); // sorted ascending
  expect(new Set(names).size).toBe(names.length); // no duplicate departments
}

describe('GET /api/dashboard/stats', () => {
  it('no token → 401', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('ADMIN sees the whole company', async () => {
    const res = await stats(await loginAs('admin'));
    expect(res.status).toBe(200);
    expectInternallyConsistent(res.body);

    const [total, active] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
    ]);
    expect(res.body.total).toBe(total);
    expect(res.body.active).toBe(active);
    expect(res.body.total).toBeGreaterThanOrEqual(16);

    const departments = res.body.byDepartment.map((row: { department: string }) => row.department);
    expect(departments).toEqual(expect.arrayContaining(['Engineering', 'Finance', 'HR', 'Marketing', 'Sales']));
  });

  it('MANAGER sees self + direct reports only', async () => {
    const res = await stats(await loginAs('manager'));
    expect(res.status).toBe(200);
    expectInternallyConsistent(res.body);

    const scope = { OR: [{ id: SEED.manager.employeeId }, { managerId: SEED.manager.employeeId }] };
    const [total, active] = await Promise.all([
      prisma.employee.count({ where: scope }),
      prisma.employee.count({ where: { AND: [scope, { status: 'ACTIVE' }] } }),
    ]);
    expect(res.body.total).toBe(total);
    expect(res.body.active).toBe(active);
    expect(res.body.total).toBeGreaterThanOrEqual(3); // at least self + EMP001 + EMP002

    // Everyone in the manager's seeded team is in Engineering; other files only
    // add Engineering reports under EMP010, so this stays exact.
    expect(res.body.byDepartment).toEqual([{ department: 'Engineering', count: total }]);
  });

  it('EMPLOYEE sees exactly themself', async () => {
    const res = await stats(await loginAs('employee1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 1,
      active: 1,
      inactive: 0,
      byDepartment: [{ department: 'Engineering', count: 1 }],
    });
  });

  it('EMPLOYEE in another department sees only their own department', async () => {
    const res = await stats(await loginAs('employee3')); // Finance
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.byDepartment).toEqual([{ department: 'Finance', count: 1 }]);
  });

  it('a MANAGER’s numbers never include an employee outside the team', async () => {
    // employee3 (Finance) reports to EMP000, not EMP010.
    const res = await stats(await loginAs('manager'));
    const departments = res.body.byDepartment.map((row: { department: string }) => row.department);
    expect(departments).not.toContain('Finance');
  });
});

describe('GET /api/dashboard/recent-joiners (D-022 — company-wide, identical for every role)', () => {
  const recent = (token: string, query = '') => request(app).get(`/api/dashboard/recent-joiners${query}`).set(bearer(token));

  it('no token → 401', async () => {
    const res = await request(app).get('/api/dashboard/recent-joiners');
    expect(res.status).toBe(401);
  });

  it('every role receives exactly the same rows', async () => {
    const [admin, manager, employee] = await Promise.all([
      recent(await loginAs('admin')),
      recent(await loginAs('manager')),
      recent(await loginAs('employee1')),
    ]);
    expect(admin.status).toBe(200);
    expect(manager.body).toEqual(admin.body);
    expect(employee.body).toEqual(admin.body);
    expect(employee.body.items.length).toBe(5);
  });

  it('is newest-first, ACTIVE only, and matches the database', async () => {
    const res = await recent(await loginAs('employee1'), '?limit=20');
    expect(res.status).toBe(200);
    const expected = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
      orderBy: [{ joiningDate: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    expect(res.body.items.map((e: { id: string }) => e.id)).toEqual(expected.map((e) => e.id));
    const dates = res.body.items.map((e: { joiningDate: string }) => e.joiningDate);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('discloses only name, department, designation and joining date', async () => {
    const res = await recent(await loginAs('employee1'));
    for (const item of res.body.items) {
      expect(Object.keys(item).sort()).toEqual(['department', 'designation', 'firstName', 'id', 'joiningDate', 'lastName']);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/@company\.com|phone|managerId|role|status|password/i);
  });

  it('an EMPLOYEE sees people the register still hides from them', async () => {
    // The list is company-wide; the register for employee1 is still just employee1.
    const token = await loginAs('employee1');
    const joiners = await recent(token, '?limit=20');
    const others = joiners.body.items.filter((e: { id: string }) => e.id !== SEED.employee1.employeeId);
    expect(others.length).toBeGreaterThan(0);
    const register = await request(app).get('/api/employees?limit=100').set(bearer(token));
    expect(register.body.items.map((e: { id: string }) => e.id)).toEqual([SEED.employee1.employeeId]);
    const lookup = await request(app).get(`/api/employees/${others[0].id}`).set(bearer(token));
    expect(lookup.status).toBe(403);
  });

  it('validates limit: 0, 21 and a non-number → 400; unknown key → 400', async () => {
    const token = await loginAs('admin');
    for (const query of ['?limit=0', '?limit=21', '?limit=five', '?page=1']) {
      const res = await recent(token, query);
      expect(res.status).toBe(400);
    }
  });
});
