import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppShell, Card, Icon, PageHeader, Pill } from '@/src/shared/ui/MobileShell';
import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';

const scannerDots = Array.from({ length: 48 }, (_, index) => index);

export default function QrScanScreen() {
  const router = useRouter();
  const { warehouseId } = useLocalSearchParams<{ warehouseId?: string }>();
  const { data, currentFarmId } = useAuthContext();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [token, setToken] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [phase, setPhase] = useState<1 | 2>(1);
  const laserProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      void requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(laserProgress, { toValue: 1, duration: 1300, useNativeDriver: true }),
      Animated.timing(laserProgress, { toValue: 0, duration: 1300, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [laserProgress]);

  function openAsset(valueOverride?: string) {
    const rawValue = (valueOverride ?? token).trim();
    if (isExpoQr(rawValue)) {
      Alert.alert(
        'Sai loại mã QR',
        'Đây là mã QR của Expo Go. Hãy mở tab Quét QR trong ứng dụng rồi quét mã tồn kho hoặc tài sản.',
      );
      return;
    }
    const value = extractQrToken(rawValue);
    if (!currentFarmId) {
      Alert.alert('Chưa chọn trang trại', 'Vui lòng chọn trang trại trước khi quét QR.');
      return;
    }
    if (value.startsWith('inventory:')) {
      router.push(`/scan/inventory/${encodeURIComponent(value.slice('inventory:'.length))}` as never);
    } else if (value.startsWith('item:')) {
      router.push(`/scan/item/${encodeURIComponent(value.slice('item:'.length))}${warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''}` as never);
    } else if (value) {
      router.push(`/scan/${encodeURIComponent(value)}` as never);
    }
    else Alert.alert('Thiếu mã QR', 'Hãy quét hoặc nhập qrToken trước khi tra cứu.');
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    const rawValue = result.data.trim();
    if (isExpoQr(rawValue)) {
      setBarcodeScanned(false);
      Alert.alert(
        'Sai loại mã QR',
        'Mã vừa quét là mã mở Expo Go, không phải mã nghiệp vụ. Hãy quét mã QR tồn kho hoặc tài sản được tạo từ hệ thống.',
      );
      return;
    }
    const scannedToken = extractQrToken(rawValue);
    if (!scannedToken || barcodeScanned) return;
    setBarcodeScanned(true);
    setToken(scannedToken);
    openAsset(scannedToken);
  }

  function resetScanner() {
    setToken('');
    setFlashOn(false);
    setCameraFacing('back');
    setBarcodeScanned(false);
    setPhase(1);
  }

  function startNewScan() {
    resetScanner();
  }

  return <AppShell active="scan">
    <PageHeader title={data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại'} subtitle="● Hệ thống quản lý trại • Trực tuyến" action={<Pressable onPress={resetScanner} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.sync, pressed && styles.pressed]} accessibilityLabel="Làm mới"><Icon name="sync" color={colors.primary} /></Pressable>} />
    <View style={styles.tabs}>
      <Pressable onPress={() => setPhase(1)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.tab, phase === 1 && styles.activeTab, pressed && styles.pressed]}><Icon name="qr-code-scanner" color={phase === 1 ? colors.onPrimary : colors.deepAmber} /><Text style={[styles.tabText, phase === 1 && styles.activeTabText]}>Phase 1: Quét mã & Nhập</Text></Pressable>
      <Pressable onPress={() => openAsset()} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.tab, phase === 2 && styles.activeTab, pressed && styles.pressed]}><Icon name="verified" color={phase === 2 ? colors.onPrimary : colors.deepAmber} /><Text style={[styles.tabText, phase === 2 && styles.activeTabText]}>Phase 2: Chi tiết kết quả</Text></Pressable>
    </View>
    {phase === 1 ? <>
      <View style={styles.scanner}>
        <View style={styles.scannerDots}>{scannerDots.map((dot) => <View key={dot} style={styles.scannerDot} />)}</View>
        <View style={styles.scannerTop}><View style={styles.live}><View style={styles.liveDot} /><Icon name="videocam" size={15} color={colors.parchment} /><Text style={styles.liveText}>LIVE 60FPS</Text></View><View style={styles.cameraControls}><Pressable onPress={() => setFlashOn((value) => !value)} android_ripple={{ color: colors.honeyChip }} style={({ pressed }) => [styles.cameraButton, flashOn && styles.cameraButtonActive, pressed && styles.pressed]} accessibilityLabel="Bật tắt đèn flash"><Icon name="flash-on" color={colors.parchment} /></Pressable><Pressable onPress={() => setCameraFacing((value) => value === 'back' ? 'front' : 'back')} android_ripple={{ color: colors.honeyChip }} style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]} accessibilityLabel="Đổi camera"><Icon name="flip-camera-ios" color={colors.parchment} /></Pressable></View></View>
        <View style={styles.frame}>
          {cameraPermission?.granted ? <CameraView
            style={styles.cameraPreview}
            facing={cameraFacing}
            enableTorch={flashOn}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={barcodeScanned ? undefined : handleBarcodeScanned}
          /> : <View style={styles.permissionPanel}><Icon name="photo-camera" size={34} color={colors.parchment} /><Text style={styles.permissionTitle}>{cameraPermission?.canAskAgain === false ? 'Quyền camera đang bị từ chối' : 'Cần quyền camera để quét QR'}</Text><Text style={styles.permissionText}>{cameraPermission?.canAskAgain === false ? 'Hãy bật Camera trong Cài đặt của điện thoại rồi thử lại.' : 'Cho phép ứng dụng dùng camera để nhận qrToken từ tem QR.'}</Text><Pressable onPress={() => void requestCameraPermission()} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}><Text style={styles.permissionButtonText}>{cameraPermission?.canAskAgain === false ? 'Mở lại quyền camera' : 'Cho phép camera'}</Text></Pressable></View>}
          <View style={styles.cornerTopLeft} /><View style={styles.cornerTopRight} /><View style={styles.cornerBottomLeft} /><View style={styles.cornerBottomRight} /><Animated.View style={[styles.laser, { transform: [{ translateY: laserProgress.interpolate({ inputRange: [0, 1], outputRange: [-92, 92] }) }] }]} />
        </View>
        <Text style={styles.scannerHintText} numberOfLines={2}>{barcodeScanned ? 'Đã nhận qrToken, đang mở kết quả' : 'Đưa tem QR vào khung để quét'}</Text>
        <Text style={styles.cameraHelp}>⌗ Giữ camera vuông góc khoảng 15–25cm với tem QR</Text>
      </View>
      <Card style={styles.manual}><View style={styles.manualHead}><View style={styles.manualTitleRow}><Icon name="keyboard" color={colors.primary} /><Text style={styles.manualTitle} numberOfLines={2}>Nhập qrToken thủ công</Text></View><Pill tone="cream"><Text style={styles.assetLabel}>Asset / UUID</Text></Pill></View><View style={styles.inputWrap}><Icon name="qr-code-2" color={colors.onSurfaceVariant} /><TextInput value={token} onChangeText={setToken} autoCapitalize="none" style={styles.input} placeholder="Dán token lấy từ tem QR" placeholderTextColor={colors.onSurfaceVariant} /><Pressable onPress={() => setToken('')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]} accessibilityLabel="Xóa mã"><Icon name="cancel" color={colors.onSurfaceVariant} /></Pressable></View><Pressable onPress={() => openAsset()} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.lookup, pressed && styles.pressed]}><Icon name="search" size={24} color={colors.onPrimary} /><Text style={styles.lookupText}>Tra cứu & Xem chi tiết</Text></Pressable></Card>
      <Text style={styles.footer} numberOfLines={2}>Tra cứu QR theo farm hiện tại • Clerk JWT{`\n`}Dữ liệu từ API</Text>
    </> : <Card style={styles.phaseTwo}><View style={styles.phaseTwoHead}><View style={styles.phaseTwoCopy}><Text style={styles.phaseTwoEyebrow}>PHASE 2</Text><Text style={styles.phaseTwoTitle} numberOfLines={2}>Token đã sẵn sàng tra cứu</Text></View><Pill tone="cream"><Text style={styles.assetLabel}>CHỜ API</Text></Pill></View><View style={styles.assetPreview}><View style={styles.assetPreviewIcon}><Icon name="qr-code-2" size={42} color={colors.primary} /></View><View style={styles.assetPreviewCopy}><Text style={styles.assetName} numberOfLines={2}>Kết quả sẽ lấy từ cơ sở dữ liệu</Text><Text style={styles.assetCode} numberOfLines={3}>{token || 'Chưa có qrToken'}</Text></View></View><View style={styles.phaseTwoActions}><Pressable onPress={startNewScan} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Icon name="arrow-back" color={colors.deepAmber} /><Text style={styles.secondaryText}>Quét lại</Text></Pressable><Pressable onPress={() => openAsset()} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.lookup, pressed && styles.pressed]}><Icon name="open-in-new" color={colors.onPrimary} /><Text style={styles.lookupText}>Mở kết quả API</Text></Pressable></View></Card>}
  </AppShell>;
}

