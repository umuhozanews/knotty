import { getSupabaseClient } from './supabase';

export type ApiUser = {
  id: string;
  role: string;
  school_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  school?: { id: string; name: string; code: string } | null;
};

export type ApiStudent = {
  id: string;
  student_code: string;
  is_active: boolean;
  gender?: string | null;
  date_of_birth?: string | null;
  class_id?: string | null;
  user?: { first_name?: string | null; last_name?: string | null } | null;
  class?: { name?: string | null } | null;
  level?: { name?: string | null } | null;
  card_status?: string | null;
};

export type AttendanceSummaryResponse = {
  summary: { PRESENT?: number; ABSENT?: number; LATE?: number; EXCUSED?: number };
  total: number;
};

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getClient() {
  const client = getSupabaseClient();
  if (!client) throw new ApiError('Supabase is not configured for this build.');
  return client;
}

function toApiStudent(row: {
  student_id: string;
  admission_number: string;
  legal_name: string;
  date_of_birth: string;
  gender: string;
  class_section_id: string;
  class_section_name: string;
  education_level_name: string;
  student_status: string;
  card_status: string;
}): ApiStudent {
  const nameParts = (row.legal_name || '').trim().split(/\s+/).filter(Boolean);
  return {
    id: row.student_id,
    student_code: row.admission_number || 'No admission number',
    is_active: row.student_status === 'active',
    gender: row.gender,
    date_of_birth: row.date_of_birth,
    class_id: row.class_section_id,
    user: { first_name: nameParts[0] || null, last_name: nameParts.slice(1).join(' ') || null },
    class: { name: row.class_section_name },
    level: { name: row.education_level_name },
    card_status: row.card_status,
  };
}

async function loadStudentRoster(schoolId: string, search = ''): Promise<ApiStudent[]> {
  const { data, error } = await getClient().rpc('list_school_students', {
    p_school_id: schoolId,
    ...(search.trim() ? { p_search: search.trim() } : {}),
  });
  if (error) throw new ApiError(error.message);
  return (data ?? []).map(toApiStudent);
}

export async function getCurrentUser(): Promise<ApiUser> {
  const client = getClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new ApiError('Your Supabase session is no longer valid. Please sign in again.');

  const { data: person, error: personError } = await client
    .from('persons')
    .select('id, status')
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (personError) throw new ApiError(personError.message);
  if (!person) throw new ApiError('This account is not linked to an active IshuriHUB profile.');

  const { data: membership, error: membershipError } = await client
    .from('school_memberships')
    .select('id, school_id')
    .eq('person_id', person.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw new ApiError(membershipError.message);
  if (!membership) throw new ApiError('This account has no active school membership.');

  const { data: role, error: roleError } = await client
    .from('school_membership_roles')
    .select('role_key')
    .eq('membership_id', membership.id)
    .eq('status', 'active')
    .order('assigned_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (roleError) throw new ApiError(roleError.message);
  if (!role?.role_key) throw new ApiError('This account has no active role at its school.');

  const { data: school, error: schoolError } = await client
    .from('schools')
    .select('id, name, code')
    .eq('id', membership.school_id)
    .maybeSingle();
  if (schoolError) throw new ApiError(schoolError.message);
  if (!school) throw new ApiError('The active school could not be loaded for this account.');

  const metadata = user.user_metadata ?? {};
  const fallbackName = user.email?.split('@')[0] || 'User';
  return {
    id: user.id,
    role: role.role_key,
    school_id: school.id,
    first_name: typeof metadata.first_name === 'string' ? metadata.first_name : fallbackName,
    last_name: typeof metadata.last_name === 'string' ? metadata.last_name : '',
    email: user.email ?? '',
    school: { id: school.id, name: school.name, code: school.code },
  };
}

export async function signIn(email: string, password: string): Promise<ApiUser> {
  const { data, error } = await getClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.session) throw new ApiError(error?.message || 'Sign-in did not create a session.');

  try {
    return await getCurrentUser();
  } catch (cause) {
    await getClient().auth.signOut();
    throw cause;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await getClient().auth.signOut();
  if (error) throw new ApiError(error.message);
}

export async function getStudents(schoolId: string, search = '', limit = 100): Promise<{ students: ApiStudent[]; total: number }> {
  const students = await loadStudentRoster(schoolId, search);
  return { students: students.slice(0, limit), total: students.length };
}

export async function getStudent(schoolId: string, id: string): Promise<ApiStudent> {
  const students = await loadStudentRoster(schoolId);
  const student = students.find((record) => record.id === id);
  if (!student) throw new ApiError('Student record was not found or you do not have access to it.');
  return student;
}

export async function getAttendanceSummary(schoolId: string): Promise<AttendanceSummaryResponse> {
  const client = getClient();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
  const countFor = async (status?: string) => {
    let query = client.from('attendance_records').select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('attendance_date', today);
    if (status) query = query.eq('status', status);
    const { count, error } = await query;
    if (error) throw new ApiError(error.message);
    return count ?? 0;
  };

  const [total, present, absent, late, excused] = await Promise.all([
    countFor(), countFor('present'), countFor('absent'), countFor('late'), countFor('excused'),
  ]);
  return { summary: { PRESENT: present, ABSENT: absent, LATE: late, EXCUSED: excused }, total };
}

export type SchoolCard = {
  card_assignment_id: string;
  holder_kind: string;
  student_id: string | null;
  status: string;
  issued_at: string;
  activated_at: string | null;
};

export async function listStudentCards(schoolId: string): Promise<SchoolCard[]> {
  const { data, error } = await getClient().rpc('list_school_cards', { p_school_id: schoolId });
  if (error) throw new ApiError(error.message);
  return (data ?? []).filter((card) => card.holder_kind === 'student');
}

export async function issueStudentNfcCard(schoolId: string, studentId: string, identifier: string): Promise<void> {
  const { data, error } = await getClient().functions.invoke('issue-card', {
    body: { school_id: schoolId, holder_kind: 'student', student_id: studentId, staff_record_id: null, identifier_kind: 'nfc_uid', identifier: identifier.trim() },
  });
  if (error) throw new ApiError(error.message);
  if (!data?.card_assignment_id) throw new ApiError(data?.error || 'Card issuance failed.');
}

export async function updateStudentCardStatus(schoolId: string, cardId: string, status: 'suspended' | 'lost' | 'active', reason: string): Promise<void> {
  const { error } = await getClient().rpc('change_card_status', {
    p_school_id: schoolId, p_card_assignment_id: cardId, p_new_status: status, p_reason: reason.trim(),
  });
  if (error) throw new ApiError(error.message);
}
