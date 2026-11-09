"use client";

import { useMemo } from "react";
import {
  Boxes,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { MaterialListRow } from "../types/material";

interface MaterialSummaryBarProps {
  materials: MaterialListRow[];
  totalItems?: number;
}

export function MaterialSummaryBar({
  materials,
  totalItems,
}: MaterialSummaryBarProps) {
  const stats = useMemo(() => {
    const total = totalItems ?? materials.length;
    let lotCount = 0;
    let activeCount = 0;
    let lowStockCount = 0;

    for (const m of materials) {
      if (m.item.trackingMode === "LOT") {
        lotCount++;
      }
      if (m.item.status === "ACTIVE") {
        activeCount++;
      }
      const qty = parseFloat(m.quantityOnHand) || 0;
      const minStock = parseFloat(m.item.minStockLevel) || 0;
      if (qty <= 0 || (minStock > 0 && qty <= minStock)) {
        lowStockCount++;
      }
    }

    return {
      total,
      lotCount,
      activeCount,
      lowStockCount,
    };
  }, [materials, totalItems]);

  const cards = [
    {
      title: "Tổng danh mục vật tư",
      value: stats.total,
      subtext: "Mặt hàng đã đăng ký",
      icon: Boxes,
      dotClass: "bg-primary",
    },
    {
      title: "Theo dõi theo Lô (Lot)",
      value: stats.lotCount,
      subtext: "Kiểm soát hạn dùng & xuất xứ",
      icon: CalendarClock,
      dotClass: "bg-blue-500",
    },
    {
      title: "Đang hoạt động",
      value: stats.activeCount,
      subtext: "Sẵn sàng nhập / xuất kho",
      icon: CheckCircle2,
      dotClass: "bg-emerald-500",
    },
    {
      title: "Cần chú ý tồn kho",
      value: stats.lowStockCount,
      subtext: "Hết hàng hoặc dưới định mức",
      icon: AlertTriangle,
      dotClass: stats.lowStockCount > 0 ? "bg-amber-500" : "bg-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs transition-shadow hover:shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {card.title}
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                {card.value}
              </span>
              <span className="size-2 rounded-full shrink-0" aria-hidden="true" />
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
              <span className={`size-1.5 rounded-full shrink-0 ${card.dotClass}`} aria-hidden="true" />
              <span className="truncate">{card.subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
