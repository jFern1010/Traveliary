import { resolveProjectId } from '@/features/notifications/project-id';

describe('resolveProjectId', () => {
  it('prefers the projectId from app config extra.eas', () => {
    expect(
      resolveProjectId({
        expoConfig: { extra: { eas: { projectId: 'from-extra' } } },
        easConfig: { projectId: 'from-eas' },
      }),
    ).toBe('from-extra');
  });

  it('falls back to easConfig', () => {
    expect(resolveProjectId({ expoConfig: {}, easConfig: { projectId: 'from-eas' } })).toBe(
      'from-eas',
    );
  });

  it('returns undefined when the project has not been linked to EAS', () => {
    expect(resolveProjectId({ expoConfig: null, easConfig: null })).toBeUndefined();
  });
});
