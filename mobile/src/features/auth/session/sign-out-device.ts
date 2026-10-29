// Only revoke this installation and this Clerk session, never all user sessions.
export async function signOutDevice(dependencies: {
  unregisterDevice: () => Promise<void>;
  signOut: () => Promise<void>;
  clearCache: () => void;
}) {
  await dependencies.unregisterDevice();
  await dependencies.signOut();
  dependencies.clearCache();
}
