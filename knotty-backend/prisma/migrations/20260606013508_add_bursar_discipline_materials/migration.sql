-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'BURSAR';
ALTER TYPE "Role" ADD VALUE 'DISCIPLINE';

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "class_id" TEXT,
    "level_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL DEFAULT 'document',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Material_school_id_idx" ON "Material"("school_id");

-- CreateIndex
CREATE INDEX "Material_class_id_idx" ON "Material"("class_id");

-- CreateIndex
CREATE INDEX "Material_level_id_idx" ON "Material"("level_id");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;
