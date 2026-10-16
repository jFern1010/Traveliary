import { SUPPORT_EMAIL } from '@/constants/app-info';
import { LEGAL_CONTENT, LEGAL_TITLES } from '@/features/legal/content';

describe('legal content', () => {
  it.each(Object.keys(LEGAL_CONTENT) as (keyof typeof LEGAL_CONTENT)[])(
    '%s has a title, non-empty sections and a contact',
    (doc) => {
      expect(LEGAL_TITLES[doc]).toBeTruthy();
      for (const section of LEGAL_CONTENT[doc]) {
        expect(section.heading.trim()).not.toBe('');
        expect(section.body.trim()).not.toBe('');
      }
      expect(LEGAL_CONTENT[doc].map((s) => s.body).join(' ')).toContain(SUPPORT_EMAIL);
    },
  );

  it('terms state zero tolerance for abusive content (App Store guideline 1.2)', () => {
    expect(LEGAL_CONTENT.terms.some((s) => /zero tolerance/i.test(s.heading))).toBe(true);
  });
});
