import { BeeLoader } from "@/shared/components/ui/bee-loader";

export default function StoreLoading() {
  return (
    <main className="grid min-h-[60vh] flex-1 place-items-center px-4">
      <BeeLoader label="Mộc Ong đang chuẩn bị..." />
    </main>
  );
}
