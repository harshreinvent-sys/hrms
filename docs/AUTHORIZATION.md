# Authorization

> **Status:** rules approved in planning; `backend/src/policies/employeePolicy.ts` lands in Slice 3 and must match this document exactly. If the two ever disagree, stop and reconcile — do not silently change either.

Identity comes only from the verified JWT: `req.user = { userId, employeeId, role }`. No employee ID, role, or user ID from the request body or query is ever used to decide who the caller is.

Every authorization decision is a pure function in `employeePolicy.ts`. Nothing else in the backend branches on `role`.

## Roles

| Role | Sees | Creates | Deletes | Updates |
|---|---|---|---|---|
| `ADMIN` | every employee | yes | yes (soft) | any field on anyone |
| `MANAGER` | self + direct reports | no | no | self: `phone` · direct report: `designation`, `department` |
| `EMPLOYEE` | self only | no | no | self: `phone` |

## Policy functions

```
canView(actor, target) → boolean
  ADMIN    → true
  MANAGER  → target.id === actor.employeeId || target.managerId === actor.employeeId
  EMPLOYEE → target.id === actor.employeeId

canCreate(actor) → boolean        actor.role === ADMIN
canDelete(actor) → boolean        actor.role === ADMIN

updatableFields(actor, target) → Set<field>
  ADMIN                                → { firstName, lastName, email, phone, department, designation, joiningDate, managerId, role, status }
  MANAGER, target is self              → { phone }
  MANAGER, target.managerId === self   → { designation, department }
  EMPLOYEE, target is self             → { phone }
  anything else                        → ∅

scopeWhere(actor) → Prisma.EmployeeWhereInput
  ADMIN    → {}
  MANAGER  → { OR: [ { id: actor.employeeId }, { managerId: actor.employeeId } ] }
  EMPLOYEE → { id: actor.employeeId }
```

"Direct report" is one level: `target.managerId === actor.employeeId`. A manager does not see their reports' reports.

## How each endpoint uses them

| Endpoint | Check |
|---|---|
| `GET /api/employees` | `where: { AND: [scopeWhere(actor), filters] }` — scoping happens in SQL, never in JS |
| `GET /api/employees/:id` | `findFirst({ where: { id, AND: scopeWhere(actor) } })`, then `canView` re-asserted |
| `POST /api/employees` | `canCreate` before anything else |
| `PUT /api/employees/:id` | fetch as above (inherits 403/404) → `updatableFields` → any body key outside the set → **403** with `details: [field]`, before Prisma is touched |
| `DELETE /api/employees/:id` | `canDelete` → fetch as above → soft delete |
| `GET /api/me` | same path as `GET /api/employees/:id` with `id = actor.employeeId` |
| `GET /api/dashboard/stats` | every count and `groupBy` carries `scopeWhere(actor)` |

## Status codes

| Situation | Code |
|---|---|
| No token, malformed, expired, tampered, or user now `isActive = false` | **401** |
| Authenticated but the action or object is outside the actor's rights | **403** |
| `ADMIN` asks for an ID that does not exist | **404** |
| `MANAGER` / `EMPLOYEE` asks for an ID outside their scope — whether or not it exists | **403** (existence is not disclosed; see D-005) |
| Validation failure, including unknown body keys | **400** |
| Duplicate email | **409** |

## Mass-assignment guard

`PUT` bodies are validated with a `.strict()` Zod schema (unknown keys → 400), then every remaining key is checked against `updatableFields`. The request is rejected wholesale if any key fails — there is no partial application. `req.body` is never passed to Prisma; the service builds an explicit `data` object from the allowed keys only.

## Soft delete

`DELETE` sets `Employee.status = INACTIVE` and `User.isActive = false` in one transaction and returns 204. The `authenticate` middleware re-reads `User.isActive` on every request, so a deactivated user's still-valid JWT is rejected with 401 on its next call.
