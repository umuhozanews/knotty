# Knotty Functionality Inventory for IshuriHUB

**Review date:** 30 October 2026  
**Scope:** Static, read-only inspection of the Knotty frontend, backend, Prisma schema/migrations, deployment and operational files. This report describes repository evidence; it does not establish that production deployment configuration is correct or that a live database has the expected schema/data. No source code was changed. No build, migration, seed, or automated test was run for this inventory.

## 1. Executive summary

Knotty is a multi-school school-operations application with a Next.js frontend, Express API, Prisma/PostgreSQL persistence, and a broad set of operational modules. It has real authentication and persistence code, and substantial CRUD/transaction paths for students, attendance, card wallets, canteen, fees, library, health, discipline, gate access, reports and academic scheduling. The repository is considerably more than a static prototype.

It is not yet a coherent, production-ready school management platform. The most complete parts are CRUD and operational workflows that have both UI and API/service/database paths. Other areas look substantial in the UI but rely on demo fallbacks, lack connected workflows, or have incomplete lifecycle/business rules. “Page exists” and “endpoint exists” are not counted as a complete feature. In particular:

- The browser can fabricate a local user after any login failure. It can show a role dashboard without a backend session. This is distinct from backend authentication, which performs password verification and token/session handling. Local API mock mode is a separate switch and is not automatically set by this login fallback.
- Several dashboard widgets and card-reader interfaces explicitly fall back to hard-coded demo data.
- Admissions is a direct student-create flow, not an application/review/enrollment lifecycle. Parent account provisioning in that flow uses a generated email and a fixed default password.
- Academic data has both legacy report/term structures and newer exam/result/term structures. The visible report workflow allows manual grading/report entry; it is not a demonstrated automated end-to-end assessment pipeline.
- Operational security and money-handling limitations documented in the prior security audit affect whether otherwise implemented workflows can safely be used across schools or for payments.
- The local PostgreSQL service was stopped and localhost port 5432 was unreachable in the prior runtime check. Production data, applied migration state, Redis, and provider credentials cannot be verified from repository files.

**Overall classification:** broad, partially implemented product foundation. Treat modules below as candidates to keep or redesign after workflow validation, not as confirmed production capabilities.

### Classification definitions

- **Fully implemented (code path):** visible user workflow is connected through API/service to persistent data with its main lifecycle represented in code. This label is limited to repository evidence and does not certify production operation, authorization quality, or testing.
- **Partially implemented:** meaningful code exists, but important lifecycle steps, role rules, validation, error handling, integration configuration, or end-to-end connections are absent or incomplete.
- **Mocked/demo:** hard-coded or browser-local data can stand in for backend data or operations.
- **Unfinished:** a partial implementation exists but has clear stubs, gaps, or an uncompleted workflow.
- **Missing:** no meaningful implementation was found in the inspected repository.

## 2. Complete module inventory

Frontend paths below are relative to `knotty-app/`; backend paths are relative to `knotty-backend/`. API paths are shown relative to the backend API prefix; confirm the configured prefix in each deployment. Models refer to Prisma schema entities. Status summarizes inspected code and is not a runtime test result.

