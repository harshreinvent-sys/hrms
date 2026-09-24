/**
 * The mandatory authorization scenarios from docs/spec.md §9, plus the extra
 * cases CLAUDE.md requires. Each block names the spec test it covers.
 *
 * Status-code rule under test (D-005): object-level denial is 403. ADMIN gets
 * 404 for an id that does not exist; every other role gets 403 for any id
 * outside their scope, existing or not.
 */
import request from 'supertest';
import { prisma } from '../../src/utils/prisma';
import { bearer, getApp, loginAs } from '../helpers/app';
import { NONEXISTENT_EMPLOYEE_ID, NON_LOGIN_EMPLOYEE_ID, SEED } from '../helpers/seedUsers';

const app = getApp();

let adminToken: string;
let managerToken: string;
let employee1Token: string;

beforeAll(async () => {
  [adminToken, managerToken, employee1Token] = await Promise.all([
    loginAs('admin'),
    loginAs('manager'),
    loginAs('employee1'),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const get = (path: string, token: string) => request(app).get(path).set(bearer(token));

// ---------------------------------------------------------------------------
// Reads: GET /api/employees/:id
// ---------------------------------------------------------------------------

describe('GET /api/employees/:id', () => {
  it('[Spec Test 1] employee1 reads own profile → 200', async () => {
    const res = await get(`/api/employees/${SEED.employee1.employeeId}`, employee1Token);
    expect(res.status).toBe(200);
    expect(res.body.employee).toMatchObject({
      id: 'EMP001',
      email: SEED.employee1.email,
      role: 'EMPLOYEE',
      managerId: 'EMP010',
    });
  });

  it('[Spec Test 2] employee1 reads employee2 → 403', async () => {
    const res = await get(`/api/employees/${SEED.employee2.employeeId}`, employee1Token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(res.body)).not.toContain(SEED.employee2.email);
  });

  it('[Spec Test 4] admin reads employee2 → 200', async () => {
    const res = await get(`/api/employees/${SEED.employee2.employeeId}`, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.employee.id).toBe('EMP002');
  });

  it('[Spec Test 6] manager reads employee3 (outside team) → 403', async () => {
    const res = await get(`/api/employees/${SEED.employee3.employeeId}`, managerToken);
    expect(res.status).toBe(403);
  });

  it('manager reads employee1 (direct report) → 200', async () => {
    const res = await get(`/api/employees/${SEED.employee1.employeeId}`, managerToken);
    expect(res.status).toBe(200);
    expect(res.body.employee.managerId).toBe(SEED.manager.employeeId);
  });

  it('manager reads self → 200', async () => {
    const res = await get(`/api/employees/${SEED.manager.employeeId}`, managerToken);
    expect(res.status).toBe(200);
    expect(res.body.employee.role).toBe('MANAGER');
  });

  it('manager reads a non-login employee outside the team → 403', async () => {
    const res = await get(`/api/employees/${NON_LOGIN_EMPLOYEE_ID}`, managerToken);
    expect(res.status).toBe(403);
  });

  it('employee1 reads their own manager → 403 (self only)', async () => {
    const res = await get(`/api/employees/${SEED.manager.employeeId}`, employee1Token);
    expect(res.status).toBe(403);
  });

  describe('missing vs forbidden (D-005)', () => {
    it('admin reads a nonexistent id → 404', async () => {
      const res = await get(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, adminToken);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('employee1 reads a nonexistent id → 403 (existence undisclosed)', async () => {
      const res = await get(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, employee1Token);
      expect(res.status).toBe(403);
    });

    it('manager reads a nonexistent id → 403 (existence undisclosed)', async () => {
      const res = await get(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, managerToken);
      expect(res.status).toBe(403);
    });

    it('employee1 gets the same body for a real-but-forbidden id and a fake id', async () => {
      const [real, fake] = await Promise.all([
        get(`/api/employees/${SEED.employee2.employeeId}`, employee1Token),
        get(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, employee1Token),
      ]);
      expect(real.status).toBe(403);
      expect(fake.status).toBe(403);
      expect(real.body).toEqual(fake.body);
    });
  });

  it('malformed id → 400 before any lookup', async () => {
    const res = await get('/api/employees/not-an-id', adminToken);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('no token → 401', async () => {
    const res = await request(app).get(`/api/employees/${SEED.employee1.employeeId}`);
    expect(res.status).toBe(401);
  });

  it('never returns a password hash', async () => {
    const res = await get(`/api/employees/${SEED.employee1.employeeId}`, adminToken);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2b\$/);
  });
});

// ---------------------------------------------------------------------------
// Reads: GET /api/employees (list scoping)
// ---------------------------------------------------------------------------

describe('GET /api/employees', () => {
  it('employee sees exactly one record: their own', async () => {
    const res = await get('/api/employees', employee1Token);
    expect(res.status).toBe(200);
    expect(res.body.items.map((e: { id: string }) => e.id)).toEqual(['EMP001']);
    expect(res.body.pagination.total).toBe(1);
  });

  it('manager sees exactly self + direct reports', async () => {
    const res = await get('/api/employees', managerToken);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((e: { id: string }) => e.id).sort();
    expect(ids).toEqual(['EMP001', 'EMP002', 'EMP010']);
    expect(res.body.pagination.total).toBe(3);
  });

  it('admin sees everyone in the seed', async () => {
    const res = await get('/api/employees?limit=100', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(15);
    expect(res.body.items).toHaveLength(15);
  });

  it('a filter can narrow but never widen an employee’s scope', async () => {
    // Sales has employees in the seed; employee1 is in Engineering.
    const res = await get('/api/employees?department=Sales', employee1Token);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('a search cannot pull another employee into a manager’s scope', async () => {
    const res = await get('/api/employees?search=Priya', managerToken); // employee3
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('admin: department filter', async () => {
    const res = await get('/api/employees?department=Engineering&limit=100', adminToken);
    expect(res.status).toBe(200);
    for (const item of res.body.items) expect(item.department).toBe('Engineering');
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it('admin: status filter', async () => {
    const res = await get('/api/employees?status=INACTIVE&limit=100', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(2);
    for (const item of res.body.items) expect(item.status).toBe('INACTIVE');
  });

  it('admin: search matches id, name and email case-insensitively', async () => {
    const byId = await get('/api/employees?search=emp00', adminToken);
    const byName = await get('/api/employees?search=neha', adminToken);
    const byEmail = await get('/api/employees?search=EMPLOYEE2@', adminToken);
    expect(byId.body.pagination.total).toBeGreaterThanOrEqual(10);
    expect(byName.body.items.map((e: { id: string }) => e.id)).toEqual(['EMP001']);
    expect(byEmail.body.items.map((e: { id: string }) => e.id)).toEqual(['EMP002']);
  });

  it('admin: pagination', async () => {
    const page1 = await get('/api/employees?limit=5&page=1', adminToken);
    const page3 = await get('/api/employees?limit=5&page=3', adminToken);
    expect(page1.body.items).toHaveLength(5);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 5, total: 15, totalPages: 3 });
    expect(page3.body.items).toHaveLength(5);
    const ids1 = page1.body.items.map((e: { id: string }) => e.id);
    const ids3 = page3.body.items.map((e: { id: string }) => e.id);
    expect(ids1.some((id: string) => ids3.includes(id))).toBe(false);
  });

  it('rejects unknown query parameters', async () => {
    const res = await get('/api/employees?role=ADMIN', adminToken);
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range limit', async () => {
    const res = await get('/api/employees?limit=1000', adminToken);
    expect(res.status).toBe(400);
  });

  it('no token → 401', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/me
// ---------------------------------------------------------------------------

describe('GET /api/me', () => {
  it.each([
    ['admin', 'EMP000', 'ADMIN'],
    ['manager', 'EMP010', 'MANAGER'],
    ['employee1', 'EMP001', 'EMPLOYEE'],
  ] as const)('%s → own record', async (who, id, role) => {
    const token = await loginAs(who);
    const res = await get('/api/me', token);
    expect(res.status).toBe(200);
    expect(res.body.employee.id).toBe(id);
    expect(res.body.employee.role).toBe(role);
  });

  it('no token → 401', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });
});
