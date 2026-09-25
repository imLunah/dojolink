// "Needs extra support" (migration 052): a staff-only mark on a ninja who needs
// a sensei beside them more than most. The reasons are a fixed list, mirrored
// by the CHECK on student_support.reason and SUPPORT_REASONS in
// server/routes/students.js; change all three together.
export const SUPPORT_REASONS = [
  { value: 'one_to_one', label: 'Needs one-to-one help', short: 'One-to-one help' },
  { value: 'settling_in', label: 'New, still settling in', short: 'Settling in' },
  { value: 'focus', label: 'Focus or behaviour', short: 'Focus or behaviour' },
  { value: 'learning', label: 'Learning support', short: 'Learning support' },
];

export const supportLabel = (reason) => SUPPORT_REASONS.find((r) => r.value === reason)?.label || '';
export const supportShort = (reason) => SUPPORT_REASONS.find((r) => r.value === reason)?.short || '';

// The mark's colour, fixed rather than the accent so it reads the same on
// every theme and is never mistaken for a selection.
export const SUPPORT_INK = '#e11d48';
