-- Add has_school_permission-based SELECT policies for academic tables as a
-- reliable backup path. The original active-membership policies remain; these
-- provide an OR path via the role/permission system for admin/manager users.
-- Also re-grants are explicit to ensure PostgREST schema cache is current.

-- Re-apply grants explicitly (idempotent; no-op if already granted)
GRANT SELECT ON TABLE
  public.education_levels,
  public.class_sections,
  public.subjects,
  public.class_subjects,
  public.teacher_assignments,
  public.student_enrollments,
  public.student_class_placements,
  public.academic_years,
  public.academic_terms
TO authenticated;

-- Backup SELECT policies for the core academic tables
CREATE POLICY education_levels_select_academics
  ON public.education_levels FOR SELECT TO authenticated
  USING (private.has_school_permission(school_id, 'academics.read'));

CREATE POLICY class_sections_select_academics
  ON public.class_sections FOR SELECT TO authenticated
  USING (private.has_school_permission(school_id, 'academics.read'));

CREATE POLICY subjects_select_academics_mgmt
  ON public.subjects FOR SELECT TO authenticated
  USING (private.has_school_permission(school_id, 'academics.read'));

CREATE POLICY class_subjects_select_academics_mgmt
  ON public.class_subjects FOR SELECT TO authenticated
  USING (private.has_school_permission(school_id, 'academics.read'));

CREATE POLICY teacher_assignments_select_academics_mgmt
  ON public.teacher_assignments FOR SELECT TO authenticated
  USING (private.has_school_permission(school_id, 'academics.read'));

CREATE POLICY student_enrollments_select_academics_mgmt
  ON public.student_enrollments FOR SELECT TO authenticated
  USING (private.has_school_permission(school_id, 'academics.read'));

CREATE POLICY student_class_placements_select_academics_mgmt
  ON public.student_class_placements FOR SELECT TO authenticated
  USING (private.has_school_permission(school_id, 'academics.read'));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