| Module / purpose | Users | Frontend | API / backend | Database | Status and limitations |
|---|---|---|---|---|---|
| School and organization administration | Platform and school managers; administrators | `app/schools`, school switcher in `components/Header.tsx`, `context/AuthContext.tsx` | `/schools` organizations, managers, school CRUD, memberships, switch, settings, stats | `School`, `Organization`, `OrganizationMembership`, `PlatformMembership`, `SchoolMembership`, `User` | **Partial.** Multi-school and organization records and switching exist. School provisioning is not a complete SaaS lifecycle (subscription billing/entitlements and operational onboarding are not established). Active school selection also has client fallback behavior. |
| Student admission and registration | School managers/admin, registrar-like staff; guardian details | `app/students`, `app/students/[id]` | `/students` create/list/get/full profile/update/delete, parent/self endpoints | `Student`, `User`, `School`, `Level`, `Class`, `KnottyCard`, `MedicalProfile`, `ConsentRecord` | **Partial.** Registration creates linked user and student rows in a transaction and generates a student code. There is no application, review, offer, document checklist, waitlist, admission decision, or formal enrollment lifecycle. A requested class/level is resolved but invalid class input is not clearly rejected in the inspected service. |
| Staff and worker management | School managers/admin; staff | `app/workers`, `app/settings`, teacher pages embedded in settings | `/workers` CRUD; `/teachers` CRUD; `/levels/staff` create/list/toggle | `Staff`, `Teacher`, `User`, `School`, `Class`, `Subject` | **Partial.** Two staff representations coexist. Worker records support profile/job details, while teacher records have teaching-specific assignment data. Role/job-title strings do not establish granular permissions. Recruitment, contracts, payroll, leave and performance management were not found. |
| Parent/guardian management and access | Parent/guardian; school staff | Parent dashboard in `components/dashboards/ParentDashboard.tsx`; student form guardian fields | Student create can locate/create parent; `/students/parent/me` and related self endpoints | `User`, `Student.parent_id`, `SchoolMembership` | **Partial.** A parent-child link and parent-facing views exist. No dedicated parent lifecycle/guardian CRUD or verified invitation/activation workflow was found. Student creation creates a parent user with a generated email and fixed initial password when only guardian fields are supplied. |
| Classes, levels, streams, subjects | School managers/admin, teachers | `app/settings`, student filters and forms, class dashboard selectors | `/levels` class/level CRUD, class students; `/academics/subjects` | `Level`, `Class`, `Subject`, `ClassSection`, `Program`, `Enrollment`, `Teacher` | **Partial.** Base class/level setup exists; academic section/enrollment structures also exist. The relationship and source of truth between legacy `Class` and newer `ClassSection`/`Enrollment` need consolidation. |
| Academic years and terms | School managers and academic staff | Academic selectors/settings and reports | `/academics/terms` CRUD; school settings | `AcademicTerm`, `School`; also legacy term enum/fields | **Partial.** Terms are stored, but school year rollover, promotion, closing, historical lock, and cross-module term consistency are not demonstrated. A separate term enum indicates overlapping representation. |
| Student attendance | Teachers, attendance staff, admins; student/parent read views | `app/attendance`, `app/my-attendance`, attendance dashboard components | `/attendance` scan, NFC/secure scan, bulk, queue, summary, student/class/report/PDF, settings, self | `Attendance` (service accessor uses attendance records), `Student`, `School`, `KnottyCard`, `Teacher` | **Partial.** Scan, manual/bulk, reporting, and self-view paths exist. Reader operation and queued scan paths depend on authorization and backend availability. Prior audit identified cross-school access and write-scope gaps; this must be addressed before operational use. |
| Staff attendance | School management | No dedicated staff attendance page found | No distinct staff-attendance workflow found | No clearly separate staff attendance entity identified | **Missing / not evidenced.** Student attendance should not be assumed to cover staff clock-in, leave, shifts, or payroll attendance. |
| Exams, grading, report cards | Teachers, academic managers, students and parents | `app/reports`, `app/my-reports`, student detail UI | `/academics/exams`, exam results/approval/grading scales; `/reports` create/list/update/publish/PDF/student self | `Exam`, `ExamResult`, `GradingScale`, `AcademicReport`, `AcademicTerm`, `Subject`, `Student` | **Partial.** Exam/result/scale APIs exist, while report UI supports editing/publishing and PDF generation. The legacy `AcademicReport` stores grade data separately from newer exam results. No verified automatic result aggregation, moderation lifecycle, or reconciliation between these models. |
| Fees and payments | Bursar, admin, parent/student views | `app/fees`, student detail | `/fees` structures, invoices, payment, refunds, reports, verify | `FeeStructure`, `Invoice`, `InvoiceLine`, `Payment`, `FeePayment`, `RefundRequest`, `ExternalPayment`, `FiscalDocument`, `PaymentIntegration`, `TaxpayerProfile` | **Partial.** Fee structures/invoices/payment/refund code exists, plus a legacy `FeePayment` model and provider records. Reconciliation, accounting exports, complete receipt/fiscal workflow, and verified provider settlement are not established. Provider callbacks have idempotency/configuration concerns from the previous audit. |
| Smart cards, NFC and QR | Card managers, attendance staff, bursar/canteen/library operators, student/parent | `app/cards`, `components/KnottyCard.tsx`, `components/NFCStudentModal.tsx`, `components/VirtualCardTap.tsx`, `app/standalone-tap` | `/cards` issue/list/freeze/unfreeze/NFC link/QR/scan/top-up/transactions/webhook | `KnottyCard`, `Student`, `WalletTransaction`, `Attendance`, `CanteenTransaction`, `BorrowRecord`, `AccessLog` | **Partial.** Card assignment and QR/NFC APIs exist. Browser Web NFC and camera scan support depend on compatible hardware/browser/permissions; standalone terminal has demo fallback. Card identifiers are globally sensitive; prior audit identified missing tenant scope on scan. |
| Student wallets | Bursar, parents, canteen; students | Cards, fees, canteen, student detail, `app/my-card` | Card cash/MoMo top-up, transactions; canteen purchase; payment callbacks | `KnottyCard.wallet_balance`, `WalletTransaction`, `ExternalPayment`, `Payment` | **Partial.** Balance and transaction code is present, but wallet ledger/reconciliation and payment idempotency require review. A repeated successful MoMo confirmation can credit twice per prior audit. |
| Canteen | Canteen staff, students, parents, bursar | `app/canteen`, dashboard, `app/my-card` | `/canteen` products CRUD/restock/purchase/reports/student transactions/self transactions | `CanteenProduct`, `CanteenTransaction`, `KnottyCard`, `Student`, `School` | **Partial, with real transaction code.** Product and purchase workflows persist data and debit wallet. Stock handling and payment atomicity need operational verification. UI and API are present; test scripts are ad hoc, not an automated suite. |
| Library | Librarian, students, parents | `app/library` | `/library` books/copies, borrow/return/renew/fines, history, reservations, members, reports/stats/lookup | `Book`, `BookCopy`, `BorrowRecord`, `Reservation`, `Student`, `User` | **Partial.** Catalog and circulation lifecycle are extensive. Fine policy, inventory audit, notification flow, procurement, and integration with student clearance/fees are not shown as a complete workflow. Parent ownership checks and role boundaries need verification. |
| Nurse / student health | Nurse, parent/student (limited self profile), authorized school staff | `app/health`, student detail, nurse dashboard | `/health` record CRUD, profiles, immunizations, clinic visits | `HealthRecord`, `MedicalProfile`, `ImmunizationRecord`, `ClinicVisit`, `MedicationAdministration`, `Student` | **Partial.** Sensitive health records and clinic/medication models exist. Consent, clinical permissions, emergency escalation, medication inventory, and parent communication lifecycle are not established. Sensitive fields are documented as encrypted; runtime key setup is unverified. |
| Visitor and gate access | Gate staff, school managers, authorized staff | `app/gate-access`, `app/standalone-tap` | `/gate-access` campus/device/zone/grant/evaluate/override/visitor/log operations | `Campus`, `GateDevice`, `RestrictedZone`, `ZoneAccessGrant`, `AccessLog`, `VisitorLog`, `Staff`, `Student` | **Partial.** Visitor registration/checkout and access rules/logs are represented. No physical device provisioning protocol or verified live reader webhook/stream is established by the UI labels. External hardware integration remains unverified. |
| Transport | Transport coordinators, drivers, parents/students | No transport UI or route module found | No transport API module found | No transport-specific models found | **Missing.** No route, vehicle, driver, stop, assignment, trip, GPS, or transport payment workflow was identified. |
| Timetables | Academic managers and teachers | Academic/settings/report areas; no clear dedicated schedule page found in route list | `/academics/timetables` list/plan/save/generate/runs/get/publish/create/delete | `TimetableEntry`, `TimetablePlan`, `ScheduleRun`, `ScheduleRunEntry`, `ClassSection`, `Subject`, `Teacher`, `AcademicTerm` | **Partial / unfinished.** Planning and generation endpoints/models exist. A complete visible scheduling workflow, constraint management, conflict resolution UX, and operational adoption were not established. |
| Notifications | Administrators, school staff, parents/students | Header notification UI and dashboards | `/notifications` list/read/send | `Notification`, `NotificationRule`, `NotificationTemplate`, `NotificationLog`, `User` | **Partial.** In-app records and send endpoints exist. Email and WhatsApp providers were not found; SMS is narrowly integrated for attendance alerts. Delivery, retries, preferences, consent and templates need end-to-end definition. |
| Discipline | Discipline staff, teachers, school managers; parent/student views may consume reports | `app/discipline`, discipline dashboard | `/discipline` school/student list, create/update | `DisciplineRecord`, `Student`, `User`, `School` | **Partial.** Incident recording and listing are implemented. Case workflow (review, evidence, escalation, appeal, parent acknowledgement, safeguarding) is not established. Prior audit identified cross-school attendance/card concerns; authorization must be assessed across similar student lookup paths. |
| Reports and analytics | School managers, teachers, bursar, platform operations | `app/reports`, dashboard cards/charts, `app/my-reports` | `/reports`, school stats/trend, attendance PDFs, fee/canteen/library reports | `AcademicReport`, `Attendance`, `Student`, `Payment`/legacy fee entities, `CanteenTransaction`, `BorrowRecord` | **Partial.** Several operational reports and PDFs exist. Dashboard widgets have demo fallbacks; analytics definitions, export completeness, auditability, and cross-module reconciliation are not proven. |
| Administration and settings | School managers/admin, platform manager | `app/settings`, `app/my-profile` | `/levels` settings/staff; `/schools` settings/membership; auth profile | `School`, `User`, `SchoolMembership`, `Level`, `Class`, `Subject`, `Teacher`, `Staff` | **Partial.** School profile, structures, staff, and attendance settings exist. Fine-grained policy, role editor, audit review UI, privacy operations, retention controls and platform configuration are not clearly exposed. |
| Achievements | Teachers/admin; student/parent consumers | Student detail and dashboard components | `/achievements` create/list by student | `Achievement`, `Student`, `User` | **Partial.** Simple entry and display are supported; moderation, taxonomy, term linkage, consent, and a complete student portfolio lifecycle are not evident. |
| Learning materials | Teachers, students | `app/materials` | `/materials` list/upload/delete | `Material`, `Subject`, `Class`, `School` | **Partial.** Upload and listing exist. Assignment/submission, versioning, access lifecycle, and external file storage durability are not confirmed. |
| Privacy, audit and fiscal records | Platform/school managers, privacy/finance staff | No comprehensive dedicated frontend surfaced | Admin backup; APIs/models include audit/privacy/fiscal entities | `AuditLog`, `ConsentRecord`, `PrivacyRequest`, `FiscalDocument`, `TaxpayerProfile`, `PaymentIntegration` | **Partial / largely backend-only.** Models exist, but complete operator workflows, retention/export/deletion processing, and fiscal integrations were not established. |

