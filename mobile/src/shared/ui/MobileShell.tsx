import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, dimensions, gradients, radius, shadows, spacing, typography } from '@/src/core/theme/tokens';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];
export type NavKey = 'dashboard' | 'inventory' | 'scan' | 'receipts';

const navItems: Array<{ key: NavKey; label: string; icon: IconName }> = [
  { key: 'dashboard', label: 'Tổng quan', icon: 'dashboard' },
  { key: 'inventory', label: 'Tồn kho', icon: 'inventory-2' },
  { key: 'scan', label: 'Quét QR', icon: 'qr-code-scanner' },
  { key: 'receipts', label: 'Phiếu kho', icon: 'receipt-long' },
];

export function Icon({ name, size = 20, color = colors.onSurfaceVariant, filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  return <MaterialIcons name={name} size={size} color={color} style={filled ? styles.filledIcon : undefined} />;
}

function HexagonOutline({ size, color }: { size: number; color: string }) {
  const side = size / 2;
  const halfHeight = side * Math.sqrt(3) / 2;
  const line = (left: number, top: number, rotate: string) => ({
    position: 'absolute' as const,
    left,
    top,
    width: side,
    height: 1,
    backgroundColor: color,
    transform: [{ rotate }],
  });

  return (
    <View pointerEvents="none" style={{ width: size, height: halfHeight * 2 }}>
      <View style={line(side / 2, 0, '0deg')} />
      <View style={line(side * 1.25, halfHeight / 2, '60deg')} />
      <View style={line(side * 1.25, halfHeight * 1.5, '120deg')} />
      <View style={line(side / 2, halfHeight * 2 - 1, '0deg')} />
      <View style={line(-side * 0.25, halfHeight * 1.5, '60deg')} />
      <View style={line(-side * 0.25, halfHeight / 2, '120deg')} />
    </View>
  );
}

export function HoneycombDecor({ tone = 'amber', muted = false, size = 38 }: { tone?: 'amber' | 'green'; muted?: boolean; size?: number }) {
  const color = muted ? colors.outlineVariant : tone === 'green' ? colors.statusSuccess : colors.primary;
  const hexHeight = size * Math.sqrt(3) / 2;
  const clusterWidth = size * 2.5;
  const clusterHeight = hexHeight * 3;
  const cells = [
    { left: size * 0.75, top: 0 },
    { left: 0, top: hexHeight / 2 },
    { left: size * 1.5, top: hexHeight / 2 },
    { left: size * 0.75, top: hexHeight },
    { left: 0, top: hexHeight * 1.5 },
    { left: size * 1.5, top: hexHeight * 1.5 },
    { left: size * 0.75, top: hexHeight * 2 },
  ];
  return <View pointerEvents="none" style={[styles.honeycombDecor, { width: clusterWidth, height: clusterHeight, top: -hexHeight * 0.42, right: -size * 0.12 }, muted && styles.honeycombDecorMuted]}>
    {cells.map((cell, index) => <View key={index} style={[styles.honeycombCell, cell]}><HexagonOutline size={size} color={color} /></View>)}
  </View>;
}

export function Pill({ children, tone = 'cream' }: { children: ReactNode; tone?: 'cream' | 'amber' | 'success' | 'neutral' | 'danger' }) {
  const toneStyle = tone === 'amber' ? styles.pillAmber : tone === 'success' ? styles.pillSuccess : tone === 'danger' ? styles.pillDanger : tone === 'neutral' ? styles.pillNeutral : styles.pillCream;
  return <View style={[styles.pill, toneStyle]}>{children}</View>;
}

export function PageHeader({ title, subtitle, onBack, action }: { title: string; subtitle?: string; onBack?: () => void; action?: ReactNode }) {
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!subtitle?.startsWith('● ')) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(livePulse, { toValue: 0.35, duration: 850, useNativeDriver: true }),
      Animated.timing(livePulse, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [livePulse, subtitle]);
  const liveSubtitle = subtitle?.startsWith('● ') ? subtitle.slice(2) : subtitle;
  return (
    <View style={styles.header}>
      {onBack ? <Pressable onPress={onBack} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]} accessibilityLabel="Quay lại"><Icon name="arrow-back" color={colors.primary} /></Pressable> : null}
      <View style={styles.brandMark}><Icon name="hive" size={21} color={colors.primary} filled /></View>
      <View style={styles.headerCopy}>
        <Text numberOfLines={2} style={styles.headerTitle}>{title}</Text>
        {subtitle ? subtitle.startsWith('● ') ? <View style={styles.headerSubtitleRow}><Animated.View style={[styles.headerLiveDot, { opacity: livePulse }]} /><Text numberOfLines={2} style={styles.headerSubtitle}>{liveSubtitle}</Text></View> : <Text numberOfLines={2} style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ?? <View style={styles.headerSpacer} />}
    </View>
  );
}

export function SectionTitle({ title, count, action }: { title: string; count?: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitleRow}><Text numberOfLines={3} style={styles.sectionTitle}>{title}</Text>{count ? <Pill tone="neutral"><Text numberOfLines={2} style={styles.countText}>{count}</Text></Pill> : null}</View>
      {action}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ label, icon = 'check', onPress, compact = false, loading = false }: { label: string; icon?: IconName; onPress?: () => void; compact?: boolean; loading?: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 900, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [loading, rotation]);
  const iconTransform = { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
  return <Pressable onPress={onPress} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.primaryButton, compact && styles.primaryButtonCompact, pressed && styles.pressed]}><LinearGradient colors={gradients.honeyCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}><Animated.View style={loading ? iconTransform : undefined}><Icon name={icon} color={colors.onPrimary} filled /></Animated.View><Text numberOfLines={2} style={styles.primaryButtonText}>{label}</Text></LinearGradient></Pressable>;
}

