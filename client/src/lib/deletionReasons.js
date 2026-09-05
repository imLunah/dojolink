// Why someone is deleting their account. The values mirror the server's
// DELETION_REASONS and the CHECK on account_deletions.reason.
export const DELETION_REASONS = [
  { value: 'leaving',    label: "We're leaving the center" },
  { value: 'not_useful', label: "I don't find it useful" },
  { value: 'privacy',    label: 'Privacy concerns' },
  { value: 'broken',     label: "Something isn't working" },
  { value: 'other',      label: 'Other' },
];
