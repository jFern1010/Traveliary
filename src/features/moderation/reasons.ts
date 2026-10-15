/** Must match the `reports.reason` check constraint in the moderation migration. */
export const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Inappropriate or offensive' },
  { value: 'privacy', label: 'Shows someone without consent' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'wrong_place', label: 'Not taken at this place' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'] | 'other';

export type ReportOutcome = 'reported' | 'already_reported' | 'hidden';

export function reportOutcomeMessage(outcome: ReportOutcome): string {
  switch (outcome) {
    case 'already_reported':
      return 'You already reported this photo. It’s hidden for you.';
    case 'hidden':
      return 'Thanks. Several travelers reported this photo, so it’s now hidden for everyone.';
    default:
      return 'Thanks for reporting. You won’t see this photo anymore.';
  }
}