## 3. Features with the strongest implementation evidence

These have connected UI/API/service/persistence paths, though none should be interpreted as a production certification:

1. **Authentication core:** backend login verifies passwords with bcrypt, issues JWTs, records refresh sessions in Redis, and has refresh/logout/current-user endpoints. Protected middleware rechecks account/membership status. The frontend fallback means the visible login state is less trustworthy than this backend path.
2. **Student record creation and listing:** form fields map to a transaction that creates a student user and student record, resolves class/level, generates a student code, and associates a guardian when supplied.
3. **Class/level and basic staff CRUD:** corresponding pages and routes call backend services and Prisma records.
4. **Attendance capture and reporting:** card/NFC/secure scan, bulk attendance, summaries, class/student views and PDFs are represented end-to-end, subject to tenant and class authorization gaps from the prior audit.
5. **Canteen sales:** products, stock/restock, purchase and transaction history have persisted service paths tied to student card balances.
6. **Library circulation:** book/copy catalog and borrow/return/renew/fine/reservation code is extensive and has corresponding UI.
7. **Health record operations:** profile, health records, immunizations and clinic visits have UI/API/model coverage, with sensitive-data configuration and access design still requiring review.
8. **Gate/visitor records:** models and routes support visitor check-in/out, access evaluation/override and logs; device operation itself is not established.

## 4. Mock/demo functionality

