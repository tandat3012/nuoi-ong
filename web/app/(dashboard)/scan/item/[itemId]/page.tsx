import { notFound, redirect } from 'next/navigation';

import { isUuid } from '@/features/qr/scan.logic';

// Item labels open the inventory list filtered to that item.
export default async function ScannedItemPage({
  params,
}: PageProps<'/scan/item/[itemId]'>) {
  const { itemId } = await params;
  if (!isUuid(itemId)) notFound();
  redirect(`/inventory?itemId=${itemId.toLowerCase()}`);
}
