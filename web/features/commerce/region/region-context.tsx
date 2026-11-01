"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import type { StoreRegion } from "../orders/types/order";
import { REGION_COOKIE, storeRegionLabels } from "./region.logic";

type RegionContextValue = {
  region: StoreRegion | null;
  setRegion: (region: StoreRegion) => void;
  openPicker: () => void;
};

const RegionContext = React.createContext<RegionContextValue>({
  region: null,
  setRegion: () => {},
  openPicker: () => {},
});

export function useStoreRegion() {
  return React.useContext(RegionContext);
}

/** Asks for the delivery region on the first visit and keeps it in a cookie. */
export function StoreRegionProvider({
  initialRegion,
  children,
}: {
  initialRegion: StoreRegion | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [region, setState] = React.useState(initialRegion);
  const [open, setOpen] = React.useState(initialRegion === null);

  const current = React.useRef(initialRegion);
  const setRegion = React.useCallback(
    (next: StoreRegion) => {
      document.cookie = `${REGION_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      setState(next);
      setOpen(false);
      // Server-rendered product labels depend on the cookie.
      if (next !== current.current) router.refresh();
      current.current = next;
    },
    [router],
  );
  const value = React.useMemo<RegionContextValue>(
    () => ({ region, setRegion, openPicker: () => setOpen(true) }),
    [region, setRegion],
  );

  return (
    <RegionContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent theme="storefront" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Bạn muốn giao hàng đến đâu?</DialogTitle>
            <DialogDescription>
              Chọn miền để biết sản phẩm nào giao được tới bạn. Có thể đổi lại
              trên thanh đầu trang.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(Object.keys(storeRegionLabels) as StoreRegion[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => value.setRegion(option)}
                aria-pressed={option === region}
                className={cn(
                  "rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary",
                  option === region
                    ? "border-primary bg-primary/10"
                    : "border-border",
                )}
              >
                {storeRegionLabels[option]}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </RegionContext.Provider>
  );
}

export function StoreRegionButton() {
  const { region, openPicker } = useStoreRegion();
  return (
    <button
      type="button"
      onClick={openPicker}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-foreground hover:bg-muted/70 hover:text-primary"
      aria-label={
        region
          ? `Giao tới ${storeRegionLabels[region]}, đổi khu vực`
          : "Chọn khu vực giao hàng"
      }
    >
      <MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span className="hidden sm:inline">
        {region ? storeRegionLabels[region] : "Chọn miền"}
      </span>
    </button>
  );
}
