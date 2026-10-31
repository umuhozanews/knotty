# Built-in role and permission matrix

This matrix documents the built-in grants seeded by
`20261031135147_seed_scoped_permissions_and_role_workflows.sql` and the
`attendance.devices.manage` addition in `20261031141234_trusted_attendance_workflows.sql`. It is based on
legacy Express `authorize(...)` route lists and the `authorize('ADMIN')`
manager shortcut, with tenant and sensitive-data boundaries made explicit.
Role names are case-sensitive canonical keys.

## Scope rules

- `PLATFORM_ADMIN` grants only platform-scope permissions. It does not receive
  student, health, finance, or attendance permissions by virtue of platform
  membership.
- `ORGANIZATION_MANAGER` grants only organization-scope registry and school
  setup permissions. It does not receive student-level access in member schools.
- `SCHOOL_MANAGER` and `ADMIN` receive the explicit school permission catalog
  seeded at this migration, including sensitive school operations. Their grants
  never confer platform or organization scope.
- Every non-manager school role has a specific, limited set below. Sensitive
  grants such as health, finance, discipline, full student profiles, and report
  content are separate keys.
- Parent access also requires an active, verified guardian relationship and an
  active per-student `guardian_relationship_permissions` row. The `PARENT` role
  alone never authorizes access to a child record.
- Teachers need a current teacher/class/subject assignment for class-specific
  operations in addition to the role permission. This migration does not grant
  class assignment through role membership.

## Platform and organization grants

| Role | Scope | Exact permission keys |
|---|---|---|
| `PLATFORM_ADMIN` | platform | `organizations.manage`, `schools.read`, `schools.create`, `schools.manage`, `roles.assign`, `roles.read`, `audit.read` |
| `ORGANIZATION_MANAGER` | organization | `organizations.read`, `organizations.manage`, `schools.read`, `schools.create`, `schools.manage`, `roles.assign`, `roles.read` |

Organization school permissions are limited to registry/setup operations in
that organization. They do not permit reading student, staff, health, finance,
discipline, attendance or card records.

## School grants

| Role | Exact permission keys |
|---|---|
| `SCHOOL_MANAGER`, `ADMIN` | Every key in the `school` scope catalog at the permission-seed migration, plus `attendance.devices.manage`; includes `roles.assign`, sensitive health/discipline/report access, finance management/refunds, and school configuration. This mirrors the legacy ADMIN route bypass only within one school. |
| `TEACHER` | `schools.read`, `students.read`, `students.create`, `students.update`, `students.read_sensitive`, `staff.read`, `academics.read`, `academics.assessments.manage`, `attendance.read`, `attendance.record`, `attendance.staff.read`, `cards.read`, `cards.issue`, `reports.read`, `reports.read_sensitive`, `reports.manage`, `discipline.read`, `discipline.manage`, `gate.read`, `library.read`, `library.manage`, `materials.read`, `materials.manage`, `canteen.read`, `canteen.transactions.read`, `health.read_summary` |
| `STUDENT` | `students.read_self`, `attendance.read_self`, `reports.read`, `reports.read_sensitive`, `cards.read_self`, `finance.read_self`, `academics.read`, `library.read`, `canteen.read`, `materials.read` |
| `PARENT` | `reports.read`, `finance.read_self`, `academics.read`, `library.read`, `canteen.read`. Child data access additionally needs the exact guardian permission row. |
| `BURSAR` | `schools.read`, `students.read`, `staff.read`, `attendance.read`, `attendance.record`, `cards.read`, `finance.read`, `finance.manage`, `finance.refund`, `reports.read`, `health.read_summary`, `discipline.read`, `gate.read`, `library.read`, `library.manage`, `canteen.read`, `canteen.transactions.read` |
| `NURSE` | `schools.read`, `students.read`, `staff.read`, `attendance.read`, `attendance.record`, `attendance.staff.read`, `cards.read`, `health.read_sensitive`, `health.manage`, `reports.read`, `gate.read`, `library.read` |
| `DISCIPLINE` | `schools.read`, `students.read`, `staff.read`, `attendance.read`, `attendance.record`, `cards.read`, `reports.read`, `discipline.read`, `discipline.read_sensitive`, `discipline.manage`, `gate.read`, `gate.manage`, `library.read`, `health.read_summary` |
| `LIBRARIAN` | `schools.read`, `students.read`, `staff.read`, `academics.read`, `cards.read`, `reports.read`, `library.read`, `library.manage`, `gate.read` |
| `CANTEEN` | `schools.read`, `cards.read`, `canteen.read`, `canteen.manage`, `canteen.transactions.read`, `library.read` |