- `lib/demo.ts` contains demo accounts, school/student data and helpers that write demo students to local storage.
- `context/AuthContext.tsx` catches backend login failures and creates a local user using a demo account or infers a role from the email prefix; an unknown identifier defaults to `ADMIN`. It writes `ishuri_user` and `ishuri_demo_user` but does not itself set the API mock-mode flags.
- `lib/api.ts` uses browser-local mock handling when `ishuri_demo`/`knotty_demo` storage flag is true or no API base URL is configured. It also applies local mock mutations before attempting the backend. The mock flag is not set by the shown login fallback, so these are separate mechanisms.
- `components/StatsCards.tsx`, `AttendanceChart.tsx`, and `CourseStatistics.tsx` import demo fixtures and fall back when fetches fail.
- `components/VirtualCardTap.tsx` uses fallback demo cards if list retrieval fails or returns no active cards.
- School fetch/switch paths have local fallback behavior. This can leave the shell/dashboard populated when API connectivity is unavailable.
- `app/standalone-tap` presents a real-time gate-reader/webhook concept, but its interface and local student/card fallback are not evidence of a connected external terminal.
- Ad hoc browser scripts use UI navigation and local state; successful navigation is not proof of real authentication, persisted operations, or correct authorization.

**Product implication:** IshuriHUB should make environment mode explicit in the interface and telemetry, reject authentication failures without creating sessions, and make empty/error/offline states visibly distinct from live school data.

## 5. Missing and unfinished capabilities

### Missing or not evidenced

- Admission applications, review queues, document verification, offers and enrollment decisions.
- Staff attendance, leave, payroll, contracts, HR onboarding and performance workflows.
- Dedicated transport management (routes, vehicles, drivers, stops, trip attendance/GPS, parent alerts).
- Email and WhatsApp delivery providers; no evidence of configured production provider credentials.
- Complete parent/guardian registration and identity-verified account invitation/reset lifecycle.
- Dedicated school year rollover, promotions, alumni/withdrawal lifecycle, and historical academic locking.
- Fully connected physical gate/card device provisioning and telemetry protocol.
- Automated backend regression suite for critical workflows; package scripts do not expose a backend test command.
- A verified production database backup-and-restore procedure. Existing backup code exports selected records to Cloudinary JSON; it is not a full restore/point-in-time recovery implementation.

### Present but unfinished or requiring redesign

- Exam results and academic report data have overlapping representations and unclear aggregation/publishing source of truth.
- Timetable models/generation APIs lack evidence of a polished end-user schedule-management lifecycle.
- Payment models represent both legacy and newer approaches; settlement, refunds, receipts, idempotency and accounting reconciliation need an explicit state machine.
- Notification model/service breadth exceeds configured delivery channels.
- Worker and Teacher records overlap and role permissions rely partly on string fields.
- Privacy, consent, audit, fiscal, medication, reservation and payment-integration models have no clearly complete operator experience.
- Dashboard/demo fallback can obscure backend outages or empty data.

## 6. Users, roles and permissions

### Roles represented in code

The core `Role` enum includes `ADMIN`, `TEACHER`, `STUDENT`, `PARENT`, `CANTEEN`, `NURSE`, `BURSAR`, `DISCIPLINE`, and `LIBRARIAN`. Membership roles additionally include `PLATFORM_ADMIN`, `ORGANIZATION_MANAGER`, and `SCHOOL_MANAGER`. Route middleware uses authentication plus role authorization; manager roles are treated as admin-like for routes that authorize `ADMIN`. Memberships have status and school/organization relationships.

| Requested role | Repository representation | What can be concluded |
|---|---|---|
| Platform administrator | `PLATFORM_ADMIN` membership role | Represented in membership/management UI logic; platform-wide responsibilities and complete admin console need verification. |
| School administrator | `ADMIN` / `SCHOOL_MANAGER` | Broad school management access exists in route policies; some endpoints have object-level gaps. |
| Headteacher | No distinct enum role found | May be represented as generic admin/worker job title; no dedicated permission profile found. |
| DOS / DOD | No distinct enum role found | No dedicated role or permission matrix found; likely requires explicit business mapping. |
| Teacher | `TEACHER`, `Teacher` model | Class/subject assignments are represented; some student listing filters use teacher assignments. Several student-ID endpoints were flagged in prior audit for missing class/school checks. |
| Student | `STUDENT`, linked to `Student` | Self profile/attendance/reports/card/canteen views exist. |
| Parent/guardian | `PARENT`, linked via `Student.parent_id` | Self/children views exist; parent ownership enforcement is incomplete for at least card transactions per prior audit. |
| Bursar | `BURSAR` | Fees and card/wallet workflows exist; verify access scope and finance reconciliation. |
| Nurse | `NURSE` | Health operations exist; sensitive-data access and clinical scope require policy review. |
| Librarian | `LIBRARIAN` | Library module exists; no detailed permission matrix or full audit evidence. |
| Patron / Matron | No distinct role found | Could be a worker job title; permissions are not explicit. |
| Other staff | `Staff` / worker and generic role strings | Staff records can describe roles, but a record/job title is not equivalent to an authorization policy. |

The sidebar and page UI hide/show navigation based on client-side role checks; the API is the enforcement boundary. The repository does not present a complete, centrally documented permission matrix mapping every action, role, school, class, student, and parent-child relationship. Use the prior security audit as a specific warning: cross-school card scan/attendance paths and parent transaction ownership were flagged as authorization gaps. Do not infer authorization from a hidden button.

## 7. Detailed workflows

### 7.1 Student registration

