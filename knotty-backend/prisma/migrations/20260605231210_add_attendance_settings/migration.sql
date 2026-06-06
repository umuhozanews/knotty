-- AlterTable
ALTER TABLE "School" ADD COLUMN     "school_start_time" TEXT NOT NULL DEFAULT '08:30',
ADD COLUMN     "tap_out_after_minutes" INTEGER NOT NULL DEFAULT 180;
