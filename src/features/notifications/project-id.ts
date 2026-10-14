type ConfigSources = {
  expoConfig?: { extra?: { eas?: { projectId?: string } } } | null;
  easConfig?: { projectId?: string } | null;
};

/** The EAS project ID is written to app.json by `npx eas-cli@latest init`. */
export function resolveProjectId(sources: ConfigSources): string | undefined {
  return sources.expoConfig?.extra?.eas?.projectId ?? sources.easConfig?.projectId ?? undefined;
}