1. Staff opens `app/students` and submits personal, class/level, guardian, and optional card/balance/profile fields.
2. API validates and calls student service with active school context.
3. Service verifies school, generates student code, hashes a provided/default password, may create/find a parent user, creates student user, then student record inside a Prisma transaction.
4. Optional profile photo is sent to Cloudinary when configured; otherwise Vercel stores base64 in the DB field, while local filesystem mode writes under uploads.
5. Student is listed and can be edited/viewed in student detail.

**Gaps:** this is direct account provisioning, not admissions. Default credentials, guardian identity, duplicate matching, consent/document capture, parent invitation, enrollment dates/status, and promotion/withdrawal lifecycle need product decisions. Do not use the fixed default guardian password in a real onboarding flow.

### 7.2 Card assignment and student identity

1. Staff searches student/card list in `app/cards` or student detail.
2. Issue/link-NFC endpoints create/associate a `KnottyCard`, with QR/secure-code support.
3. Scan clients can use typed card number, QR camera scanning, or Web NFC if browser/hardware supports it.
4. Card lookup feeds attendance, canteen, library, gate, health and wallet workflows.

**Gaps:** card identity is a cross-module security boundary. Prior audit found global card scan lookup without school scope. Web NFC is browser/device-dependent; `standalone-tap` demo fallback must not be confused with a live reader. Card replacement, lost/stolen lifecycle, device registration and reconciliation should be specified.

### 7.3 Attendance

1. Staff scans card/NFC or selects/bulk-marks class attendance.
2. API records attendance; summary and class/student reports are queried; PDF export is available.
3. Student and parent self-service pages read attendance; late/absent notifications can be sent through the SMS adapter when configured.

**Gaps:** previous audit identified cross-school student reads and card scan writes, and teacher class assignment enforcement is not consistent across student-specific attendance routes. Queue/offline handling and duplicate scan policy need validation. Staff attendance is not present.

### 7.4 Examinations and reports

1. Academic APIs support exams, grading scales, exam results and result approval.
2. Report UI allows academic report creation/edit/publish and PDF generation; student/parent self-report route exists.
3. Dashboard/student pages display report data.

**Gaps:** no proven flow aggregates exam results into report cards. `AcademicReport` and `ExamResult` are separate models; term/year linkage and grade calculation need a single authoritative policy. No moderation, correction audit, locking, or publish notifications verified.

### 7.5 Fee payment and wallet top-up

1. Bursar configures fee structures and generates invoices.
2. Payment endpoints and a MoMo adapter can initiate/verify provider payments; cash payments and refund request resolution are represented.
3. Cards can be cash- or MoMo-topped up; wallet and transaction records feed canteen sales.

**Gaps:** legacy `FeePayment` overlaps newer `Invoice`/`Payment`/`ExternalPayment` structures. Prior audit identified repeatable wallet credit on a successful callback and a mismatch between documented `MOMO_CALLBACK_SECRET` and route `MOMO_WEBHOOK_SECRET`. Provider credentials and callbacks are not verified in a live environment. Define immutable ledger entries, idempotency, reconciliation, receipts, refund accounting and failure states before launch.

### 7.6 Canteen purchase

1. Canteen staff maintains products and stock.
2. Student card is scanned/entered and product quantities are selected.
3. Purchase service records transaction and updates wallet balance; transaction and daily reports can be viewed.
4. Student/parent self-service can view transactions.

**Gaps:** verify concurrency/atomicity, insufficient balance behavior, reversal/refund and stock contention. Prior audit test inventory found only ad hoc canteen browser flow scripts, not automated API/database assertions.

### 7.7 Parent access

1. Guardian details entered during registration may create a parent user; otherwise `parent_id` can associate an existing parent.
2. Parent login and self/children endpoints support student views.
3. Parent dashboard can surface attendance, reports, fees/card information.

**Gaps:** no verified invitation/activation flow and no complete parent-to-multiple-child linking lifecycle. Previous audit found parent card transaction endpoint verifies school/card but not the specific parent-child relationship. Parent information exposure should be reviewed per endpoint.

### 7.8 Library circulation

1. Librarian manages books and copies.
2. Student is resolved via card/code and copy is borrowed; service tracks return, renewal, reservations and fines.
3. History, overdue, popular-book and statistics endpoints support library operations.

**Gaps:** reservation fulfillment, fine policy/waiver approvals, notifications, copy loss/damage and student clearance integration require workflow verification. No test suite was found for API-level lifecycle or isolation.

### 7.9 Visitor and gate access

1. Staff can register visitor, reason, host and checkout.
2. Gate access evaluation checks student/staff/card grants and restricted zones; override and logs exist.
3. UI advertises a live reader terminal/event stream.

**Gaps:** repository evidence establishes API/model operations, not a real hardware protocol, external webhook authentication, network resilience, or a connected reader. Verify deployment integration before treating this as access control.

### 7.10 Nurse operations

1. Nurse scans/searches a student and creates health record or clinic visit.
2. Medical profile, immunization and medication records have models/routes.
3. Student health view can display recorded data to authorized operators.

**Gaps:** clinical consent, emergency workflow, allergy/medication safety, parent notification, record access audit and encryption-key operations need clinical/business review. Keep health data out of broad student lists and exports.

## 8. Database entities and relationships

The Prisma schema contains approximately 64 models and the repository has 12 migration directories. Presence of migration files does not prove they are applied. PostgreSQL was unreachable locally during the previous runtime inspection, so no live schema/data assertions are available.

### Entity groups

