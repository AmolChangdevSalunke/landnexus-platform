# 4. Government & External Integration Audit — LandNexus / NLAMS

**Audit date:** 14 November 2026 · **Type:** read-only inspection, configuration review, route/log review
**Scope:** every outbound system named in the product’s own UI, docs or code: PFMS/DBT, ISRO Bhuvan, BhuNaksha, Ferfar/external revenue records, e-mail/SMS providers. Also checks integrations a land-acquisition platform is normally expected to have.

---

## 1. Executive summary

| Integration | Expected by product | Actual implementation | Status |
|---|---|---|---|
| PFMS / DBT payment rail | Real compensation disbursement | `SimulatedPfmsAdapter` only; reference prefix `SIM-PFMS-`; mode `SIMULATED` enforced | **MOCK** |
| ISRO Bhuvan satellite/thematic imagery | Imagery basemap in GIS | Generic OGC WMS proxy, disabled by default, no Bhuvan URL/key/layers shipped | **PARTIAL** |
| BhuNaksha cadastral map import | Import authoritative parcel maps | None — listed only as roadmap | **MISSING** |
| Ferfar / external 7-12, 8A exchange | Fetch authoritative revenue records | None — records are typed in manually | **MISSING** |
| 7/12 extract | Digital revenue record | Manual entry in `revenue_records` (`SEVEN_TWELVE`) | **IMPLEMENTED (manual)** |
| 8A extract | Digital revenue record with khata | Manual entry in `revenue_records` (`EIGHT_A`), khata mandatory | **IMPLEMENTED (manual)** |
| E-mail notifications | Outbound e-mail | `none` (default, disabled) / `log` / `http` adapter | **PARTIAL** |
| SMS notifications | Outbound SMS | same adapter model; no phone stored on `users` | **PARTIAL** |
| Aadhaar / DigiLocker / e-sign | Citizen identity & signed documents | None | **MISSING** |
| Payment gateway / UPI / NEFT | Alternative disbursement | None beyond simulated PFMS | **MISSING** |

**Bottom line:** no government system is actually connected. The codebase deliberately isolates each external seam behind an interface, documents the limitation, and refuses to run in a mode that would pretend otherwise. That is honest engineering, but it means every “government integration” claim in a demo must be labelled simulated.

---

## 2. PFMS / DBT (compensation disbursement) — `MOCK`

**Seam:** `compensation/infrastructure/PaymentGateway.java`

```java
/** The seam to a real payment system (PFMS/DBT). Only the SIMULATED adapter exists... */
record Instruction(UUID paymentId, UUID landownerId, BigDecimal amount) { }
record Receipt(String reference, String mode) { }
```

**Only implementation:** `compensation/infrastructure/SimulatedPfmsAdapter.java`

```java
public static final String MODE = "SIMULATED";
String reference = "SIM-PFMS-" + paymentId.substring(0,8).toUpperCase();
return new Receipt(reference, MODE);
```

**Guard:** `PaymentModeGuard` (compensation infrastructure) refuses any configured mode other than `SIMULATED`; therefore the system cannot accidentally look like it is paying real money. `PaymentService.release` writes a `payment_events` row and the simulated receipt reference.

**What is genuinely implemented around the mock (valuable):**

- Payment records generated from approved valuations, split across owners (`PaymentSplitter`).
- Release requires `PAYMENT_RELEASE`; every state change is audited and append-only (`payment_events`).
- Summary and compensation reporting read from `rpt_compensation`.
- A failure simulation path exists (`PaymentService.simulateResponse(outcome, reason)`) for failed/returned payments.
- The payment instruction intentionally contains **no bank details and no personal data** — bank/beneficiary handling has not been invented.

**What a real integration needs (not present):**

| Need | Present? |
|---|---|
| PFMS sandbox/production credentials | No |
| Beneficiary registration (bank account, IFSC, Aadhaar seeding) | No — no table or endpoint |
| Digital signature of sanction orders | No |
| Payment file/batch format (PFMS upload or API) | No |
| Settlement/reconciliation ingestion | No |
| Reversal/retry against provider response codes | No |
| Idempotency keys beyond payment id | No |

**Evidence trail:** UI wording should say “simulated”. `roadmapModules.ts` contains a `pfms-dbt` roadmap entry (`PFMS/DBT payment adapter`, `Beneficiary and bank validation`, `Settlement and reconciliation feed`, `Failed-payment retry and reversal`) — i.e. the product itself classifies this as planned, not delivered.

