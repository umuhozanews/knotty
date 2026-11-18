# Multi-school security and Rwanda integration design

## Access model implemented

- `Organization` groups independent `School` records (branches). School operational data remains keyed by `school_id`.
- `SchoolMembership` gives a person an active, revocable school-specific role. `OrganizationMembership` grants manager access to schools explicitly linked to that organization. `PlatformMembership` is separate and grants platform-wide access.
- Login still uses the existing account identity. New tokens carry an active school context; each authenticated request reloads the account and verifies an active school or organization membership. Role/school values from the browser are not trusted.
- School switching rejects unassigned schools. School list and school detail/statistics are scoped. School administrators can maintain school memberships without granting platform or organization-manager roles.
- Existing users were backfilled into an active membership for their current school. Their existing `ADMIN` role remains school-level. No user was silently promoted to platform administrator.
- Additive migrations live under `knotty-backend/prisma/migrations`. An organization manager, organization, and multi-branch grouping must be assigned intentionally; existing standalone schools were not guessed to be branches of the same operator.

## Integrations foundation and current limits

- `ExternalPayment` provides a provider-neutral, school-scoped, idempotent transaction record for MTN MoMo, Airtel Money, banks, and cash. Existing MTN MoMo code is still the only live provider adapter in the app. Airtel and bank connectivity require each provider's merchant onboarding, credentials, callback/security contract, and reconciliation rules before an adapter can safely be enabled.
- `FiscalDocument` stores a durable school-scoped invoice submission lifecycle and RRA response/signature fields. This is an integration boundary only; no RRA request is sent and the system is not an approved CIS/VSDC/OSDC. Credentials, SKMM keys, and certificates must be kept in a secret manager/HSM, never in school settings or this database.
- Payment callbacks must be authenticated according to the provider's official contract, checked against the provider's status endpoint where supported, correlated to one idempotency key/reference, and applied exactly once in a database transaction. The current MTN callback/top-up implementation still needs this idempotency and provider-contract review before production use.

## Rwanda compliance work required before launch

- Confirm whether each legal entity/school is the data controller and whether the platform operator is a processor or joint controller; execute processing agreements and register as required with Rwanda's Data Protection and Privacy Office.
- Complete processing inventory, purpose/legal basis, retention schedule, access/rectification/erasure workflow, breach response, child/guardian notice/consent where applicable, and data protection impact/risk assessment. Health records are sensitive data and require especially tight role access and audit.
- Hosting and all subprocessors must be reviewed for Rwanda storage and transfer requirements. Cross-border storage or transfer needs the required DPO authorization; the app's deployment region alone does not establish compliance.
- For RRA fiscal invoicing, each taxpayer must confirm applicable tax treatment and branch/TIN registration. RRA requires an approved route and certification for private invoice systems integrating to VSDC/OSDC; follow current technical specs, test cases, RRA onboarding and certification before issuing tax receipts from this platform. Do not treat a normal school payment receipt as an EBM invoice.
- BNR regulates payment systems and payment service providers. Use licensed providers/aggregators for collections and do not hold or intermediate customer funds unless the legal authorization and safeguarding arrangements are confirmed.

## Operational hardening

Production no longer uses an in-memory Redis fallback. Missing production Redis or weak/missing signing and encryption configuration now prevents startup; token revocation checks fail closed if Redis is unavailable. Deploy with TLS, managed PostgreSQL and Redis, encrypted backups, restricted service accounts, monitoring, secret rotation, and a documented incident/recovery process.

## Official references checked 2026-10-05

- RRA EBM types and VSDC/OSDC certification: https://www.rra.gov.rw/en/about-ebm
- RRA VSDC technical specifications: https://www.rra.gov.rw/en/ebm-electronic-billing-machine/content-under-ebm/cis-for-vsdc-technical-specifications
- Rwanda DPO registration and obligations: https://dpo.gov.rw/faqs and https://dpo.gov.rw/fileadmin/DPO/ComplianceTools/registration-guide-for-data-controller-and-processor.pdf
- Rwanda Personal Data Protection and Privacy Law No. 058/2021: https://rwandalii.org/akn/rw/act/law/2021/58/eng%402021-10-15
- National Bank of Rwanda payment systems framework: https://www.bnr.rw/paymentsystems
- MTN MoMo developer portal: https://momo.mtn.com/api/
- Airtel Africa developer portal (Rwanda selectable): https://developers.airtel.africa/
- OWASP authorization guidance: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

This document describes software foundations, not legal advice, provider approval, security certification, or proof of regulatory compliance. Have Rwandan counsel/compliance owners and each provider/RRA review the live operating model before launch.

## Bootstrap and organization setup

Assign the initial platform owner only after confirming the email identifies the owner account: run PLATFORM_ADMIN_EMAIL=owner@example.rw node scripts/grant-platform-admin.js --confirm-platform-admin-grant from the backend directory (PowerShell: $env:PLATFORM_ADMIN_EMAIL='owner@example.rw'; node scripts/grant-platform-admin.js --confirm-platform-admin-grant). The owner can create an organization with POST /schools/organizations, attach existing schools as branches with PUT /schools/organizations/:organizationId/schools/:schoolId, assign an organization manager with POST /schools/organizations/:organizationId/managers, and create additional branches with POST /schools. School memberships are managed through /schools/:id/memberships; roles above school scope cannot be granted through that endpoint. New schools now start without invented academic-year classes; configure their actual levels, sessions, classes, and timetable after onboarding.

Configuration records have been added for each school's payment-provider secret references and RRA taxpayer/certification references. Credentials themselves must be held in a managed secret store. School-specific integration adapters and formal provider/RRA approvals remain required before enabling production payments or fiscal receipts.

Authentication now tracks each login as a Redis session, so one device's refresh/logout does not silently replace another device's session. Active tenant membership is revalidated on each API request.