- **Tenancy and identity:** `School`, `Organization`, `User`, `SchoolMembership`, `OrganizationMembership`, `PlatformMembership`.
- **Students and structure:** `Student`, `Level`, `Class`, `ClassSection`, `Program`, `Enrollment`, `Teacher`, `Staff`, `Subject`, `AcademicTerm`.
- **Attendance and identity instruments:** `Attendance`, `KnottyCard`, `WalletTransaction`.
- **Academics:** `TimetableEntry`, `TimetablePlan`, `ScheduleRun`, `ScheduleRunEntry`, `Exam`, `ExamResult`, `GradingScale`, `AcademicReport`, `Achievement`.
- **Finance:** `FeeStructure`, `Invoice`, `InvoiceLine`, `Payment`, `FeePayment`, `RefundRequest`, `ExternalPayment`, `PaymentIntegration`, `FiscalDocument`, `TaxpayerProfile`.
- **Operations:** `CanteenProduct`, `CanteenTransaction`, `Book`, `BookCopy`, `BorrowRecord`, `Reservation`, `Material`, `Campus`, `GateDevice`, `RestrictedZone`, `ZoneAccessGrant`, `AccessLog`, `VisitorLog`.
- **Health and safeguarding:** `HealthRecord`, `MedicalProfile`, `ImmunizationRecord`, `ClinicVisit`, `MedicationAdministration`, `DisciplineRecord`, `ConsentRecord`.
- **Platform governance:** `Notification`, `NotificationRule`, `NotificationTemplate`, `NotificationLog`, `AuditLog`, `PrivacyRequest`.

### Important relationships and business-rule dependencies

- `Student` belongs to a school and links to a `User`; it can reference level, class, parent user and card. Student-facing operations depend on the linked user for name/email/profile.
- `Teacher` and `Staff` are separate from `User` and can carry school/job/assignment data. A user account and a staff record are not interchangeable.
- `KnottyCard` is associated with a student and stores wallet balance; `WalletTransaction`, canteen, attendance, access, and potentially fees use card/student identity.
- `Attendance`, health, discipline, academics and transactions carry school/student references. The previous security audit noted that separate foreign keys do not always enforce that the referenced student and declared school belong together; service authorization remains essential.
- `Class`/`Level` coexist with `ClassSection`/`Program`/`Enrollment`. Student registration writes the legacy class/level path; timetable and academic enrollment use additional structures.
- Academic reports and exams/results use separate data structures; establish whether reports are derived, copied, or manually authored.
- `FeePayment` coexists with invoice/payment/provider models; wallet balance is also held on card. Financial source of truth is ambiguous without reconciliation rules.
- `AcademicTerm` coexists with a term enum/legacy fields, creating rollover/report consistency risk.

### Data integrity observations

Prisma foreign keys provide ordinary entity integrity, but the schema does not consistently encode tenant-consistency as compound foreign keys. Correctness can therefore depend on every service query/write applying school constraints. The prior audit found code paths that fail this requirement. Monetary balances and payment states need transactional/idempotent ledger rules. Model existence alone does not demonstrate uniqueness, retention, soft-delete, audit, or restoration behavior.

## 9. Integrations

| Integration | Evidence | Classification | Operational limits |
|---|---|---|---|
| PostgreSQL / Prisma | Prisma schema, migrations, database client and repositories | **Implemented in code; runtime unverified** | Local DB was stopped/unreachable. Applied migrations, production connection and backups cannot be verified. |
| Redis / sessions | `ioredis` config; refresh/session storage; `NO_REDIS` memory implementation | **Implemented with dev mock** | Production requires `REDIS_URL`; live endpoint and persistence are unverified. In-memory mode does not validate production session semantics. |
| MTN MoMo | Axios adapter requests access token, request-to-pay and status; sandbox defaults | **Partial / unconfigured in inspected environment** | Credentials/provider account not verified. Callback secret name mismatch and replay/idempotency concern from prior audit. |
| Africa’s Talking SMS | SDK adapter sends messages; attendance alert call sites | **Partial** | Narrow use; environment credentials and delivery not verified. No broad communication provider abstraction evident. |
| Email | No provider/client found | **Missing** | Password reset, invitations, receipts and notices should not be assumed. |
| WhatsApp | No provider/client found | **Missing** | No message templates, consent flow or delivery callbacks found. |
| QR | `qrcode` library and card QR endpoints | **Implemented in code** | QR issuance exists; access-control safety depends on token entropy, expiry and tenant-scoped validation. |
| NFC / camera | Browser Web NFC plus `html5-qrcode` and card scan APIs | **Partial, device-dependent** | Browser support, HTTPS, permissions and hardware required. No physical terminal interoperability proof. |
| Cloudinary | SDK upload for photos and backup JSON | **Partial / configuration-dependent** | Profile photo can fall back to base64 or local disk. Backup uploads selected tables as JSON; restore and retention not demonstrated. |
| File storage | Multer memory upload and Cloudinary/local/Vercel paths | **Partial** | Different deployment modes have different persistence behavior; file lifecycle, size/type policy and recovery require validation. |
| PDF | PDFKit report/attendance generation | **Implemented in code** | Content/authorization and production rendering not tested. |
| External APIs | MoMo and Africa’s Talking are the evident providers | **Limited** | No transport, LMS, national education registry or payment aggregator beyond code paths identified. |

## 10. UI/UX observations

