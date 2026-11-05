import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { formatStockDateInput, parseStockDateRange, toDisplayDate, type StockDateRange } from '@/src/features/inventory/stock-date-range';
import { Icon } from '@/src/shared/ui/MobileShell';

type DateField = 'from' | 'to';
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function selectedIso(value: string, field: DateField) {
  const parsed = field === 'from' ? parseStockDateRange(value, '') : parseStockDateRange('', value);
  return field === 'from' ? parsed.range?.dateFrom : parsed.range?.dateTo;
}

function calendarMonthFor(value: string, field: DateField) {
  const iso = selectedIso(value, field);
  if (!iso) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [year, month] = iso.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export default function StockDateRangeFilter({ value, onApply }: { value: StockDateRange; onApply: (range: StockDateRange) => void }) {
  const [from, setFrom] = useState(toDisplayDate(value.dateFrom));
  const [to, setTo] = useState(toDisplayDate(value.dateTo));
  const [error, setError] = useState<string | null>(null);
  const [calendarField, setCalendarField] = useState<DateField | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => calendarMonthFor('', 'from'));

  useEffect(() => {
    setFrom(toDisplayDate(value.dateFrom));
    setTo(toDisplayDate(value.dateTo));
    setError(null);
  }, [value.dateFrom, value.dateTo]);

  function apply() {
    const result = parseStockDateRange(from, to);
    if (result.error) { setError(result.error); return; }
    setError(null);
    onApply(result.range ?? {});
  }

  function clear() {
    setFrom('');
    setTo('');
    setError(null);
    onApply({});
  }

  function openCalendar(field: DateField) {
    setCalendarMonth(calendarMonthFor(field === 'from' ? from : to, field));
    setCalendarField(field);
  }

  function chooseDay(day: number) {
    if (!calendarField) return;
    const iso = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const other = calendarField === 'from' ? selectedIso(to, 'to') : selectedIso(from, 'from');
    if (other && (calendarField === 'from' ? iso > other : iso < other)) return;
    if (calendarField === 'from') setFrom(toDisplayDate(iso));
    else setTo(toDisplayDate(iso));
    setError(null);
    setCalendarField(null);
  }

  const offset = (calendarMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const otherIso = calendarField === 'from' ? selectedIso(to, 'to') : selectedIso(from, 'from');

  return <View style={styles.container}>
    <Text style={styles.title}>Lọc theo ngày</Text>
    <View style={styles.fields}>
      <View style={styles.field}><Text style={styles.label}>Từ ngày</Text><View style={styles.inputRow}><TextInput accessibilityLabel="Từ ngày" value={from} onChangeText={(text) => { setFrom(formatStockDateInput(text)); setError(null); }} placeholder="dd/mm/yyyy" placeholderTextColor={colors.onSurfaceVariant} keyboardType="numeric" maxLength={10} style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel="Chọn từ ngày trên lịch" onPress={() => openCalendar('from')} style={styles.calendarButton}><Icon name="calendar-today" size={19} color={colors.primary} /></Pressable></View></View>
      <View style={styles.field}><Text style={styles.label}>Đến ngày</Text><View style={styles.inputRow}><TextInput accessibilityLabel="Đến ngày" value={to} onChangeText={(text) => { setTo(formatStockDateInput(text)); setError(null); }} placeholder="dd/mm/yyyy" placeholderTextColor={colors.onSurfaceVariant} keyboardType="numeric" maxLength={10} style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel="Chọn đến ngày trên lịch" onPress={() => openCalendar('to')} style={styles.calendarButton}><Icon name="calendar-today" size={19} color={colors.primary} /></Pressable></View></View>
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={clear} style={styles.clear}><Text style={styles.clearText}>Xóa ngày</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={apply} style={styles.apply}><Text style={styles.applyText}>Áp dụng</Text></Pressable>
    </View>
    <Modal visible={calendarField !== null} transparent animationType="fade" onRequestClose={() => setCalendarField(null)}>
      <View style={styles.backdrop}><View style={styles.calendarCard}>
        <Text style={styles.calendarHeading}>{calendarField === 'from' ? 'Chọn từ ngày' : 'Chọn đến ngày'}</Text>
        <View style={styles.calendarHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tháng trước" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.arrow}><Icon name="chevron-left" color={colors.primary} /></Pressable>
          <Text style={styles.monthTitle}>{calendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Tháng sau" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.arrow}><Icon name="chevron-right" color={colors.primary} /></Pressable>
        </View>
        <View style={styles.calendarGrid}>{weekdays.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
        <View style={styles.calendarGrid}>{calendarDays.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.day} />;
          const iso = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const disabled = Boolean(otherIso && (calendarField === 'from' ? iso > otherIso : iso < otherIso));
          return <Pressable key={iso} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${day} tháng ${calendarMonth.getMonth() + 1} năm ${calendarMonth.getFullYear()}`} onPress={() => chooseDay(day)} style={[styles.day, disabled && styles.dayDisabled]}><Text style={styles.dayText}>{day}</Text></Pressable>;
        })}</View>
        <Pressable accessibilityRole="button" onPress={() => setCalendarField(null)} style={styles.close}><Text style={styles.closeText}>Đóng</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { padding: spacing.spaceMd, gap: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  title: { ...typography.labelLg, color: colors.deepAmber },
  fields: { flexDirection: 'row', gap: spacing.spaceSm },
  field: { flex: 1, minWidth: 0, gap: 4 },
  label: { ...typography.labelSm, color: colors.onSurfaceVariant },
  inputRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest },
  input: { flex: 1, minWidth: 0, minHeight: 42, paddingLeft: spacing.spaceSm, color: colors.onSurface, ...typography.bodyMd },
  calendarButton: { width: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.bodySm, color: colors.error },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.spaceSm },
  clear: { minHeight: 38, paddingHorizontal: spacing.spaceMd, alignItems: 'center', justifyContent: 'center' },
  clearText: { ...typography.labelMd, color: colors.primary },
  apply: { minHeight: 38, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryContainer },
  applyText: { ...typography.labelMd, color: colors.onPrimary },
  backdrop: { flex: 1, padding: spacing.spaceMd, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0008' },
  calendarCard: { width: '100%', maxWidth: 360, padding: spacing.spaceMd, gap: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerLowest },
  calendarHeading: { ...typography.labelLg, color: colors.deepAmber },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { ...typography.headlineSm, color: colors.onSurface },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', paddingVertical: spacing.spaceXs, ...typography.labelSm, color: colors.onSurfaceVariant },
  day: { width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  dayDisabled: { opacity: 0.3 },
  dayText: { ...typography.bodyMd, color: colors.onSurface },
  close: { alignSelf: 'flex-end', padding: spacing.spaceSm },
  closeText: { ...typography.labelMd, color: colors.primary },
});
