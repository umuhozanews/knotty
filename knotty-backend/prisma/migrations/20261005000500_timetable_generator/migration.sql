CREATE TYPE "ScheduleRunStatus" AS ENUM ('DRAFT','INFEASIBLE','PUBLISHED','SUPERSEDED');
CREATE TABLE "ScheduleRun" (
  "id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "academic_term_id" TEXT NOT NULL,
  "generated_by" TEXT NOT NULL, "status" "ScheduleRunStatus" NOT NULL DEFAULT 'DRAFT',
  "config" JSONB NOT NULL, "diagnostics" JSONB, "score" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "published_at" TIMESTAMP(3),
  CONSTRAINT "ScheduleRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScheduleRun_school_id_academic_term_id_status_created_at_idx" ON "ScheduleRun"("school_id","academic_term_id","status","created_at");
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ScheduleRunEntry" (
  "id" TEXT NOT NULL, "schedule_run_id" TEXT NOT NULL, "class_section_id" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL, "staff_id" TEXT NOT NULL, "day_of_week" INTEGER NOT NULL,
  "start_time" TEXT NOT NULL, "end_time" TEXT NOT NULL, "room" TEXT,
  "requirement_index" INTEGER NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleRunEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScheduleRunEntry_schedule_run_id_day_of_week_start_time_idx" ON "ScheduleRunEntry"("schedule_run_id","day_of_week","start_time");
CREATE INDEX "ScheduleRunEntry_class_section_id_idx" ON "ScheduleRunEntry"("class_section_id");
ALTER TABLE "ScheduleRunEntry" ADD CONSTRAINT "ScheduleRunEntry_schedule_run_id_fkey" FOREIGN KEY ("schedule_run_id") REFERENCES "ScheduleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleRunEntry" ADD CONSTRAINT "ScheduleRunEntry_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleRunEntry" ADD CONSTRAINT "ScheduleRunEntry_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleRunEntry" ADD CONSTRAINT "ScheduleRunEntry_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetableEntry" ADD COLUMN "schedule_run_id" TEXT;
CREATE INDEX "TimetableEntry_schedule_run_id_idx" ON "TimetableEntry"("schedule_run_id");
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_schedule_run_id_fkey" FOREIGN KEY ("schedule_run_id") REFERENCES "ScheduleRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;