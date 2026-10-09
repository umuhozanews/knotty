CREATE TABLE "TimetablePlan" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_term_id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimetablePlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimetablePlan_school_id_academic_term_id_key"
ON "TimetablePlan"("school_id", "academic_term_id");

ALTER TABLE "TimetablePlan" ADD CONSTRAINT "TimetablePlan_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetablePlan" ADD CONSTRAINT "TimetablePlan_academic_term_id_fkey"
FOREIGN KEY ("academic_term_id") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TimetablePlan" ADD CONSTRAINT "TimetablePlan_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
