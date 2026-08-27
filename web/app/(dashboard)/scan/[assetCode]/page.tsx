import type { Metadata } from 'next';

import { QrAssetLookup } from '@/features/qr';

export const metadata: Metadata = { title: 'Hồ sơ tài sản' };

export default async function ScannedAssetPage({
  params,
}: PageProps<'/scan/[assetCode]'>) {
  const { assetCode } = await params;

  return <QrAssetLookup assetCode={assetCode} />;
}
