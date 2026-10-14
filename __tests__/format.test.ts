import { formatRelativeDay } from '@/lib/format';

describe('formatRelativeDay', () => {
  const now = new Date(2026, 9, 14, 15, 0); // 14 Oct 2026, 15:00 local

  it('says today and yesterday by calendar day', () => {
    expect(formatRelativeDay(new Date(2026, 9, 14, 0, 5).toISOString(), now)).toBe('today');
    expect(formatRelativeDay(new Date(2026, 9, 13, 23, 55).toISOString(), now)).toBe('yesterday');
  });

  it('counts days within a week', () => {
    expect(formatRelativeDay(new Date(2026, 9, 11, 12, 0).toISOString(), now)).toBe('3 days ago');
  });

  it('falls back to a date after a week', () => {
    expect(formatRelativeDay(new Date(2026, 8, 1).toISOString(), now)).not.toMatch(/ago|today/);
  });

  it('treats future timestamps (clock skew) as today', () => {
    expect(formatRelativeDay(new Date(2026, 9, 15).toISOString(), now)).toBe('today');
  });
});
