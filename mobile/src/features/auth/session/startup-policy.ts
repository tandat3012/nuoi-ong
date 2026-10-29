export type StartupDecision = {
  shouldSignOut: boolean;
  nativeAvailable: boolean;
};

export async function evaluateSessionStartup(options: {
  development: boolean;
  launchId: string | null;
  readPreviousLaunch: () => Promise<string | null>;
  writeLaunch: (id: string) => Promise<void>;
}): Promise<StartupDecision> {
  if (!options.development || !options.launchId) {
    return { shouldSignOut: false, nativeAvailable: !!options.launchId };
  }
  const previous = await options.readPreviousLaunch();
  await options.writeLaunch(options.launchId);
  return {
    shouldSignOut: previous === options.launchId,
    nativeAvailable: true,
  };
}
