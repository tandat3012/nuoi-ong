import { useRouter } from 'expo-router';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useSignIn } from '@clerk/clerk-expo';

import { Icon, Pill, PrimaryButton } from '@/src/shared/ui/MobileShell';
import { colors, radius, shadows, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';

const honeyImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBr3D-3PINLrsUYCnUmUlm-8DVhYl9vxumilCYaWFGf4PQS4OMJnKH_YGAdeP1ZskV0vdWl-t5k78nrVx9hapbrzsF0czy3S7PANhjFgPuI3O2aQyE3XOVcZzyRXKQQ863N4LM2fRnyKWtpILwLTyFeIQLzHOOF_zpGxK35Bgwt3GzYFMUtDsqHyBsRIQxa-68R02dAsoKYk6_Vd1CMIx9bzGyj1Ckcho4Kii_RQW6jfjNs4xEuVeTI3g';

type VerificationStage = 'first' | 'second';
type VerificationStrategy = 'email_code' | 'phone_code' | 'totp' | 'backup_code';
type VerificationState = {
  stage: VerificationStage;
  strategy: VerificationStrategy;
  emailAddressId?: string;
  phoneNumberId?: string;
};
type ClerkFactor = {
  strategy?: string;
  emailAddressId?: string;
  phoneNumberId?: string;
};
type ClerkAttempt = {
  status?: string;
  createdSessionId?: string | null;
  supportedFirstFactors?: ClerkFactor[] | null;
  supportedSecondFactors?: ClerkFactor[] | null;
};

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded: clerkLoaded } = useSignIn();
  const { isLoaded: sessionLoaded, isSignedIn } = useAuth();
  const { data, currentFarmId, isLoading: authLoading, error: authError, reload } = useAuthContext();
  const hasMembership = (data?.memberships.length ?? 0) > 0;
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [offline, setOffline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [toast, setToast] = useState('');
  const statusPulse = useRef(new Animated.Value(1)).current;
  const dashboardRedirectStarted = useRef(false);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(statusPulse, { toValue: 0.35, duration: 850, useNativeDriver: true }),
      Animated.timing(statusPulse, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [statusPulse]);

  useEffect(() => {
    if (sessionLoaded && isSignedIn && data && hasMembership && !dashboardRedirectStarted.current) {
      dashboardRedirectStarted.current = true;
      router.replace('/dashboard' as never);
    }
  }, [data, hasMembership, isSignedIn, router, sessionLoaded]);

  function showMessage(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  }

  async function prepareVerification(stage: VerificationStage, attempt: ClerkAttempt) {
    if (!signIn) return;

    const factors = stage === 'first' ? attempt.supportedFirstFactors : attempt.supportedSecondFactors;
    const factor = factors?.find((candidate) => ['email_code', 'phone_code', 'totp', 'backup_code'].includes(candidate.strategy ?? ''));
    const strategy = factor?.strategy as VerificationStrategy | undefined;

    if (!factor || !strategy) {
      showMessage(`Clerk trả về trạng thái ${attempt.status ?? 'không xác định'}, nhưng chưa có phương thức xác thực được hỗ trợ.`);
      return;
    }

    if (stage === 'first') {
      if (strategy === 'email_code') {
        if (!factor.emailAddressId) throw new Error('Clerk không trả về emailAddressId cho mã email.');
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
      } else if (strategy === 'phone_code') {
        if (!factor.phoneNumberId) throw new Error('Clerk không trả về phoneNumberId cho mã SMS.');
        await signIn.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId: factor.phoneNumberId });
      }
    } else if (strategy === 'email_code') {
      if (!factor.emailAddressId) throw new Error('Clerk không trả về emailAddressId cho mã email.');
      await signIn.prepareSecondFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
    } else if (strategy === 'phone_code') {
      if (!factor.phoneNumberId) throw new Error('Clerk không trả về phoneNumberId cho mã SMS.');
      await signIn.prepareSecondFactor({ strategy: 'phone_code', phoneNumberId: factor.phoneNumberId });
    }

    setVerification({
      stage,
      strategy,
      emailAddressId: factor.emailAddressId,
      phoneNumberId: factor.phoneNumberId,
    });
    setVerificationCode('');
    showMessage(strategy === 'email_code' ? 'Mã xác thực đã được gửi đến email.' : strategy === 'phone_code' ? 'Mã xác thực đã được gửi qua SMS.' : 'Nhập mã xác thực từ ứng dụng bảo mật.');
  }

  async function finishSession(attempt: ClerkAttempt) {
    if (attempt.status !== 'complete' || !attempt.createdSessionId) {
      showMessage(`Clerk chưa hoàn tất xác thực (trạng thái: ${attempt.status ?? 'không xác định'}).`);
      return false;
    }
    if (!setActive) {
      showMessage('Clerk chưa sẵn sàng để tạo phiên đăng nhập.');
      return false;
    }

    await setActive({ session: attempt.createdSessionId });
    setVerification(null);
    setVerificationCode('');
    showMessage('Đăng nhập thành công. Đang tải membership...');
    return true;
  }

  async function handleLogin() {
    if (isSignedIn) {
      if (data && !hasMembership) showMessage('Tài khoản chưa được cấp membership của trang trại.');
      else showMessage('Bạn đã đăng nhập. Đang tải thông tin trang trại...');
      return;
    }
    if (!clerkLoaded || !signIn) {
      showMessage('Clerk chưa sẵn sàng.');
      return;
    }
    setBusy(true);
    showMessage('Đang xác thực Clerk...');
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });
      const attempt = result as unknown as ClerkAttempt;
      if (await finishSession(attempt)) return;
      if (attempt.status === 'needs_first_factor') {
        await prepareVerification('first', attempt);
      } else if (attempt.status === 'needs_second_factor') {
        await prepareVerification('second', attempt);
      } else {
        showMessage(`Clerk yêu cầu bước xác thực chưa được hỗ trợ: ${attempt.status ?? 'không xác định'}.`);
      }
    } catch (cause) {
      showMessage(cause instanceof Error ? cause.message : 'Đăng nhập Clerk thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerification() {
    if (!signIn || !verification || !verificationCode.trim()) {
      showMessage('Nhập mã xác thực trước khi tiếp tục.');
      return;
    }

    setBusy(true);
    try {
      const payload = { strategy: verification.strategy, code: verificationCode.trim() };
      const result = verification.stage === 'first'
        ? await signIn.attemptFirstFactor(payload as Parameters<typeof signIn.attemptFirstFactor>[0])
        : await signIn.attemptSecondFactor(payload as Parameters<typeof signIn.attemptSecondFactor>[0]);
      const attempt = result as unknown as ClerkAttempt;
      if (await finishSession(attempt)) return;
      if (attempt.status === 'needs_second_factor') {
        await prepareVerification('second', attempt);
      } else {
        showMessage(`Mã chưa hoàn tất xác thực (trạng thái: ${attempt.status ?? 'không xác định'}).`);
      }
    } catch (cause) {
      showMessage(cause instanceof Error ? cause.message : 'Mã xác thực không hợp lệ.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoaded && isSignedIn && (!data || !hasMembership)) {
    const missingMembership = data && !hasMembership;
    return (
      <View style={styles.root}>
        <View style={[styles.sessionGate, { paddingTop: insets.top + spacing.spaceLg, paddingBottom: insets.bottom + spacing.spaceLg }]}>
          <View style={styles.sessionGateIcon}><Icon name={authLoading ? 'sync' : 'cloud-sync'} size={30} color={colors.primary} /></View>
          <Text style={styles.sessionGateTitle}>{missingMembership ? 'Chưa được cấp membership' : authLoading ? 'Đang khôi phục phiên' : 'Chưa tải được dữ liệu tài khoản'}</Text>
          <Text style={styles.sessionGateText}>{missingMembership ? 'Tài khoản đã đăng nhập nhưng chưa được cấp quyền vào trang trại.' : authLoading ? 'Đang đồng bộ membership và trang trại của bạn...' : authError?.message ?? 'Kiểm tra kết nối rồi thử tải lại.'}</Text>
          {!authLoading && !missingMembership ? <PrimaryButton label="Thử tải lại" icon="sync" onPress={reload} /> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.backgroundDecor}>
        <View style={styles.decorTopRight} />
        <View style={styles.decorMiddleLeft} />
        <View style={styles.decorBottomRight} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.spaceLg }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.statusBar}>
          <View style={styles.statusCopy}>
            <Animated.View style={[styles.statusDot, { opacity: statusPulse }]} />
            <Text style={styles.statusText} numberOfLines={1}>{data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa xác thực'}</Text>
            <Text style={styles.statusMuted} numberOfLines={1}>/ Trạm vệ tinh</Text>
          </View>
          <View style={styles.networkCopy}>
            <View style={styles.networkBadge}><Text style={styles.networkText}>Trực tuyến 4G</Text></View>
            <Icon name="wifi" size={16} color={colors.primary} />
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.card}>
            <View style={styles.brandHeader}>
              <View style={styles.logoFrame}>
                <Image source={{ uri: honeyImage }} style={styles.logo} />
                <View style={styles.logoOverlay}><Icon name="hive" size={30} color={colors.primary} filled /></View>
              </View>
              <Text style={styles.title} numberOfLines={2}>Hệ Thống Quản Lý Trại Ong</Text>
            </View>

            <View style={styles.form}>
              <View>
                <Text style={styles.label}>TÀI KHOẢN / EMAIL</Text>
                <View style={styles.inputWrap}>
                  <Icon name="person" color={colors.outline} />
                  <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="nhanvien@apiary.vn" placeholderTextColor={colors.outline} style={styles.input} />
                </View>
              </View>

              <View>
                <View style={styles.passwordLabel}>
                  <Text style={styles.label} numberOfLines={1}>MẬT KHẨU / MÃ PIN HIỆN TRƯỜNG</Text>
                  <Pressable onPress={() => showMessage('Liên hệ quản trị viên để cấp lại mã PIN.')} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}>
                    <Text style={styles.forgot}>Quên mã PIN?</Text>
                  </Pressable>
                </View>
                <View style={styles.inputWrap}>
                  <Icon name="lock" color={colors.outline} />
                  <TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="Nhập mật khẩu hoặc 6 số PIN" placeholderTextColor={colors.outline} style={styles.input} />
                  <Pressable onPress={() => setShowPassword((value) => !value)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]} accessibilityLabel="Ẩn hiện mật khẩu">
                    <Icon name={showPassword ? 'visibility-off' : 'visibility'} color={colors.outline} />
                  </Pressable>
                </View>
              </View>

              <Pressable onPress={() => setOffline((value) => !value)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.offline, pressed && styles.pressed]}>
                <Icon name={offline ? 'check-box' : 'check-box-outline-blank'} color={colors.primaryContainer} />
                <Text style={styles.offlineText}>Duy trì đăng nhập ngoại tuyến (Offline cache)</Text>
              </Pressable>
              {verification ? <View style={styles.verificationBox}>
                <Text style={styles.verificationTitle}>Xác thực bổ sung</Text>
                <Text style={styles.verificationHint}>{verification.strategy === 'email_code' ? 'Nhập mã Clerk đã gửi đến email.' : verification.strategy === 'phone_code' ? 'Nhập mã Clerk đã gửi qua SMS.' : 'Nhập mã từ ứng dụng xác thực.'}</Text>
                <TextInput value={verificationCode} onChangeText={setVerificationCode} autoCapitalize="none" keyboardType="number-pad" placeholder="Nhập mã xác thực" placeholderTextColor={colors.outline} style={styles.verificationInput} />
                <PrimaryButton label={busy ? 'Đang kiểm tra mã...' : 'Xác nhận mã'} icon={busy ? 'sync' : 'verified'} onPress={handleVerification} loading={busy} />
                <Pressable onPress={() => { setVerification(null); setVerificationCode(''); }} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.cancelVerification, pressed && styles.pressed]}>
                  <Text style={styles.cancelVerificationText}>Quay lại đăng nhập</Text>
                </Pressable>
              </View> : <PrimaryButton label={busy ? 'Đang xác thực Clerk...' : 'Đăng nhập vào Hệ thống'} icon={busy ? 'sync' : 'login'} onPress={handleLogin} loading={busy} />}
            </View>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.or}>hoặc xác thực nhanh tại hiện trường</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.quickRow}>
              <Quick icon="fingerprint" title="Sinh trắc học / Vân tay" sub="Thao tác đeo găng" onPress={() => { showMessage('Đang quét sinh trắc học TouchID/FaceID...'); setTimeout(() => showMessage('Xác thực vân tay thành công! Đang đồng bộ...'), 1200); }} />
              <Quick icon="qr-code-scanner" title="Quét thẻ QR Clerk" sub="Xác thực 1-chạm" onPress={() => showMessage('Đang khởi động camera quét mã QR thẻ Clerk...')} />
            </View>

          </View>

          <View style={styles.outdoor}>
            <Icon name="wb-sunny" size={18} color={colors.primary} />
            <Text style={styles.outdoorText}><Text style={styles.outdoorStrong}>Chế độ ngoài trời:</Text> Màn hình sử dụng độ tương phản cao, hỗ trợ thao tác nhanh khi làm việc trực tiếp tại các thùng ong ngoài vườn.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerCloud}><Icon name="cloud-done" size={15} color={colors.secondaryContainer} /><Text style={styles.footerStatus}>Máy chủ Cloud API — Chờ xác thực Clerk</Text></View>
          <Text style={styles.footerVersion}>Phiên bản v2.4.0 • Xác thực bảo mật Clerk JWT API & Quản lý Thu hoạch</Text>
        </View>
      </ScrollView>

      {toast ? <View style={[styles.toast, { bottom: insets.bottom + spacing.spaceLg }]}><Icon name="check-circle" size={17} color={colors.secondaryContainer} /><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

function Quick({ icon, title, sub, onPress }: { icon: Parameters<typeof Icon>[0]['name']; title: string; sub: string; onPress: () => void }) {
  return <Pressable onPress={onPress} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}>
    <View style={styles.quickIcon}><Icon name={icon} size={24} color={colors.primary} /></View>
    <Text style={styles.quickTitle} numberOfLines={2}>{title}</Text>
    <Text style={styles.quickSub} numberOfLines={2}>{sub}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvasCreamAlt },
  backgroundDecor: { ...StyleSheet.absoluteFill, overflow: 'hidden', opacity: 0.4 },
  decorTopRight: { position: 'absolute', width: 240, height: 240, borderRadius: radius.full, backgroundColor: colors.secondaryFixed, top: -80, right: -80, opacity: 0.4 },
  decorMiddleLeft: { position: 'absolute', width: 210, height: 210, borderRadius: radius.full, backgroundColor: colors.primaryFixed, top: '45%', left: -90, opacity: 0.3 },
  decorBottomRight: { position: 'absolute', width: 210, height: 210, borderRadius: radius.full, backgroundColor: colors.outlineVariant, bottom: -60, right: 40, opacity: 0.3 },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.marginMobile },
  statusBar: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: spacing.spaceXs, paddingTop: spacing.spaceMd, paddingBottom: spacing.spaceSm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  statusCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  statusDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.primaryContainer },
  statusText: { ...typography.bodySm, fontSize: 12, lineHeight: 16, color: colors.onSurfaceVariant, fontWeight: '500', flexShrink: 1 },
  statusMuted: { ...typography.bodySm, fontSize: 12, lineHeight: 16, color: colors.outline, flexShrink: 1 },
  networkCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  networkBadge: { paddingHorizontal: spacing.spaceSm, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  networkText: { ...typography.labelSm, fontSize: 11, lineHeight: 14, color: colors.primary },
  main: { width: '100%', maxWidth: 440, alignSelf: 'center', flex: 1, justifyContent: 'center', paddingVertical: spacing.spaceMd, gap: spacing.spaceMd },
  card: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.borderAmberGlow, borderRadius: radius.lg, padding: spacing.spaceLg, ...shadows.surface },
  brandHeader: { alignItems: 'center', marginBottom: spacing.spaceLg },
  logoFrame: { width: 80, height: 80, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.borderAmberGlow, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.spaceMd },
  logo: { width: '100%', height: '100%' },
  logoOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(144, 63, 0, 0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.headlineXlMobile, color: colors.primary, textAlign: 'center', flexShrink: 1 },
  form: { gap: spacing.spaceMd },
  verificationBox: { gap: spacing.spaceSm, padding: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.borderAmberGlow },
  verificationTitle: { ...typography.labelMd, color: colors.primary, fontWeight: '700' },
  verificationHint: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  verificationInput: { minHeight: 48, paddingHorizontal: spacing.spaceMd, borderRadius: radius.md, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant, color: colors.onSurface, ...typography.bodySm, letterSpacing: 2 },
  cancelVerification: { alignSelf: 'center', paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceXs, borderRadius: radius.sm },
  cancelVerificationText: { ...typography.labelSm, color: colors.primary, textDecorationLine: 'underline' },
  label: { ...typography.labelMd, color: colors.onSurfaceVariant, letterSpacing: 0.36, flexShrink: 1 },
  inputWrap: { minHeight: 48, paddingLeft: spacing.spaceMd, paddingRight: spacing.spaceSm, borderRadius: radius.md, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  input: { flex: 1, minWidth: 0, color: colors.onSurface, ...typography.bodySm, fontSize: 14 },
  passwordLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, marginBottom: spacing.spaceXs },
  forgotButton: { paddingVertical: spacing.spaceXs, paddingHorizontal: spacing.spaceXs, borderRadius: radius.sm },
  forgot: { ...typography.labelMd, color: colors.primary, textDecorationLine: 'underline', flexShrink: 0 },
  iconAction: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  offline: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, paddingVertical: spacing.spaceXs, borderRadius: radius.sm },
  offlineText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, marginVertical: spacing.spaceLg },
  line: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  or: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.outline, textAlign: 'center', flexShrink: 1 },
  quickRow: { flexDirection: 'row', gap: spacing.spaceSm },
  quick: { flex: 1, minHeight: 132, padding: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  quickIcon: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.spaceSm },
  quickTitle: { ...typography.labelMd, color: colors.onSurface, textAlign: 'center', flexShrink: 1 },
  quickSub: { ...typography.labelSm, color: colors.outline, textAlign: 'center', marginTop: 2, flexShrink: 1 },
  outdoor: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, padding: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.outlineVariant },
  outdoorText: { ...typography.bodySm, fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant, flex: 1, flexShrink: 1 },
  outdoorStrong: { color: colors.primary, fontWeight: '700' },
  footer: { width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'center', gap: spacing.spaceXs, paddingVertical: spacing.spaceMd },
  footerCloud: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, maxWidth: '100%' },
  footerStatus: { ...typography.bodySm, fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
  footerVersion: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.outline, textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  toast: { position: 'absolute', left: spacing.marginMobile, right: spacing.marginMobile, alignSelf: 'center', maxWidth: 400, paddingHorizontal: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.inverseSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm, ...shadows.floating },
  toastText: { ...typography.bodySm, color: colors.inverseOnSurface, textAlign: 'center', flexShrink: 1 },
  sessionGate: { flex: 1, width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: spacing.marginMobile, alignItems: 'center', justifyContent: 'center', gap: spacing.spaceMd },
  sessionGateIcon: { width: 68, height: 68, borderRadius: radius.full, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.borderAmberGlow, alignItems: 'center', justifyContent: 'center' },
  sessionGateTitle: { ...typography.headlineXl, color: colors.primary, textAlign: 'center' },
  sessionGateText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
});
