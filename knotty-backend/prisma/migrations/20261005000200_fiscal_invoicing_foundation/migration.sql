CREATE TYPE "FiscalDocumentStatus" AS ENUM ('DRAFT','QUEUED','ACCEPTED','REJECTED','VOIDED');
CREATE TABLE "FiscalDocument" (
  "id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "source_reference" TEXT NOT NULL,
  "taxpayer_tin" TEXT, "branch_code" TEXT, "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "invoice_number" TEXT, "receipt_number" TEXT, "receipt_signature" TEXT, "internal_data" TEXT,
  "request_payload" JSONB, "response_payload" JSONB, "last_error_code" TEXT,
  "issued_at" TIMESTAMP(3), "submitted_at" TIMESTAMP(3), "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FiscalDocument_school_id_source_reference_key" ON "FiscalDocument"("school_id","source_reference");
CREATE INDEX "FiscalDocument_school_id_status_created_at_idx" ON "FiscalDocument"("school_id","status","created_at");
CREATE INDEX "FiscalDocument_taxpayer_tin_branch_code_idx" ON "FiscalDocument"("taxpayer_tin","branch_code");
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;