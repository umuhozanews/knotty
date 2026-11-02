---
name: ishurihub-engineering-standards
description: Apply IshuriHUB product, security, multi-tenancy, migration, testing, and Git standards when designing or changing this school-management platform. Use alongside the Supabase and Supabase Postgres skills for Supabase-backed work.
---

# IshuriHUB Engineering Standards

Use this skill for engineering work in the IshuriHUB repository. It defines product-specific requirements and delivery practices. The installed `supabase` skill provides general Supabase guidance; `supabase-postgres-best-practices` provides general PostgreSQL guidance. Read and apply both when their topics are relevant. Do not copy their general product or SQL manuals into this skill.

## Product direction

IshuriHUB is a Rwanda-first school management platform. Preserve the existing frontend and validated business functionality while replacing or restructuring backend and authentication components. Before changing an interface, endpoint, or data contract, trace its current users and workflows. Keep compatible behavior where it remains useful; identify any deliberate product change and its migration impact.

## Priority and conflict rules

1. Follow the user's current scope, authorization, and safety constraints.
2. Security by design and strict tenant isolation take priority over convenience, backward compatibility, or speed.
3. Apply these IshuriHUB standards to product behavior and system boundaries.
4. Apply the installed Supabase and PostgreSQL skills for general implementation details, and verify changeable Supabase behavior against current official documentation.

If general guidance conflicts with IshuriHUB requirements, preserve default-deny access, tenant isolation, reviewed migrations, and explicit authorization. Do not use direct SQL experimentation against a shared or production database as a substitute for reviewed, version-controlled migrations. Never run destructive database operations without explicit user approval.

## Mandatory architecture and security requirements

### Multi-tenancy and authorization

- Model organization, school, user, and membership relationships explicitly. Every tenant-owned record must have an unambiguous tenant scope, enforced by database constraints where practical and by authorization checks at every server boundary.
- Enforce authorization in backend/API and database policy layers. Frontend route guards, hidden controls, submitted school IDs, and client-side role values are never security controls.
- Default to deny. Allow access only after validating identity, active membership, role/action permission, tenant, and relevant object relationship.
- Enforce school membership for school data, teacher assignment for class/student data, and verified parent-child relationships for guardian access. Check reads, writes, exports, background jobs, RPCs, views, and storage access—not only the main UI endpoint.
- Treat platform-level and organization-level access as explicit, separately audited privileges. Never infer platform-wide access from an ordinary school role.
- Prevent tenant reassignment through writes. Use database constraints and update checks to preserve tenant ownership.

### Authentication and secrets

- Integrate Supabase Auth as the identity/session authority. Validate tokens on trusted server boundaries and derive authorization from trusted membership data, not frontend state or user-editable metadata.
- Remove fabricated/demo sessions from production paths. Demo data and local simulation must be explicitly gated, visibly identified, and unable to impersonate a real user or silently replace failed live requests.
- Never expose Supabase service-role/secret credentials, database passwords, signing secrets, or provider secrets to browser code, public environment variables, logs, reports, or commits. Use least-privilege credentials and keep privileged server operations isolated.
- Do not trust client-provided user, role, school, organization, balance, payment status, or ownership fields. Resolve or verify them server-side.

### Database and schema evolution

- Make database changes through reviewed, version-controlled migrations with clear sequencing, rollback/recovery considerations, and safe evolution for existing data.
- Do not experiment with direct SQL on shared or production databases to discover a schema. Use disposable/local/test environments for exploration, then encode the reviewed result in migrations.
- Preserve referential integrity with foreign keys, uniqueness/check constraints, tenant-consistency protections, and appropriate indexes. Prefer database-enforced invariants over comments or application convention alone.
- Use transactions for multi-record state changes. Keep transactions short and do not hold locks while waiting on external network/payment services.
- Plan backfills, compatibility windows, and rollback limits before removing or renaming persisted fields. Never assume that a successful migration command proves data correctness.

### Financial integrity

- Treat balances and payment state as security-sensitive, auditable data. Use atomic, concurrency-safe ledger operations and derive balances from a clear source of truth.
- Make payment initiation, callbacks/webhooks, retries, refunds, reversals, and reconciliation authenticated and idempotent. A repeated event must never duplicate a credit, debit, receipt, or state transition.
- Verify provider callbacks independently; never accept client assertions as proof of payment. Record provider references with appropriate uniqueness and retain auditable state transitions.
- Add automated tests for replay, concurrent operations, partial failures, refunds, and reconciliation before enabling a financial workflow.

## Required verification

For authentication or authorization changes, test valid and invalid sessions, role boundaries, revoked/deactivated users, parent-child ownership, teacher-class scope, and cross-school denial.

For schema/RLS changes, test policies using representative authenticated roles and multiple schools/organizations. Verify both permitted access and denied cross-tenant reads/writes, including updates that attempt to change ownership. Confirm database constraints reject invalid relationships.

For finance changes, test duplicate callbacks, concurrent requests, failed/late provider responses, refunds/reversals, and balance/ledger consistency.

Run the relevant automated tests and checks for each change. Do not claim a fix or milestone is verified unless the checks actually ran and passed. If a required external service or database is unavailable, report the limitation and distinguish static review from runtime verification.

## Engineering workflow and Git

1. Inspect repository instructions, Git state, affected frontend/API/service/database paths, and existing tests before editing. Preserve unrelated and pre-existing untracked files.
2. State the intended change and relevant assumptions. Work in small, reviewable steps; avoid broad rewrites when a bounded change preserves the desired product behavior.
3. Add or update automated tests with the implementation. Review the final diff for secrets, tenant leaks, unrelated changes, and migration safety.
4. Report changed files, behavior, tests run and results, and remaining risks. Distinguish verified behavior from assumptions or untested deployment configuration.
5. Commit coherent milestones after their relevant checks pass, following the user's current approval boundary. Never push, deploy, or run destructive database operations without explicit approval.

## Complementary skills

- For Supabase Auth, RLS, Supabase APIs/CLI, Storage, or Supabase-specific debugging, also read `.agents/skills/supabase/SKILL.md` and its conditionally relevant references.
- Before changing PostgreSQL schemas, migrations, RLS policies, indexes, functions, transactions, or database queries, also read `.agents/skills/supabase-postgres-best-practices/SKILL.md` and the specific referenced guidance that applies.
- These skills explain general Supabase/PostgreSQL mechanics. This skill supplies IshuriHUB's product invariants and does not replace their current documentation checks.
