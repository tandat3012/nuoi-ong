type RecordDates = {
  status: string;
  scheduledAt: string | null;
  expectedReturnAt: string | null;
};
export function vietnamDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function maintenanceNextDate(
  receivedAt: string,
  months: number,
): string {
  const day = vietnamDate(receivedAt);
  const date = new Date(day + 'T00:00:00Z');
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return date.toISOString().slice(0, 10);
}
export function maintenanceAlert(
  record: RecordDates,
  now = new Date(),
): string | null {
  const due =
    record.status === 'SCHEDULED'
      ? record.scheduledAt
      : record.status === 'IN_PROGRESS'
        ? record.expectedReturnAt
        : null;
  if (!due) return null;
  const days = Math.round(
    (Date.parse(vietnamDate(due)) - Date.parse(vietnamDate(now))) / 86400000,
  );
  if (record.status === 'IN_PROGRESS')
    return days < 0 ? `Trễ hẹn trả ${-days} ngày` : null;
  return days < 0
    ? `Quá hạn bảo trì ${-days} ngày`
    : days === 0
      ? 'Đến hạn bảo trì hôm nay'
      : days <= 7
        ? `Sắp đến hạn trong ${days} ngày`
        : null;
}