export function AppShell({ active, children, scroll = true, showScrollIndicator = false, scanWarehouseId }: { active: NavKey; children: ReactNode; scroll?: boolean; showScrollIndicator?: boolean; scanWarehouseId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const content = <View style={styles.contentWidth}>{children}</View>;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}> 
      <View style={styles.mobileFrame}>
        {scroll ? <ScrollView showsVerticalScrollIndicator={showScrollIndicator} contentContainerStyle={{ paddingBottom: dimensions.bottomNavHeight + insets.bottom + spacing.spaceLg }}>{content}</ScrollView> : content}
        <View style={[styles.bottomDock, { paddingBottom: insets.bottom }]}> 
          <View style={styles.bottomNav}>
            {navItems.map((item) => {
              const selected = active === item.key;
              const destination = item.key === 'dashboard' ? '/dashboard' : item.key === 'receipts' ? '/receipts' : item.key === 'inventory' ? '/inventory' : `/scan${scanWarehouseId ? `?warehouseId=${encodeURIComponent(scanWarehouseId)}` : ''}`;
              return <Pressable key={item.key} onPress={() => router.navigate(destination as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.navItem, selected && item.key === 'scan' && styles.navItemScanActive, pressed && styles.pressed]}>
                <View style={[styles.navIconWrap, selected && item.key !== 'scan' && styles.navIconActive, selected && item.key === 'scan' && styles.navIconScanActive]}><Icon name={item.icon} size={selected && item.key === 'scan' ? 26 : selected ? 21 : 22} color={selected ? colors.onPrimary : colors.onSurfaceVariant} filled={selected} /></View>
                <Text numberOfLines={1} style={[styles.navLabel, selected && styles.navLabelActive, selected && item.key === 'scan' && styles.navLabelScanActive]}>{item.label}</Text>
              </Pressable>;
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  honeycombDecor: { position: 'absolute', opacity: 0.2, zIndex: 0 },
  honeycombDecorMuted: { opacity: 0.34 },
  honeycombCell: { position: 'absolute' },
  honeycombRowOneLeft: { top: -12, right: 31 },
  honeycombRowOneRight: { top: -12, right: 65 },
  honeycombRowTwoLeft: { top: 20, right: -3 },
  honeycombRowTwoCenter: { top: 20, right: 31 },
  honeycombRowTwoRight: { top: 20, right: 65 },
  honeycombRowThreeLeft: { top: 52, right: 31 },
  honeycombRowThreeRight: { top: 52, right: 65 },
  screen: { flex: 1, backgroundColor: colors.canvasCreamAlt },
  mobileFrame: { flex: 1, width: '100%', maxWidth: dimensions.screenMaxWidth, alignSelf: 'center', backgroundColor: colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.outlineVariant, overflow: 'hidden', ...shadows.floating },
  contentWidth: { width: '100%', maxWidth: dimensions.screenMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.gutterMobile, paddingTop: 0, gap: spacing.spaceMd, position: 'relative' },
  header: { minHeight: dimensions.headerHeight, marginHorizontal: -spacing.gutterMobile, paddingHorizontal: spacing.spaceMd, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  brandMark: { width: 40, height: 40, borderRadius: radius.default, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: 'VollkornSemiBold', fontSize: 16, lineHeight: 20, fontWeight: '600', color: colors.onSurface },
  headerSubtitle: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.onSurfaceVariant, marginTop: 1 },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, minWidth: 0 },
  headerLiveDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.statusSuccess },
  headerSpacer: { width: dimensions.iconButton },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  circleButton: { width: dimensions.iconButton, height: dimensions.iconButton, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', ...shadows.surface },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, flexShrink: 1 },
  sectionTitle: { ...typography.headlineSm, color: colors.onSurface, flexShrink: 1 },
  countText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  card: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.borderAmberGlow, borderRadius: radius.lg, padding: spacing.spaceMd, ...shadows.surface },
  pill: { minHeight: 24, maxWidth: '100%', minWidth: 0, paddingHorizontal: spacing.spaceSm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, flexWrap: 'wrap' },
  pillCream: { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
  pillAmber: { backgroundColor: colors.honeyChip, borderColor: colors.secondaryContainer },
  pillSuccess: { backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder },
  pillNeutral: { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
  pillDanger: { backgroundColor: colors.errorContainer, borderColor: colors.error },
  primaryButton: { minHeight: dimensions.actionHeight, borderRadius: radius.full, overflow: 'hidden', ...shadows.surface },
  primaryButtonCompact: { minHeight: 40 },
  primaryGradient: { flex: 1, minHeight: dimensions.actionHeight, paddingHorizontal: spacing.spaceMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  primaryButtonText: { ...typography.labelLg, color: colors.onPrimary, textAlign: 'center', flexShrink: 1 },
  bottomDock: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: colors.outlineVariant, ...shadows.floating },
  bottomNav: { height: dimensions.bottomNavHeight, maxWidth: dimensions.screenMaxWidth, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: spacing.spaceSm },
  navItem: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navItemScanActive: { minHeight: 50, marginTop: -14, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceXs, borderRadius: radius.default, backgroundColor: colors.primaryContainer, borderWidth: 2, borderColor: colors.surfaceContainerLowest, zIndex: 2, ...shadows.floatingEdge },
  navIconWrap: { minWidth: 44, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  navIconActive: { backgroundColor: colors.primaryContainer },
  navIconScanActive: { minWidth: 28, height: 28 },
  navLabel: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  navLabelScanActive: { color: colors.onPrimary, fontWeight: '700', letterSpacing: 0.4 },
  filledIcon: { fontWeight: '700' },
});
