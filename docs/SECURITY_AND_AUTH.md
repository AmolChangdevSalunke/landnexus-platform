# Security and Authentication - Slice 2a

Status: implemented and verified on 2026-11-02 (149 tests, smoke tests 17/17 and 13/13).

## How login works
1. `POST /api/v1/auth/login` with username + password.
2. Success returns an **access token** (JWT, 15 minutes) and a **refresh token** (7 days, one-time use).
3. The frontend sends `Authorization: Bearer <access token>` on every API call.
4. When the access token expires, `POST /api/v1/auth/refresh` swaps the refresh token for a new pair (rotation).
5. `POST /api/v1/auth/logout` revokes the refresh token.

Public endpoints: login, refresh, logout, `/actuator/health`, `/actuator/info`. Everything else needs a valid token.

## Safeguards
- Passwords: BCrypt (cost 12); minimum 12 characters with a letter and a digit; at most 72 bytes.
- Login failures are generic ("Invalid username or password") and cost the same time whether or not the user exists.
- 5 wrong passwords lock the account for 15 minutes.
- Refresh tokens are stored only as SHA-256 hashes. Re-using an already-used refresh token ends every session of that user.
- Disabling a user also ends all of their refresh tokens.
- Access tokens are signed HS256 with the secret from the `JWT_SECRET` environment variable (32+ characters) and carry issuer, expiry and the user's role/permission list.
- Permission checks are enforced on the backend (`@PreAuthorize`), never only in the UI.
- Only a SUPER_ADMIN can grant, change or disable a SUPER_ADMIN account; nobody can disable their own account.

## Known limits (be honest in the demo)
- An access token stays valid until it expires (up to 15 minutes) even after the user is disabled or loses a role.
- No per-IP rate limiting yet (only per-account lockout). Login history and audit events arrive in slice 2b.
- Geographic access control (user limited to a State/District) arrives in slice 2b; until then only SUPER_ADMIN and CENTRAL_ADMIN may write master data.

## Interim permission matrix
| Role | MASTER_DATA_READ | MASTER_DATA_WRITE | USER_READ | USER_WRITE |
|---|---|---|---|---|
| SUPER_ADMIN, CENTRAL_ADMIN | yes | yes | yes | yes |
| AUDITOR | yes | - | yes | - |
| All other internal roles | yes | - | - | - |
| CITIZEN | - | - | - | - |

## Endpoints
| Method | Path | Needs |
|---|---|---|
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | public (refresh token in body) |
| POST | `/api/v1/auth/logout` | public (refresh token in body) |
| GET | `/api/v1/auth/me` | any valid token |
| GET | `/api/v1/administration/users`, `/users/{id}`, `/roles` | USER_READ |
| POST | `/api/v1/administration/users` | USER_WRITE |
| PUT | `/api/v1/administration/users/{id}/roles` | USER_WRITE |
| POST | `/api/v1/administration/users/{id}/enable` or `/disable` | USER_WRITE |
| GET | master-data resources | MASTER_DATA_READ |
| POST / PUT | master-data resources, `activate`, `deactivate` | MASTER_DATA_WRITE |

## Environment variables
| Variable | Purpose |
|---|---|
| `DB_PASSWORD` | PostgreSQL password (already in use) |
| `JWT_SECRET` | Signing secret, 32+ random characters. Required: the app refuses to start without it. |
| `LANDNEXUS_ADMIN_USERNAME`, `LANDNEXUS_ADMIN_PASSWORD` | Creates the first SUPER_ADMIN, **only when the users table is empty** |
| `LANDNEXUS_ADMIN_EMAIL` | Optional email for that account |
| `CORS_ALLOWED_ORIGINS` | Browser origins allowed to call the API (default `http://localhost:5173`) |

## Tests added
- Unit: AuthService (lockout, rotation, reuse, expiry, disabled), UserService (escalation rules, duplicates, hashing), BootstrapAdminService, JwtService (round trip, expired, forged, wrong issuer), PasswordPolicy, TokenHasher.
- Integration (real database, real filter chain): 401 without or with a bad token, 403 without permission, public endpoints, full login/refresh/logout flow, lockout, disabled user, role-limited access with a real token.
