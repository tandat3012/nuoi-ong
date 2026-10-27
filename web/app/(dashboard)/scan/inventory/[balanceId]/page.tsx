import { InventoryQrResult } from '@/features/qr/components/inventory-qr-result';

export default async function InventoryQrPage({ params }: { params: Promise<{ balanceId: string }> }) {
  const { balanceId } = await params;
  return <InventoryQrResult balanceId={balanceId} />;
}
