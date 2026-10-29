import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { QrInventoryLookup } from '@/features/qr';
import { isUuid } from '@/features/qr/scan.logic';

export const metadata: Metadata = { title: 'Tra cứu tồn kho' };

export default async function ScannedInventoryPage({
  params,
}: PageProps<'/scan/inventory/[balanceId]'>) {
  const { balanceId } = await params;
  if (!isUuid(balanceId)) notFound();
  return <QrInventoryLookup balanceId={balanceId.toLowerCase()} />;
}
