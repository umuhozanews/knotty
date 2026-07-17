-- Add hash-chain fields to AuditLog for tamper-evident immutable audit trail
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "checksum" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "prev_checksum" TEXT;

-- Index on created_at for efficient chain verification queries
CREATE INDEX IF NOT EXISTS "AuditLog_created_at_idx" ON "AuditLog"("created_at");
