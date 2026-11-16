import type { ApiStudent } from './api';

const AVATAR_COLORS = ['#0F766E', '#1D4ED8', '#A21CAF', '#92400E', '#15803D'];

export function studentName(student: ApiStudent): string {
  return [student.user?.first_name, student.user?.last_name].filter(Boolean).join(' ') || 'Student';
}

export function studentInitials(student: ApiStudent): string {
  const name = studentName(student).split(/\s+/).filter(Boolean);
  return name.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S';
}

export function studentClass(student: ApiStudent): string {
  return [student.level?.name, student.class?.name].filter(Boolean).join(' · ') || 'Class not assigned';
}

export function studentAvatarColor(student: ApiStudent): string {
  const index = student.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function studentAge(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return 'Age not provided';
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return 'Age not provided';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return `${age} years`;
}
