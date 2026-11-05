-- Add GATEKEEPER and MATERIALS role definitions and permissions.
-- These roles were missing from the seed, so assigning them caused a FK
-- violation on school_membership_roles.role_key → role_definitions.

INSERT INTO private.role_definitions (scope, role_key, display_name) VALUES
  ('school', 'GATEKEEPER', 'Gatekeeper'),
  ('school', 'MATERIALS',  'Materials staff')
ON CONFLICT (scope, role_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      is_active    = true,
      updated_at   = now();

INSERT INTO private.role_permissions (scope, role_key, permission_key) VALUES
  -- GATEKEEPER: controls school gate, looks up students/staff/cards
  ('school', 'GATEKEEPER', 'schools.read'),
  ('school', 'GATEKEEPER', 'students.read'),
  ('school', 'GATEKEEPER', 'staff.read'),
  ('school', 'GATEKEEPER', 'cards.read'),
  ('school', 'GATEKEEPER', 'gate.read'),
  ('school', 'GATEKEEPER', 'gate.manage'),
  -- MATERIALS: manages school inventory and supplies
  ('school', 'MATERIALS',  'schools.read'),
  ('school', 'MATERIALS',  'students.read'),
  ('school', 'MATERIALS',  'staff.read'),
  ('school', 'MATERIALS',  'materials.read'),
  ('school', 'MATERIALS',  'materials.manage')
ON CONFLICT DO NOTHING;