- The frontend is organized around role dashboards and sidebar navigation with shared header, dashboard shell, tables, stat cards, charts and student/card components.
- Screens cover desktop-style data entry and operational tables. Responsive classes exist in components, but no viewport/device audit or accessibility run was performed.
- Frontend route inventory includes: `/`, `/login`, `/students`, `/students/[id]`, `/workers`, `/schools`, `/attendance`, `/gate-access`, `/library`, `/materials`, `/reports`, `/discipline`, `/health`, `/cards`, `/canteen`, `/fees`, `/standalone-tap`, `/settings`, `/my-profile`, `/my-attendance`, `/my-reports`, `/my-card`.
- Dashboard implementations exist for Admin, Teacher, Student, Parent, Nurse, Discipline, Bursar and Canteen. Librarian is directed to Library; no dedicated headteacher/DOS/DOD/Patron/Matron dashboard or role was found. Generic worker role behavior is not a complete operational dashboard.
- Some widgets intentionally use demo data on fetch failure, and the shell can locally synthesize school context. This weakens the meaning of “empty”, “offline”, and “live” states.
- Role-based navigation is a usability filter only; server-side authorization must protect every API operation.
- Dedicated login wording says “Email Address or Username”; backend lookup is by email only (prior audit, low severity).
- A service worker/PWA setup is present, but offline correctness and sync/conflict handling were not tested.
- No formal design system/accessibility evidence, user research, localization coverage, keyboard/screen-reader review, or mobile hardware UX validation was found in this static inventory.

## 11. Business rules currently visible in code

- Student codes are generated from the school code and used as student identifiers.
- Student user records are created with `STUDENT` role; parent records can be created from guardian name/phone during registration.
- Student listing scopes by school and, for teachers, attempts to filter by class assignments stored in teacher subject data.
- Cards can be active/frozen and linked to NFC UID; wallet balance is associated with card.
- Canteen products can have stock quantity or unlimited stock; purchases are associated with student/card and school.
- Attendance has attendance status values and supports scan/bulk/report operations; late/absent may trigger SMS alert code paths.
- Academic grading scales and result approval status are represented; actual promotion/report aggregation rules are not established.
- Library supports borrow/return/renew/reservation/fine operations; exact borrowing limits/fine schedule are not fully confirmed in this report.
- Gate access has restricted zones, grants, evaluation, overrides and access logs.
- Health-sensitive fields are documented as encrypted in backup code; actual production key configuration and key rotation are unverified.
- Payment, wallet, fee and refund entities encode states, but consistent idempotency and ledger rules are not established.

Treat these as code-level behaviors, not approved school policy. Clarify the rules with Rwandan school operators and finance/education stakeholders before converting them into IshuriHUB requirements.

## 12. Testing and operations

### Testing

- Backend `package.json` has no test script and no backend automated `*.test.*`/`*.spec.*` suite was found in the prior audit.
- Frontend `package.json` has no test script. Playwright scripts exist for all-pages navigation, canteen, action flows, webcam and screenshots, but they are ad hoc and not wired into a maintained CI test suite.
- The all-pages script treats leaving the login route as evidence of login; local frontend fallback makes this insufficient to prove password verification, JWT issuance, Redis session persistence or protected API access.
- No automated regression coverage was found for cross-school isolation, parent-child ownership, role authorization, refresh/revocation, payment callback replay, migration safety, backup restore or health-record access.
- No tests were run for this report.

### Operations and deployment

- Backend scripts include start/dev, Prisma generate/migrate/seed/studio and a Vercel build hook. Frontend scripts include dev/build/start/lint. No test script is declared in package manifests reviewed.
- Deployment artifacts/configuration exist for Vercel and other targets (including Cloudflare/Railway/Render references). Which configuration is actually used in each live environment is unknown.
- Prior audit found `scripts/vercel-build.js` runs `prisma db push --accept-data-loss`, catches failures, and attempts seed (production seed guard failure also caught). Live deployment hook configuration was not verified. This should be treated as a deployment risk, not a verified live production action.
- Admin backup code exports selected student, attendance, health, payment, wallet and discipline records to Cloudinary as dated JSON. It does not show a complete restore path or PostgreSQL point-in-time backup. Backup file includes personal and sensitive data; access, encryption, retention and recovery need explicit controls.
- Express middleware includes Helmet, Morgan, rate limiting and centralized error handling. Prior audit found default rate limits are in-process and broad; live proxy, alerting and centralized log retention were not verified.
- Sentry configuration hooks are present. No operational dashboards, alert thresholds, uptime history, incident procedures or backup restore evidence were found.
- Production requires database and Redis configuration; local `.env.production*` values are blank/incomplete in the inspected repository. Never infer deployed secrets from these files.

## 13. Technical dependencies

- **Frontend:** Next.js/React, TypeScript, Tailwind, charting/UI packages, Playwright scripts, QR/NFC/camera browser APIs, PWA/service worker.
- **Backend:** Node.js, Express, Prisma Client, PostgreSQL, bcrypt, JWT, Joi validation, Redis/ioredis, Multer, PDFKit, Cloudinary, Africa’s Talking, Axios-based MoMo API calls, Sentry/Morgan/Helmet/rate limiting.
- **Runtime dependencies:** reachable PostgreSQL; reachable Redis for production sessions; configured JWT/encryption keys; optional Cloudinary and SMS credentials; MoMo credentials/provider setup; TLS/browser permissions for camera/NFC; writable/persistent file storage where local files are used.
- **Deployment uncertainty:** repository contains multiple platform configurations and potentially divergent frontend/backend API URL settings. Confirm one canonical deployment topology, build command, migrations process, environment-variable contract and health/readiness checks before launch.

## 14. Questions requiring business decisions

