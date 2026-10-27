import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { colors, radius, spacing } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { listNotifications } from '../api';
import { Icon } from '@/src/shared/ui/MobileShell';

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!currentFarmId) {
      setUnreadCount(0);
      return;
    }
    void getAccessToken()
      .then((token) => token ? listNotifications(token, currentFarmId, 1) : null)
      .then((response) => {
        if (!cancelled && response) setUnreadCount(response.unreadCount);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, pathname]);

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}
      onPress={() => router.push('/notifications' as never)}
      android_ripple={{ color: colors.primaryFixed }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name="notifications-none" color={colors.deepAmber} />
      {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
    </Pressable>
  </>;
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginRight: spacing.spaceXs },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: radius.full, paddingHorizontal: 3, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
