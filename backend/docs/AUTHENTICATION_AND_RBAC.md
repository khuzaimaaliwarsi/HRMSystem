# iSysware HRMS — Secure Authentication, Sessions & Server-Side RBAC (Batch 3)

**Version:** 1.0  
**Target:** PostgreSQL 18.6 (`aliyan_hrms_dev`) + Node.js / Express.js  
**Security Framework:** Argon2id + Short-Lived JWT + SHA-256 Hashed Refresh Tokens + Replay Detection  

---

## 1. Authentication Architecture

The iSysware HRMS backend implements a bank-grade, session-backed authentication architecture:

```
[Client (React / cURL / Native)]
   │
   ├── 1. POST /api/v1/auth/login { identifier, password }
   │      │
   │      ▼
   │   [Express + Rate Limiter] (10 attempts / 15m)
   │      │
   │      ├── Look up User by username OR email
   │      ├── Check isActive & lockedUntil (lockout after 5 failed attempts)
   │      ├── Verify Argon2id password hash
   │      ├── Create 48-byte cryptographically random refresh token
   │      ├── Compute SHA-256 hash -> Store in PostgreSQL `sessions` table
   │      ├── Generate short-lived signed JWT access token (15m expiry)
   │      └── Log LOGIN_SUCCESS in PostgreSQL `audit_logs`
   │
   ▼
[200 OK Response]
   ├── Body: { success: true, data: { user, accessToken, refreshToken, expiresAt } }
   └── Headers: Set-Cookie: access_token=... (HttpOnly, SameSite)
                Set-Cookie: refresh_token=... (HttpOnly, SameSite)
```

### Password Hashing
- Algorithm: **Argon2id** (`argon2.argon2id`)
- Parameters: 64 MB memory cost (`memoryCost: 65536`), 3 time iterations (`timeCost: 3`), parallelism: 1.
- Passwords are never stored or logged in plain text.

### Token & Session Lifecycle
1. **Access Tokens**:
   - Short-lived JSON Web Tokens (default expiry: `15m`).
   - Signed with `JWT_SECRET` (HMAC SHA-256).
   - Claims payload: `{ sub: userId, role, employeeId, email, username }`.
   - Verified statelessly via `verifyAccessToken(token)`.
2. **Refresh Tokens & Server-Side Sessions**:
   - 48-byte cryptographically random tokens (`crypto.randomBytes(48).toString('hex')`).
   - Stored in PostgreSQL `sessions` table **ONLY as SHA-256 hashes** (`tokenHash`). Even if the database is read, raw refresh tokens cannot be recovered.
   - Long-lived (default: `7 days`).
3. **Token Rotation & Replay / Theft Detection**:
   - Each time `/api/v1/auth/refresh` is called, the old session is marked revoked (`revokedAt = now()`) and a fresh session with a new token is created atomically in a transaction.
   - **Replay Detection Guard**: If a request presents an already revoked refresh token (indicating token theft or man-in-the-middle replay), the system **immediately revokes all active sessions for that user** and logs a `TOKEN_THEFT_DETECTED` security audit event.
4. **Session Revocation**:
   - `POST /api/v1/auth/logout`: Revokes the specific presented session.
   - `POST /api/v1/auth/logout-all`: Revokes all sessions for the authenticated user across all devices.

---

## 2. Five-Portal Server-Side RBAC

Client-side route guards alone do not replace backend security. The server evaluates five distinct portal roles on every protected endpoint:

| Role Enum | Allowed Portal Routes | Authorization Scope |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | `/super-admin/*` | Global company-wide authority over all departments, policies, and users. |
| `HR_ADMIN` | `/hr-admin/*` | Global operations, recruitment, employee records, payroll preparation. |
| `DEPT_MANAGER` | `/manager/*` | Authorized department scope: direct reports and department teams. |
| `TEAM_LEAD` | `/team-lead/*` | Assigned team(s) operational roster and direct reports. |
| `EMPLOYEE` | `/employee/*` | Personal self-service only (`req.user.employeeId === targetEmployeeId`). |

### Middleware Suite (`src/middleware/auth.js`)
- `authenticate`: Extracts Bearer token or cookie, verifies JWT signature and expiry, validates active user status in DB, attaches `req.user`.
- `requireRoles(...allowedRoles)`: Strictly blocks unauthorized roles with HTTP 403 Forbidden.
- `requireEmployeeScope()`: Dynamically verifies that a Manager or Team Lead has jurisdiction over the target employee, and enforces that Employees can only view their own personal records.
- `antiSelfApproval()`: Strictly blocks an employee, lead, or manager from approving, endorsing, or regularizing their own requests (`SELF_APPROVAL_PROHIBITED`).
- `protectSuperAdminTarget()`: Prevents non-Super-Admin roles from mutating or demoting protected Super Admin records, and guards against deactivating the last remaining active protected Super Admin (`LAST_ADMIN_PROTECTED`).

---

## 3. Protected Super Admin Bootstrap

To guarantee a clean, unpolluted database without hardcoded accounts:
- Initial bootstrap can be triggered via CLI:
  ```bash
  npm --prefix backend run admin:bootstrap
  ```
- Or via protected endpoint:
  ```bash
  POST /api/v1/auth/bootstrap-admin
  ```
- **Idempotency Guarantee**: If any protected Super Admin already exists in `aliyan_hrms_dev`, the bootstrap procedure immediately aborts without overwriting or modifying the existing credentials.

---

## 4. Global Sonner Notification Contract

Responses conform to a structured contract compatible with React Sonner toasts:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "message": "Login successful"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password",
    "details": null
  }
}
```
Standard error codes: `UNAUTHORIZED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `FORBIDDEN`, `FORBIDDEN_SCOPE`, `SELF_APPROVAL_PROHIBITED`, `PROTECTED_ACCOUNT_VIOLATION`, `LAST_ADMIN_PROTECTED`, `RATE_LIMIT_EXCEEDED`.

