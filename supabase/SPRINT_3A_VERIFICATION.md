# Sprint 3A backend verification status

Checked locally on 2026-10-31. This report distinguishes repository inspection from runtime verification.

## Runtime availability

| Component | Result | Evidence |
|---|---|---|
| Docker Desktop / Docker Engine | Blocked | `docker` is not on PATH; `docker info` cannot run. |
| Supabase CLI | Blocked | `supabase` is not on PATH. |
| Deno | Blocked | `deno` is not on PATH. |
| PostgreSQL client | Available | `psql 18.4`. |
| Local PostgreSQL | Blocked | Connections to `127.0.0.1:54322` (configured Supabase port) and `:5432` are refused. |

To enable the requested runtime checks on Windows, install Docker Desktop for Windows using the WSL 2 Linux-container backend, enable CPU virtualization and the WSL 2 feature, install/enable a current WSL 2 Linux kernel, and start Docker Desktop. Use a Windows 10 22H2 (build 19045+) or Windows 11 host supported by the current Docker Desktop release; allow the required Windows administrator/UAC prompts. Then install the Supabase CLI and Deno and reopen the terminal so their executables are on PATH. The CLI must be able to reach the running Docker Engine. This project configures PostgreSQL major version 17 and local database port 54322.

No hosted Supabase project was contacted. No database was modified, and no migration, pgTAP test, database lint/advisor, Edge Function type-check, or authenticated multi-school RLS test ran.

## Repository inventory

- 15 committed migrations, ordered `20261031111719` through `20261031141659`.
- 15 committed pgTAP files, `000_local_environment_test.sql` through `014_card_lifecycle_workflows_test.sql`.
- Supabase config: `supabase/config.toml` (PostgreSQL 17; API 54321; database 54322; Studio 54323; Edge runtime Deno 2; only the device scan function disables platform JWT verification).
- Edge Functions: `provision-student`, `issue-card`, `replace-card`, and `process-attendance-scan`.
- Role/permission seed and documented matrix: `20261031135147_seed_scoped_permissions_and_role_workflows.sql` and `ROLE_PERMISSION_MATRIX.md`.
- Permission-scoped role, school, student, staff, academic, guardian, attendance-device, attendance, and card RPCs are present in the migrations.

## Static security observations

- The inspected `SECURITY DEFINER` workflow functions set an empty `search_path`, set the owner to `postgres`, revoke default/public execution, and grant execution to the intended API role. The scan processor is granted only to `service_role`; the scan Edge Function first checks a device credential and delegates device/school/card validation to that RPC.
- Card identifiers are HMAC-digested in the issue/replace Edge Functions. The device credential is SHA-256 digested. Scan requests include a UUID idempotency key; the database implementation must still be exercised under retries/concurrency before idempotency is accepted as verified.
- Guardian request/accept/approve/revoke and per-relationship permission RPCs exist. Their identity, approval, and cross-school behavior have not been exercised with live JWT contexts.
- `student_documents` metadata and an authorization policy exist, but no private bucket definition, `storage.objects` policies, upload Edge Function, or download contract was found in the committed Supabase files.
- No staff invitation/account-linking workflow was found. Staff registration currently accepts an existing person/Auth identity through `register_staff`.
- Guardian request RPCs exist, but no Edge Function or delivery/verification/account-linking integration is present in the committed functions.
- No atomic student transfer RPC/workflow was found.
- QR identifiers are represented as a card identifier kind and can use the generic scan path; a distinct QR issuance/scanning API contract and its security/idempotency behavior have not been runtime-verified.
- Attendance has a manually supplied `early_departure` status, but no explicit school dismissal-time configuration or automatic classification was found.
- Device registration and status RPCs exist; no Edge/API adapter that safely provisions a device credential and returns it once was found.

These are static repository findings, not proofs that no external caller exists. The operational contracts for the listed existing RPCs remain subject to pgTAP/runtime verification.

## Results

### Passed

- Repository inventory and local executable availability checks completed.
- Static inspection found the expected ordered migration/test file sets and the four Edge Function entrypoints.

### Failed

- PostgreSQL connectivity checks: both local ports refused the connection.

### Blocked

- Starting Supabase locally, applying migrations, running tests 000–014, running database lint/advisors, checking migration compatibility, and RLS tests with authenticated users from multiple schools: Docker Desktop/Engine and Supabase CLI are unavailable.

### Not executed

- Deno checks; all database and Edge Function integration tests; storage object authorization; workflow completion and end-to-end request/response contract verification.

