-- Replacement updates the old card pointer before inserting its replacement.
-- Defer validation until transaction end so both rows are written atomically;
-- the same-school target remains mandatory when the transaction commits.
alter table public.card_assignments
  drop constraint card_assignments_replacement_card_id_school_id_fkey;

alter table public.card_assignments
  add constraint card_assignments_replacement_card_id_school_id_fkey
  foreign key (replacement_card_id, school_id)
  references public.card_assignments(id, school_id)
  on delete restrict
  deferrable initially deferred;