## Sensitive permissions

| Permission | Seeded roles | Additional mandatory check |
|---|---|---|
| `students.read_sensitive` | `SCHOOL_MANAGER`, `ADMIN`, `TEACHER` | Same-school and object relationship; teacher class assignment for scoped student records. |
| `attendance.devices.manage` | `SCHOOL_MANAGER`, `ADMIN` | School scope; credential digest is never returned from read APIs; only the device-authenticated Edge Function can submit scans. |
| `reports.read_sensitive` | `SCHOOL_MANAGER`, `ADMIN`, `TEACHER`, `STUDENT` | Student self or teacher assignment; parent access only through guardian `reports.read`. |
| `finance.read`, `finance.manage`, `finance.refund` | `SCHOOL_MANAGER`, `ADMIN`, `BURSAR` | Same-school record checks; refund requires separate atomic financial workflow. |
| `health.read_sensitive`, `health.manage` | `SCHOOL_MANAGER`, `ADMIN`, `NURSE` | Same school and health-record authorization. |
| `discipline.read_sensitive`, `discipline.manage` | `SCHOOL_MANAGER`, `ADMIN`, `DISCIPLINE` | Same school and case-level authorization. |
| `guardian.*` catalog keys | No role-wide grant | Active Auth-to-person mapping, active verified relationship, exact student/school, unexpired permission row. |

The catalog includes relationship keys `students.read`, `attendance.read`,
`reports.read`, `finance.read`, `health.read`, `discipline.read`, and
`documents.read` in the `guardian` scope. They are not role grants and are not
inserted into the school `role_permissions` matrix.

## Delegation

| Actor role | Roles it may assign/revoke in same scope |
|---|---|
| `PLATFORM_ADMIN` | `PLATFORM_ADMIN` |
| `ORGANIZATION_MANAGER` | `ORGANIZATION_MANAGER` |
| `SCHOOL_MANAGER` | All seeded school roles, including `SCHOOL_MANAGER` |
| `ADMIN` | `TEACHER`, `STUDENT`, `PARENT`, `BURSAR`, `NURSE`, `DISCIPLINE`, `LIBRARIAN`, `CANTEEN` |
| All other roles | None |

Additionally, a `PLATFORM_ADMIN` with an active platform `roles.assign`
permission may appoint or revoke `ORGANIZATION_MANAGER` for an organization only
when the actor also has an active membership in that exact organization. The
role assignment row still records an organization membership/person pair as its
same-scope actor; a platform role does not create organization membership by
itself.

Actors cannot assign or revoke their own role. The RPC derives the actor from
`auth.uid()`, requires an active same-scope membership, a role with `roles.assign`,
an explicit `delegable_roles` edge, an active target membership, and a reason.
Assignments remain as rows after revocation with actor, timestamps and reason.

## Intentional compatibility limits

Legacy routes sometimes gave broad student, finance, health, or discipline reads
to unrelated operational roles. Those routes are evidence for the feature, not
proof that all returned fields should remain visible. This matrix narrows
operational roles to summary or workflow permissions where appropriate. The
existing Express backend is unchanged during the migration and retains its
previous authorization behavior until those routes are replaced and verified.
