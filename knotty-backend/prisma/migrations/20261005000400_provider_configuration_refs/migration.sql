CREATE TYPE "FiscalIntegrationMode" AS ENUM ('NONE','VSDC','OSDC');
CREATE TABLE "PaymentIntegration" (
  "id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "provider" "PaymentProvider" NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'sandbox', "merchant_account_ref" TEXT,
  "credentials_secret_ref" TEXT NOT NULL, "webhook_secret_ref" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "PaymentIntegration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentIntegration_school_id_provider_key" ON "PaymentIntegration"("school_id","provider");
CREATE INDEX "PaymentIntegration_provider_enabled_idx" ON "PaymentIntegration"("provider","enabled");
ALTER TABLE "PaymentIntegration" ADD CONSTRAINT "PaymentIntegration_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TaxpayerProfile" (
  "id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "tin" TEXT, "branch_code" TEXT,
  "integration_mode" "FiscalIntegrationMode" NOT NULL DEFAULT 'NONE', "certification_ref" TEXT,
  "credentials_secret_ref" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT false, "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxpayerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaxpayerProfile_school_id_key" ON "TaxpayerProfile"("school_id");
ALTER TABLE "TaxpayerProfile" ADD CONSTRAINT "TaxpayerProfile_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;