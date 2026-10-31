import { BeeLoader } from "@/shared/components/ui/bee-loader";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <BeeLoader />
    </main>
  );
}
