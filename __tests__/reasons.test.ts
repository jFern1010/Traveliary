/// <reference types="node" />
// Node types for this test only (it reads a migration file); app code must not see Node globals.
import { readFileSync } from 'fs';
import { join } from 'path';

import { REPORT_REASONS, reportOutcomeMessage } from '@/features/moderation/reasons';

describe('REPORT_REASONS', () => {
  it('only uses reasons the database accepts', () => {
    const sql = readFileSync(
      join(__dirname, '../supabase/migrations/20261017000000_moderation.sql'),
      'utf8',
    );
    const allowed = sql.match(/reason in \(([^)]+)\)/)?.[1] ?? '';
    for (const { value } of REPORT_REASONS) {
      expect(allowed).toContain(`'${value}'`);
    }
  });
});

describe('reportOutcomeMessage', () => {
  it('explains each outcome', () => {
    expect(reportOutcomeMessage('reported')).toMatch(/won’t see/);
    expect(reportOutcomeMessage('already_reported')).toMatch(/already/);
    expect(reportOutcomeMessage('hidden')).toMatch(/hidden for everyone/);
  });
});