function extractQrToken(value: string) {
  const trimmed = value.trim();
  const inventoryRouteMatch = trimmed.match(/\/scan\/inventory\/([^/?#]+)/i);
  if (inventoryRouteMatch?.[1]) return `inventory:${decodeURIComponent(inventoryRouteMatch[1])}`;
  const itemRouteMatch = trimmed.match(/\/scan\/item\/([^/?#]+)/i);
  if (itemRouteMatch?.[1]) return `item:${decodeURIComponent(itemRouteMatch[1])}`;
  const routeMatch = trimmed.match(/\/scan\/([^/?#]+)/i);
  if (routeMatch?.[1]) {
    try {
      return decodeURIComponent(routeMatch[1]);
    } catch {
      return routeMatch[1];
    }
  }
  return trimmed;
}

function isExpoQr(value: string) {
  return /^exp:\/\//i.test(value.trim());
}

const styles = StyleSheet.create({
  sync: { width: dimensions.iconButton, height: dimensions.iconButton, borderRadius: radius.full, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  tabs: { minHeight: 48, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row' },
  tab: { flex: 1, minWidth: 0, minHeight: 38, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.spaceXs },
  activeTab: { backgroundColor: colors.primaryContainer, shadowColor: colors.deepAmber, shadowOpacity: 0.14, shadowRadius: 8, elevation: 2 },
  tabText: { ...typography.labelLg, color: colors.deepAmber, textAlign: 'center', flexShrink: 1 },
  activeTabText: { ...typography.labelLg, color: colors.onPrimary },
  scanner: { height: 470, borderRadius: radius.lg, backgroundColor: colors.darkScanner, borderWidth: 2, borderColor: colors.honey, overflow: 'hidden', padding: spacing.spaceMd, justifyContent: 'space-between', shadowColor: colors.deepAmber, shadowOpacity: 0.18, shadowRadius: 12, elevation: 3 },
  scannerDots: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', flexWrap: 'wrap', padding: spacing.spaceLg, gap: 23, opacity: 0.26 },
  scannerDot: { width: 3, height: 3, borderRadius: radius.full, backgroundColor: colors.honey },
  scannerTop: { zIndex: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.spaceSm },
  live: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.spaceSm, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.darkScannerSurface, borderWidth: 1, borderColor: colors.outline },
  liveDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.statusSuccess },
  liveText: { ...typography.labelMd, color: colors.parchment, flexShrink: 1 },
  cameraControls: { flexDirection: 'row', gap: spacing.spaceSm },
  cameraButton: { width: dimensions.iconButton, height: dimensions.iconButton, borderRadius: radius.full, backgroundColor: colors.scannerGlass, borderWidth: 1, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  cameraButtonActive: { backgroundColor: colors.primaryContainer },
  frame: { width: '100%', height: 250, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.md },
  cameraPreview: StyleSheet.absoluteFill,
  cornerTopLeft: { position: 'absolute', top: 12, left: 30, width: 48, height: 48, borderTopWidth: 4, borderLeftWidth: 4, borderColor: colors.honey, borderTopLeftRadius: 12 },
  cornerTopRight: { position: 'absolute', top: 12, right: 30, width: 48, height: 48, borderTopWidth: 4, borderRightWidth: 4, borderColor: colors.honey, borderTopRightRadius: 12 },
  cornerBottomLeft: { position: 'absolute', bottom: 12, left: 30, width: 48, height: 48, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: colors.honey, borderBottomLeftRadius: 12 },
  cornerBottomRight: { position: 'absolute', bottom: 12, right: 30, width: 48, height: 48, borderBottomWidth: 4, borderRightWidth: 4, borderColor: colors.honey, borderBottomRightRadius: 12 },
  permissionPanel: { ...StyleSheet.absoluteFill, padding: spacing.spaceMd, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.darkScannerSurface, gap: spacing.spaceSm },
  permissionTitle: { ...typography.labelLg, color: colors.parchment, textAlign: 'center', flexShrink: 1 },
  permissionText: { ...typography.bodySm, color: colors.inverseOnSurface, textAlign: 'center', flexShrink: 1 },
  permissionButton: { minHeight: 40, paddingHorizontal: spacing.spaceMd, borderRadius: radius.full, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  permissionButtonText: { ...typography.labelMd, color: colors.onPrimary },
  laser: { position: 'absolute', top: '50%', left: spacing.spaceLg, right: spacing.spaceLg, height: 3, backgroundColor: colors.honey, borderRadius: radius.full, shadowColor: colors.honey, shadowOpacity: 0.9, shadowRadius: 10, elevation: 4 },
  scannerHintText: { ...typography.labelMd, color: colors.inverseOnSurface, textAlign: 'center', flexShrink: 1, zIndex: 2 },
  cameraHelp: { ...typography.bodySm, color: colors.inverseOnSurface, textAlign: 'center', paddingTop: spacing.spaceSm, zIndex: 2 },
  manual: { gap: spacing.spaceMd },
  manualHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceSm, flexWrap: 'wrap', paddingBottom: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  manualTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  manualTitle: { ...typography.headlineSm, color: colors.deepAmber, flexShrink: 1 },
  assetLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  inputWrap: { height: dimensions.fieldHeight, paddingHorizontal: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  input: { flex: 1, minWidth: 0, color: colors.onSurface, ...typography.bodyMd },
  iconAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  lookup: { minHeight: dimensions.actionHeight, flex: 1, borderRadius: radius.lg, backgroundColor: colors.primaryContainer, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm, paddingHorizontal: spacing.spaceMd },
  lookupText: { ...typography.labelLg, color: colors.onPrimary, flexShrink: 1, textAlign: 'center' },
  suggestions: { borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: spacing.spaceMd },
  suggestionTitle: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  codes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.spaceSm, marginTop: spacing.spaceSm },
  code: { paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  codeText: { ...typography.labelSm, color: colors.primary },
  footer: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', marginVertical: spacing.spaceLg },
  phaseTwo: { gap: spacing.spaceLg, backgroundColor: colors.surfaceContainerLowest },
  phaseTwoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceSm },
  phaseTwoCopy: { flex: 1, minWidth: 0 },
  phaseTwoEyebrow: { ...typography.labelSm, color: colors.secondary },
  phaseTwoTitle: { ...typography.headlineMd, color: colors.deepAmber, marginTop: 4, flexShrink: 1 },
  assetPreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceMd, padding: spacing.spaceLg, borderRadius: radius.lg, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.secondaryContainer },
  assetPreviewIcon: { width: 64, height: 64, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  assetPreviewCopy: { flex: 1, minWidth: 0 },
  assetName: { ...typography.headlineSm, color: colors.deepAmber, flexShrink: 1 },
  assetCode: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 4, flexShrink: 1 },
  phaseTwoActions: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'stretch', flexWrap: 'wrap' },
  secondaryAction: { flex: 1, minWidth: 130, minHeight: dimensions.actionHeight, paddingHorizontal: spacing.spaceMd, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  secondaryText: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1, textAlign: 'center' },
});
