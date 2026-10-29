import { AssetsScreen } from "@/features/assets";
export { QrScanner } from "./qr-scanner";
export { QrInventoryLookup } from "./qr-inventory-lookup";

export function QrAssetLookup({ assetCode }: { assetCode: string }) {
  return <AssetsScreen assetCode={assetCode} />;
}
