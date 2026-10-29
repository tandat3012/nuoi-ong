import { requireOptionalNativeModule } from 'expo-modules-core';
import * as SecureStore from 'expo-secure-store';
import { evaluateSessionStartup, type StartupDecision } from './startup-policy';

const LAUNCH_KEY = 'nuoi-ong.auth.native-launch';
type SessionGlobals = typeof globalThis & {
  __nuoiOngStartup?: Promise<StartupDecision>;
  __nuoiOngStartupTask?: Promise<void>;
};

export function getSessionStartupDecision() {
  const runtime = globalThis as SessionGlobals;
  // Fast Refresh/remount shares this promise. A full Reload creates a new JS global.
  runtime.__nuoiOngStartup ??= (async () => {
    const native = __DEV__
      ? requireOptionalNativeModule<{ getLaunchId(): string | null }>(
          'NuoiOngSessionLifecycle',
        )
      : null;
    const launchId = native?.getLaunchId() ?? null;
    if (__DEV__ && !launchId)
      console.info(
        '[Session lifecycle] Rebuild the Android development app to enable sign-out on Expo/Metro Reload.',
      );
    return evaluateSessionStartup({
      development: __DEV__,
      launchId,
      readPreviousLaunch: () => SecureStore.getItemAsync(LAUNCH_KEY),
      writeLaunch: (id) => SecureStore.setItemAsync(LAUNCH_KEY, id),
    });
  })().catch((error: unknown) => {
    runtime.__nuoiOngStartup = undefined;
    throw error;
  });
  return runtime.__nuoiOngStartup;
}

export function completeSessionStartup(
  operation: (decision: StartupDecision) => Promise<void>,
) {
  const runtime = globalThis as SessionGlobals;
  // The entire operation, including sign-out, runs once per JS runtime. A remount
  // after the user signs in again must not consume the same Reload twice.
  runtime.__nuoiOngStartupTask ??= getSessionStartupDecision()
    .then(operation)
    .catch((error: unknown) => {
      runtime.__nuoiOngStartupTask = undefined;
      throw error;
    });
  return runtime.__nuoiOngStartupTask;
}