---

## 3. ISRO Bhuvan imagery — `PARTIAL`

**Seam:** `gis/imagery/ImageryService.java` + `gis/imagery/ImageryConfig.java`

The implementation is a **generic, validated OGC WMS proxy**, not a Bhuvan client:

| Config property | Default | Meaning |
|---|---|---|
| `landnexus.imagery.enabled` | `false` | feature off by default |
| `landnexus.imagery.provider-name` | `ISRO Bhuvan` | **label only** — no Bhuvan-specific code |
| `landnexus.imagery.base-url` | empty | any WMS endpoint |
| `landnexus.imagery.layers` | empty | WMS layer list |
| `landnexus.imagery.overlay-base-url` / `overlay-layers` | empty | optional second overlay WMS |
| `landnexus.imagery.wms-version` | `1.1.1` | 1.1.1 or 1.3.0 |
| `landnexus.imagery.auth-mode` | `NONE` | `NONE` / `QUERY_PARAM` / `HEADER` |
| `landnexus.imagery.auth-name` / `auth-secret` | `token` / empty | secret never logged/printed |
| `landnexus.imagery.attribution` | empty | attribution string |
| `landnexus.imagery.timeout-seconds` / `max-bytes` | `10` / `5 MiB` | bounds |
| `landnexus.imagery.allow-insecure-http` | `false` | HTTPS enforced |

**Positive security properties (verified in code):**

- `validate()` fails fast on a half-configured server; no silent fallback.
- URL must be `https` unless insecure explicitly enabled.
- `toString()` prints only `enabled` + provider name — the secret cannot leak through logging.
- Auth mode restricted to `NONE`, `QUERY_PARAM`, `HEADER`; header name restricted to a simple token.
- Response size and timeout bounded.

**What is missing for a real Bhuvan integration:**

- No Bhuvan endpoint, key, layer IDs, licence terms or attribution text shipped.
- No WMS `GetCapabilities` discovery or layer validation against the real service.
- No tile cache / offline fallback (the roadmap lists “Offline tile fallback”).
- No imagery date/resolution metadata surfaced to users.
- The GIS workspace itself uses a custom SVG `ScopeMap`, so imagery is an optional overlay rather than the basemap.
- `ImageryStatusCard.tsx` shows configuration status in the UI.

**Verdict:** the *plumbing* is real and well-guarded; the *Bhuvan integration* is not configured and not proven against the live service. Any claim of “Bhuvan integrated” is unsupported.

---

## 4. BhuNaksha cadastral import — `MISSING`

No code, endpoint, parser, table or job exists. The only reference is the roadmap entry `bhunaksha` in `LandNexus-frontend/src/app/roadmapModules.ts`:

```
'BhuNaksha map service connection'
'Parcel boundary import and reconciliation'
'Survey-number matching'
'Conflict review against entered geometry'
```

Parcel geometry can be entered manually as GeoJSON (`GisService.setParcelBoundary`) and versioned, which is the *target* of an import but not an import.

---

## 5. Ferfar / external revenue records — `MISSING`

| Requirement | Reality |
|---|---|
| Fetch 7/12 from state land-records service | Manual entry only (`RevenueRecordType.SEVEN_TWELVE`) |
| Fetch 8A / khata | Manual entry only (`EIGHT_A`, khata required) |
| Ferfar (mutation) sync | Not modelled; local `parcel_mutations` only |
| Any HTTP client for a land-records service | None found |

The roadmap lists `external-land-records` (“External 7/12, 8A and Ferfar services”) as planned. Record fields, provenance (`sourceNote`-style) and manual verification exist, but there is no machine exchange.

---

## 6. Notification providers (e-mail / SMS) — `PARTIAL`

**Implementation:** `shared/notification/*`

| Piece | Behaviour |
|---|---|
| `NotificationService.notify` | writes in-app `notifications` row + outbox rows in the same transaction |
| `NotificationOutbox` / `notification_deliveries` (V19) | one row per notification × channel, with status, attempts, `next_attempt_at` |
| `NotificationDispatcher` | bounded batch (25), retries with backoff, masks destinations in logs |
| `DisabledNotificationAdapter` | default `none` — channel disabled, no network call |
| `LogNotificationAdapter` | writes to log only (dev) |
| `HttpNotificationAdapter` | generic HTTP POST to a configured provider URL |
| `ContactMasker` | masks e-mail/phone in logs and delivery views |
| `notification_contacts` (V19) | optional per-user e-mail/phone + channel toggles |

