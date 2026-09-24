# Full-Stack Engineer Assessment

## HR Management System –
### Objective

Build a functional **HR Management System MVP** with a frontend, backend APIs, database, authentication, and role-based/resource-based authorization.

The application should allow HR/Admin users to manage employees while ensuring that employees can access only their own information.

---

## 1. User Roles

The system must support the following roles:

### HR/Admin

* View all employees
* Create employees
* Update employee information
* Deactivate/delete employees
* View employee details

### Manager

* View employees assigned to their team
* View their own profile
* Update permitted information for themselves/team members as applicable

### Employee

* View their own profile
* Update permitted personal information
* Must NOT be able to view another employee's information
* Must NOT be able to create, delete, or modify another employee's record

---

## 2. Authentication

Implement authentication using **JWT or an equivalent secure token-based mechanism**.

The application should provide:

* Login
* Password validation
* Token generation
* Token validation
* Logout/token expiry handling
* Protected APIs

Passwords must not be stored in plain text.

---

## 3. Authorization

Authorization must be enforced at the **backend/API level**.

Do not rely only on hiding buttons or pages in the frontend.

The system should validate both:

* **Role-based access**
* **Resource/object-level access**

### Example

If Employee 1 logs in:

```text
GET /api/employees/EMP001
```

should return Employee 1's information.

However:

```text
GET /api/employees/EMP002
```

should not return Employee 2's information.

The backend should determine the logged-in user's identity from the authenticated token rather than trusting the employee ID supplied by the frontend.

Expected response should be an appropriate authorization response such as:

```text
403 Forbidden
```

or an appropriate `404 Not Found` implementation.

---

# 4. Employee Management

Create an employee module with at least the following fields:

* Employee ID
* First Name
* Last Name
* Email
* Phone
* Department
* Designation
* Joining Date
* Manager
* Role
* Employment Status

Example statuses:

```text
Active
Inactive
```

---

# 5. Required APIs

Implement REST APIs similar to the following:

### Authentication

```http
POST /api/auth/login
```

### Employee APIs

```http
GET /api/employees
GET /api/employees/{id}
POST /api/employees
PUT /api/employees/{id}
DELETE /api/employees/{id}
GET /api/me
```

The exact API structure can be designed by the candidate.

APIs should include:

* Appropriate HTTP methods
* Proper status codes
* Request validation
* Error handling
* Authentication
* Authorization

Swagger/OpenAPI documentation is expected.

---

# 6. Frontend

Build a responsive frontend application.

### Login

Create a login page with:

* Email/username
* Password
* Login
* Error handling

### Dashboard

Display basic information such as:

* Total employees
* Active employees
* Department-wise employee count

Dashboard information should be appropriate to the logged-in user's role.

### Employee List

HR/Admin should be able to:

* View employees
* Search employees
* Filter employees
* View employee details
* Edit employees
* Deactivate employees

### Employee View

Employees should see their own profile.

The UI should not provide access to other employees' profiles.

However, **frontend restrictions alone are not sufficient**; backend authorization must also prevent unauthorized API access.

---

# 7. Database

Use a relational database such as:

* PostgreSQL
* MySQL
* SQL Server

Minimum expected entities:

### Users

```text
UserId
Email
PasswordHash
Role
EmployeeId
IsActive
```

### Employees

```text
EmployeeId
FirstName
LastName
Email
Phone
Department
Designation
JoiningDate
ManagerId
Role
Status
```

The candidate should establish appropriate relationships between the entities.

Database migrations or SQL scripts should be included.

---

# 8. Seed/Test Data

The application should contain test users so that authorization can be demonstrated.

For example:

| User | Role | Access |
| ----------------------------------------------------- | -------- | ------------- |
| [admin@company.com](mailto:admin@company.com) | HR/Admin | All employees |
| [manager@company.com](mailto:manager@company.com) | Manager | Assigned team |
| [employee1@company.com](mailto:employee1@company.com) | Employee | Own data |
| [employee2@company.com](mailto:employee2@company.com) | Employee | Own data |
| [employee3@company.com](mailto:employee3@company.com) | Employee | Own data |

Test credentials should be provided in the README.

---

# 9. Mandatory Authorization Tests

The candidate should demonstrate the following scenarios:

### Test 1 – Employee accessing own profile

```text
Login: employee1@company.com

GET /api/employees/EMP001
```

Expected:

```text
200 OK
```

### Test 2 – Employee accessing another employee

```text
Login: employee1@company.com

GET /api/employees/EMP002
```

Expected:

```text
403 Forbidden
```

or an appropriately designed `404`.

### Test 3 – Employee attempting to create employee

```text
POST /api/employees
```

Expected:

```text
403 Forbidden
```

### Test 4 – HR accessing another employee

```text
Login: admin@company.com

GET /api/employees/EMP002
```

Expected:

```text
200 OK
```

### Test 5 – HR creating employee

Expected:

```text
201 Created
```

### Test 6 – Manager accessing an employee outside their team

Expected:

```text
403 Forbidden
```

or appropriate `404`.

These tests should be demonstrated through **Swagger, Postman, or another API testing tool**.

---

# 10. Technical Expectations

The candidate can choose the technology stack.

Suggested stack:

```text
Frontend: React / Angular / Vue
Backend: .NET / Node.js / Java / Python
Database: PostgreSQL / MySQL / SQL Server
```

The implementation should demonstrate:

* Clean project structure
* REST API design
* Authentication
* Authorization
* Database integration
* Input validation
* Exception/error handling
* Secure password storage
* Environment-based configuration
* API documentation
* Reusable frontend components
* Proper API integration
* Basic logging

---

# 11. Deliverables

The candidate must provide:

1. Frontend source code
2. Backend source code
3. Database scripts/migrations
4. Swagger/OpenAPI documentation
5. Postman collection, if used
6. README
7. Test credentials
8. Instructions to run the application locally

The README should clearly explain:

```text
Prerequisites
Installation
Environment variables
Database setup
Backend startup
Frontend startup
Test users
API documentation
Authorization test scenarios
```

---

# 12. 2-Day Suggested Execution

### Day 1

* Project setup
* Database design
* Authentication
* JWT implementation
* User/role model
* Employee model
* Employee CRUD APIs
* Authorization implementation
* Swagger setup

### Day 2

* Login UI
* Dashboard
* Employee listing
* Employee details
* Add/Edit employee
* API integration
* Role-based UI
* Authorization testing
* Error handling
* README/documentation
* Final bug fixing

---

# Evaluation Focus

The primary focus of the assessment is:

* Full-stack implementation
* API design and quality
* Authentication
* **Backend authorization**
* Role-based access control
* Object/resource-level authorization
* Database design
* Frontend/API integration
* Code quality
* Error handling
* Security practices