1. What is IshuriHUB’s school hierarchy: one school, campuses, organization groups, or a national/multi-tenant platform? Which staff may operate across schools?
2. Are Headteacher, DOS, DOD, Patron, Matron, registrar, gate officer and transport coordinator distinct roles? What exact actions and data may each access?
3. What is the official admissions lifecycle, and when does an applicant become a student/user/enrollment?
4. How are guardians verified and invited? Can a student have multiple guardians, and can one guardian link to multiple students across schools?
5. What are the academic year/term, promotion, grading, moderation, report approval and historical lock rules? Are reports calculated from exam results or manually authored?
6. Which finance model is authoritative? How should fees, invoices, cash, MoMo, wallet top-ups, canteen charges, refunds, receipts, fiscal documents and reconciliation relate?
7. Is a student wallet a regulated stored-value balance, a convenience ledger, or a school-managed allowance? Who may top up, refund, freeze, correct or audit it?
8. Which card hardware/provider is targeted (NFC standard, QR, barcode, offline terminal)? What must happen when the network is offline or a card is lost?
9. What are attendance rules for late/absence, duplicate scans, corrections, staff attendance and parent notifications?
10. What health data is needed, who can see it, what consent and retention rules apply, and what emergency/medication controls are required?
11. Which channels are required: SMS, email, WhatsApp, push? What consent, language, delivery retry and opt-out policies apply?
12. What are library policy limits, fine schedules, reservation rules and student-clearance dependencies?
13. Is gate access an informational log or a safety-critical physical access-control system? What reader vendor, device identity, tamper response and offline policy are required?
14. Is transport in the first release? If so, define routes, vehicles, driver workflows, tracking and guardian alerts.
15. What data residency, privacy requests, retention, export/deletion, audit and disaster-recovery requirements apply in Rwanda and target markets?
16. What service levels, support model, tenant onboarding, subscription/billing, backup RPO/RTO and incident response are expected?

## 15. Recommended IshuriHUB feature scope

This is a product direction based on repository evidence, not an implementation plan approved by stakeholders.

### KEEP as domain foundations

- School, organization, membership and role-aware account concepts.
- Student identity/profile, classes/levels, teacher/staff records, attendance, library, health, discipline, canteen and visitor operations where schools validate the need.
- Card/QR/NFC concept, report PDFs, fee structures and operational reporting as candidate modules.

### IMPROVE before adoption

- Make auth/session state server-authoritative; remove local fabricated login and separate demo mode visibly from production.
- Establish one permission matrix and enforce tenant, class, student, guardian and staff scope at every API/service boundary.
- Turn attendance, student registration, parent access, canteen purchases and card issuance into tested end-to-end workflows.
- Define payment/wallet ledger, provider state machine, callback authentication, idempotency and reconciliation.
- Clarify term/year, class/section, enrollment, exam/result/report and staff/teacher data ownership.
- Replace silent demo fallback with explicit loading, empty, offline and error states; add audit events for sensitive operations.
- Implement safe migration deployment, shared rate limiting, production readiness checks, restore-tested backups and monitored integration health.

### REBUILD / consolidate

- Authentication and onboarding UX (including password reset, invitation and guardian linking).
- Academic data model around one authoritative academic year/term, class/section enrollment, exams, grading and published reports.
- Finance around an immutable ledger and explicit invoices/payments/refunds/provider settlement; migrate legacy records deliberately.
- Staff domain by separating employment profile, login identity, organizational role, class/subject assignment and action permissions.
- Integrations around provider adapters, secrets/configuration validation, retries, idempotency, delivery logs and sandbox/live separation.
- Operational architecture for offline readers only if schools actually require offline mode; synchronize with conflict/audit policy.

### REMOVE or keep out of production

- Unauthenticated local role fabrication and any ambiguous demo fallback that looks like live school data.
- Stale project/status documentation that conflicts with the repository’s actual architecture (update during a separately authorized documentation task).
- Unused or duplicate legacy academic/fee representations only after data migration and reporting impact are understood; do not delete solely based on this inventory.
- Any “live reader/webhook” product claim until a real device/provider connection and failure behavior are demonstrated.

### ADD for a production school platform

- Admission applications, document review, enrollment, student transfers/withdrawals, promotion and alumni lifecycle.
- Explicit parent/guardian invitation, verification, multi-child linking, communication preferences and account recovery.
- Staff attendance, leave, payroll/export and HR lifecycle if included in product scope.
- Transport routes, trips, driver/vehicle records, stops, student assignments and guardian alerts if included in first release.
- Notifications with SMS/email/WhatsApp/push providers, consent, templates, delivery status and retries.
- Privacy/consent/retention workflows, data export/deletion, audit review and least-privilege access to health/financial/student data.
- Automated backend integration/security tests and browser workflow tests for each critical role.
- Production operations: metrics, tracing/log correlation, alerting, health/readiness checks, migration gates, backup encryption, restore drills and documented recovery targets.

### Suggested release order

1. **Foundation:** tenancy, identity, roles, guardian relationships, academic year/term, migrations, audit and production observability.
2. **Core school operations:** student/staff onboarding, classes, attendance, parent access and notifications.
3. **Academic cycle:** exams, grading, moderation, report cards, publishing and historical lock.
4. **Finance:** fee schedules/invoices, cash/provider payments, immutable ledger, refunds and reconciliation.
5. **Daily services:** cards, canteen, library and health with clear privacy/authorization and tested workflows.
6. **Advanced operations:** visitor/gate hardware, transport, offline capability and multi-organization administration after pilot validation.

## Review limits

This is a static repository inventory. It does not prove the application’s live deployments, database contents/migration status, environment variables, provider accounts, actual NFC reader behavior, production network boundaries, or user acceptance. Automated tests were intentionally not run. The prior security audit should be consulted for detailed vulnerability evidence; this report references only the findings that materially affect product workflow readiness.
