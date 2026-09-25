# Authorization

This document mirrors `backend/src/policies/employeePolicy.ts`. If the two ever disagree, stop and reconcile — do not silently change either.

Identity comes only from the verified JWT: `req.user = { userId, employeeId, role }`, and `role`/`employeeId` are re-read from the `User` row on every request by `authenticate`. No employee id, role, or user id from the request body or query is ever used to decide who the caller is.

Every authorization decision is a pure function in `employeePolicy.ts`. Nothing else in `backend/src` branches on `role` — the unit tests in `tests/unit/employeePolicy.test.ts` cover every branch with no database.

## Roles

| Role | Sees | Creates | Deletes | Updates |
|---|---|---|---|---|
| `ADMIN` | every employee | yes | yes (soft) | any field on anyone |
| `MANAGER` | self + direct reports | no | no | self: `phone` · direct report: `designation`, `department` |
| `EMPLOYEE` | self only | no | no | self: `phone` |

Plus one deliberate exception for every role: the dashboard's **recent joiners** list is company-wide and identical for everyone, reduced to name, department, designation and joining date (D-022, `recentJoinersWhere`).

"Direct report" is one level: `target.managerId === actor.employeeId`. A manager does not see their reports' reports.

## Policy functions

```
canView(actor, target) → boolean
  ADMIN    → true
  MANAGER  → target.id === actor.employeeId || target.managerId === actor.employeeId
  EMPLOYEE → target.id === actor.employeeId

canCreate(actor) → boolean        actor.role === ADMIN
canDelete(actor) → boolean        actor.role === ADMIN

discloseMissing(actor) → boolean  actor.role === ADMIN
  May an empty lookup be reported as 404? Only ADMIN, who can see every row.

updatableFields(actor, target) → Set<field>          (a fresh Set on every call)
  ADMIN                                → { firstName, lastName, email, phone, department, designation, joiningDate, managerId, role, status }
  MANAGER, target is self              → { phone }
  MANAGER, target.managerId === self   → { designation, department }
  EMPLOYEE, target is self             → { phone }
  anything else                        → ∅

scopeWhere(actor) → Prisma.EmployeeWhereInput
  ADMIN    → {}
  MANAGER  → { OR: [ { id: actor.employeeId }, { managerId: actor.employeeId } ] }
  EMPLOYEE → { id: actor.employeeId }

recentJoinersWhere(actor) → Prisma.EmployeeWhereInput          (D-022 — the one deliberate exception)
  every role → { status: ACTIVE }
  Used only by GET /api/dashboard/recent-joiners, whose projection is id, firstName, lastName,
  department, designation, joiningDate — never email, phone, manager, role or status.
```

## How each endpoint uses them

| Endpoint | Check |
|---|---|
| `GET /api/employees` | `where: { AND: [scopeWhere(actor), ...filters] }` — scoping happens in SQL, never in JS; filters can narrow but never widen |
| `GET /api/employees/:id` | `findFirst({ where: { id, AND: [scopeWhere(actor)] } })` → null: `discloseMissing` ? 404 : 403 → found: `canView` re-asserted |
| `GET /api/me` | `GET /api/employees/:id` with `id = actor.employeeId` — no user-supplied id at all |
| `POST /api/employees` | `canCreate` before anything else; then Employee + User created in one transaction |
| `PUT /api/employees/:id` | fetch as above (inherits 403/404) → `updatableFields` → any body key outside the set → **403** with `details: [field]`, before Prisma is touched; `email`/`status` mirrored onto User (D-015) |
| `DELETE /api/employees/:id` | `canDelete` → fetch as above → soft delete (Employee.status + User.isActive, one transaction) |
| `GET /api/dashboard/stats` | every count and the department `groupBy` carry `scopeWhere(actor)` — the dashboard can never show more than the list |
| `GET /api/dashboard/recent-joiners` | `recentJoinersWhere(actor)` — company-wide, identical rows for every role, reduced projection (D-022). Discloses nothing that unlocks the scoped endpoints: an EMPLOYEE who sees a joiner here still gets 403 on `GET /api/employees/:id` for them |

## Status codes

| Situation | Code |
|---|---|
| No token, malformed, expired, tampered, wrong secret, or user now `isActive = false` | **401** |
| Authenticated but the action or object is outside the actor's rights | **403** |
| `ADMIN` asks for an id that does not exist | **404** |
| `MANAGER` / `EMPLOYEE` asks for an id outside their scope — whether or not it exists | **403** (existence is not disclosed; D-005) |
| Malformed id (`not-an-id`), invalid body, unknown body or query keys | **400** |
| Duplicate email | **409** |
| `managerId` missing, equal to the employee, or would create a reporting cycle; admin deactivating their own account; empty `PUT` body | **400** (business rules, not authorization — they do not depend on role) |

The 403 for a forbidden-but-real id and for a nonexistent id have **identical bodies**, so timing aside, the two are indistinguishable to the caller. `tests/integration/authorization.test.ts` asserts this.

## Mass-assignment guard

`PUT` bodies are validated with a `.strict()` Zod schema (unknown keys → 400), then every remaining key is checked against `updatableFields`. The request is rejected wholesale if any key fails — there is no partial application. `req.body` is never passed to Prisma; the service builds an explicit `data` object from the allowed keys only.

## Soft delete

`DELETE` sets `Employee.status = INACTIVE` and `User.isActive = false` in one transaction and returns 204. It is idempotent, and an admin cannot deactivate their own account (400). `authenticate` re-reads `User.isActive` on every request, so a deactivated user's still-valid JWT is rejected with 401 on its next call.
