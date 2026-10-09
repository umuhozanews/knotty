-- Additive tenant, payment integration, and privacy operations foundation.
CREATE TYPE "MembershipRole" AS ENUM ('PLATFORM_ADMIN','ORGANIZATION_MANAGER','SCHOOL_MANAGER','ADMIN','TEACHER','STUDENT','PARENT','CANTEEN','NURSE','BURSAR','DISCIPLINE','LIBRARIAN');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE "PaymentProvider" AS ENUM ('MTN_MOMO','AIRTEL_MONEY','BANK','CASH');
CREATE TYPE "ExternalPaymentStatus" AS ENUM ('CREATED','PENDING','SUCCEEDED','FAILED','REVERSED','RECONCILIATION_REQUIRED');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "legal_name" TEXT, "tin" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
ALTER TABLE "School" ADD COLUMN "organization_id" TEXT, ADD COLUMN "branch_code" TEXT;
CREATE INDEX "School_organization_id_idx" ON "School"("organization_id");
ALTER TABLE "School" ADD CONSTRAINT "School_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OrganizationMembership" (
  "id" TEXT NOT NULL, "organization_id" TEXT NOT NULL, "user_id" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL, "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationMembership_organization_id_user_id_key" ON "OrganizationMembership"("organization_id","user_id");
CREATE INDEX "OrganizationMembership_user_id_status_idx" ON "OrganizationMembership"("user_id","status");
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SchoolMembership" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL, "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolMembership_user_id_school_id_key" ON "SchoolMembership"("user_id","school_id");
CREATE INDEX "SchoolMembership_school_id_status_role_idx" ON "SchoolMembership"("school_id","status","role");
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve current access as a single-school membership. A current ADMIN is only a school ADMIN;
-- network-wide privileges must be granted explicitly by the platform owner.
INSERT INTO "SchoolMembership" ("id","user_id","school_id","role","status","created_at","updated_at")
SELECT gen_random_uuid()::text, u."id", u."school_id",
  CASE u."role"::text WHEN 'ADMIN' THEN 'ADMIN'::"MembershipRole" ELSE u."role"::text::"MembershipRole" END,
  CASE WHEN u."is_active" THEN 'ACTIVE'::"MembershipStatus" ELSE 'SUSPENDED'::"MembershipStatus" END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u ON CONFLICT ("user_id","school_id") DO NOTHING;

CREATE TABLE "ExternalPayment" (
  "id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "provider" "PaymentProvider" NOT NULL,
  "status" "ExternalPaymentStatus" NOT NULL DEFAULT 'CREATED', "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RWF', "merchant_reference" TEXT NOT NULL,
  "provider_reference" TEXT, "idempotency_key" TEXT NOT NULL, "callback_hash" TEXT,
  "metadata" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "ExternalPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExternalPayment_merchant_reference_key" ON "ExternalPayment"("merchant_reference");
CREATE UNIQUE INDEX "ExternalPayment_school_id_idempotency_key_key" ON "ExternalPayment"("school_id","idempotency_key");
CREATE INDEX "ExternalPayment_school_id_status_created_at_idx" ON "ExternalPayment"("school_id","status","created_at");
CREATE INDEX "ExternalPayment_provider_provider_reference_idx" ON "ExternalPayment"("provider","provider_reference");
ALTER TABLE "ExternalPayment" ADD CONSTRAINT "ExternalPayment_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "subject_ref" TEXT NOT NULL,
  "request_type" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3), "notes" TEXT, CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyRequest_school_id_status_received_at_idx" ON "PrivacyRequest"("school_id","status","received_at");
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
