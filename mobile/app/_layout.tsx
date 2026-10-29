import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Vollkorn_500Medium,
  Vollkorn_600SemiBold,
} from '@expo-google-fonts/vollkorn';
import { ClerkProvider } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { Pressable, Text, View } from 'react-native';

import { AuthContextProvider } from '@/src/features/auth/context/AuthContext';
import { PushRegistrationProvider } from '@/src/features/notifications/context/PushRegistrationProvider';
import { pushRegistrationManager } from '@/src/features/notifications/push-registration-runtime';
import { completeSessionStartup } from '@/src/features/auth/session/startup-runtime';
import { signOutDevice } from '@/src/features/auth/session/sign-out-device';
import { clearApiCache } from '@/src/shared/api/client';
import { colors, spacing, typography } from '@/src/core/theme/tokens';

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, token: string) {
    await SecureStore.setItemAsync(key, token);
  },
};

function SessionStartup({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, signOut, getToken, userId, sessionId } =
    useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const resetStarted = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || resetStarted.current) return;
    resetStarted.current = true;

    void (async () => {
      try {
        await completeSessionStartup(async (decision) => {
          if (decision.shouldSignOut && isSignedIn) {
            await signOutDevice({
              unregisterDevice: () =>
                userId
                  ? pushRegistrationManager.beforeSignOut(
                      () => getToken({ skipCache: true }),
                      userId,
                    )
                  : Promise.resolve(),
              signOut: async () => {
                if (!sessionId) throw new Error('Session unavailable');
                await signOut({ sessionId });
              },
              clearCache: clearApiCache,
            });
          }
        });
        if (mounted.current) setReady(true);
      } catch {
        if (mounted.current) setError(true);
      }
    })();
  }, [attempt, getToken, isLoaded, isSignedIn, sessionId, signOut, userId]);

  if (error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.spaceLg,
          gap: spacing.spaceMd,
        }}
      >
        <Text style={{ ...typography.bodyMd, color: colors.onSurface }}>
          Chưa thể chuẩn bị phiên đăng nhập.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            resetStarted.current = false;
            setError(false);
            setAttempt((value) => value + 1);
          }}
        >
          <Text style={{ ...typography.labelLg, color: colors.primary }}>
            Thử lại
          </Text>
        </Pressable>
      </View>
    );
  if (!ready) return null;
  return <>{children}</>;
}

function AppNavigator() {
  const { isSignedIn } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="auth" options={{ animation: 'none' }} />
      <Stack.Protected guard={!!isSignedIn}>
        {[
          'dashboard',
          'inventory',
          'inventory-detail',
          'low-stock',
          'activity',
          'activity/[id]',
          'activity/record',
          'assets/return',
          'counts/[id]',
          'counts/new',
          'lots/[id]',
          'maintenance/new',
          'maintenance/history',
          'maintenance/requests/[id]',
          'materials/new',
          'receipts/index',
          'receipts/[id]',
          'receipts/new',
          'scan/index',
          'scan/[qrToken]',
          'scan/item/[itemId]',
          'scan/inventory/[balanceId]',
          'transfers/[id]',
          'transfers/new',
          'notifications',
          'account/index',
          'account/profile',
          'account/notifications',
        ].map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={
              name === 'dashboard' || name === 'account/index'
                ? { animation: 'none' }
                : undefined
            }
          />
        ))}
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans: PlusJakartaSans_400Regular,
    PlusJakartaSansMedium: PlusJakartaSans_500Medium,
    PlusJakartaSansSemiBold: PlusJakartaSans_600SemiBold,
    PlusJakartaSansBold: PlusJakartaSans_700Bold,
    VollkornMedium: Vollkorn_500Medium,
    VollkornSemiBold: Vollkorn_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <SessionStartup>
        <AuthContextProvider>
          <PushRegistrationProvider>
            <StatusBar style="dark" />
            <AppNavigator />
          </PushRegistrationProvider>
        </AuthContextProvider>
      </SessionStartup>
    </ClerkProvider>
  );
}