**Gaps:**

- No SMTP/provider account configured; default is disabled.
- No user-facing contact/preference screen: `notification_contacts` has a repository but no controller or page.
- No delivery console page, although backend list/retry endpoints exist under `SETTINGS_MANAGE`.
- No DLT template registration (India SMS compliance), no bounce/complaint handling.

---

## 7. Integrations a land-acquisition platform is usually expected to have — all `MISSING`

| Integration | Evidence of absence |
|---|---|
| Aadhaar e-KYC / authentication | no Aadhaar field, client or endpoint |
| DigiLocker document fetch | absent |
| DSC / e-sign for notices and awards | absent; awards are browser-print only |
| CBS/NEFT/UPI bank rails | absent |
| GSTIN / PFMS vendor registration | absent |
| State GIS/ULB/Revenue department APIs | absent |
| SMS gateway (DLT) | generic adapter only, unconfigured |
| Single sign-on (NIC/LDAP/OIDC) | absent |

---

## 8. Cross-cutting integration security

| Control | Status | Evidence |
|---|---|---|
| Secrets never printed/logged | IMPLEMENTED | `ImageryConfig.toString()` excludes secret; `ContactMasker`; `AuthService` never logs tokens |
| Config validation fails fast | IMPLEMENTED | `ImageryConfig.validate()` |
| HTTPS enforced for imagery | IMPLEMENTED | `allowInsecureHttp=false` default |
| Outbound response size/time bounds | IMPLEMENTED | `max-bytes`, `timeout-seconds` |
| Outbound calls outside business transactions | IMPLEMENTED | outbox dispatcher runs in short separate transactions |
| No personal/bank data leaves the system in simulated payments | IMPLEMENTED | `PaymentGateway.Instruction` carries payment id, landowner id, amount only |
| Payment mode cannot pretend to be real | IMPLEMENTED | `PaymentModeGuard` only allows `SIMULATED` |
| Retry/backoff and delivery audit | IMPLEMENTED | `notification_deliveries`, attempt service, admin retry |
| Egress allowlist (host allowlist for outbound HTTP) | MISSING | adapter URL is configuration, not an allowlist |
| mTLS / IP allowlisting for government networks | MISSING | not applicable yet (nothing connected) |

---

## 9. Integration readiness scorecard

| Dimension | Score | Comment |
|---|---|---|
| Seam design (interfaces, config, guards) | 8/10 | clean `PaymentGateway`, `ImageryConfig`, notification adapters |
| Honesty of labelling | 9/10 | simulated references, roadmap entries, disabled-by-default providers |
| Real government connectivity | 0/10 | none |
| Beneficiary/bank data model | 0/10 | absent |
| Reconciliation/settlement | 0/10 | absent |
| Retry/observability for outbound calls | 6/10 | good for notifications, none for payments |
| Security of configured integrations | 7/10 | secrets/size/time handled; no egress allowlist |

**Overall: `PARTIAL` as a platform, `MOCK`/`MISSING` for every government rail.**

---

## 10. What it would take to make each integration real

| Integration | Minimum work | Blocking dependency |
|---|---|---|
| PFMS/DBT | beneficiary model + bank validation + PFMS API/file adapter + reconciliation + reversal | PFMS onboarding, sandbox credentials, signed MoU |
| Bhuvan | obtain endpoint/key/layers/licence, set env vars, add attribution + metadata, verify `GetCapabilities` | ISRO/NRSC access and licence |
| BhuNaksha | WMS/WFS client, survey-number matching, boundary import + reconciliation workflow | state BhuNaksha service access |
| 7/12 & 8A | state revenue API client, provenance storage, mismatch review | state land-records API |
| e-mail/SMS | configure provider + DLT templates, build contact/preferences UI | provider account, DLT registration |
| Aadhaar/DigiLocker/e-sign | identity + document + signature adapters | MeitY/NIC onboarding, legal approval |

None of these can be completed inside a hackathon window; the correct demo stance is “seam ready, simulated by design”.
