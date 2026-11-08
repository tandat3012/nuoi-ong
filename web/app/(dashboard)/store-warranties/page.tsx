import type { Metadata } from "next";
import { Suspense } from "react";
import { StoreWarrantiesScreen } from "@/features/store-warranties";

export const metadata: Metadata = { title: "Bảo hành sau bán" };

export default function Page() {
  // useSearchParams (?orderId=) needs a Suspense boundary on static routes.
  return (
    <Suspense>
      <StoreWarrantiesScreen />
    </Suspense>
  );
}
