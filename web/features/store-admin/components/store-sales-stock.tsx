"use client";

import { useEffect, useState } from "react";
import { useAuthContext, useAuthenticatedRequest } from "@/features/auth";
import { formatInventoryQuantity } from "@/features/inventory/inventory.logic";
import { Badge } from "@/shared/components/ui/badge";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { PageHeader } from "@/shared/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { getStoreSalesStock } from "../api/store-admin.api";
import { storeAdminError, storeRegionLabels } from "../store-admin.logic";
import type { StoreSalesStock } from "../types/store-admin";

/** Staff-only view of the sales warehouse; customers only ever see labels. */
export function StoreSalesStockScreen() {
  const { selectedFarmId } = useAuthContext();
  const request = useAuthenticatedRequest();
  const [stock, setStock] = useState<{
    farmId: string;
    data: StoreSalesStock;
  }>();
  // Keyed by farm, so another farm's failure never hides this one's data.
  const [error, setError] = useState<{ farmId: string; message: string }>();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    getStoreSalesStock(request, selectedFarmId)
      .then((response) => {
        if (cancelled) return;
        setError((old) => (old?.farmId === selectedFarmId ? undefined : old));
        setStock({ farmId: selectedFarmId, data: response.data });
      })
      .catch(
        (failure) =>
          !cancelled &&
          setError({
            farmId: selectedFarmId,
            message: storeAdminError(failure),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [request, selectedFarmId]);

  if (error?.farmId === selectedFarmId)
    return <ErrorAlert message={error.message} />;
  if (!stock || stock.farmId !== selectedFarmId)
    return <BeeLoader label="Đang tải tồn bán hàng…" />;

  const { salesWarehouse, salesEnabled, regions, rows } = stock.data;
  const keyword = query.trim().toLowerCase();
  const visible = rows.filter((row) =>
    [row.productName, row.variantName, row.itemCode, row.itemName].some(
      (text) => text.toLowerCase().includes(keyword),
    ),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tồn bán hàng"
        description={
          salesWarehouse
            ? `Kho bán ${salesWarehouse.code} – ${salesWarehouse.name} · ${
                salesEnabled
                  ? `đang bán tới ${regions.map((r) => storeRegionLabels[r]).join(", ")}`
                  : "đang tắt bán online"
              }. Khả dụng = tồn vật lý trừ phần phiếu xuất chưa duyệt đang giữ. Kho nguồn còn được chuyển vào kho bán khi xác nhận đơn thiếu hàng.`
            : undefined
        }
      />
      {!salesWarehouse ? (
        <ErrorAlert message="Chưa cấu hình kho bán hàng. Vào Sản phẩm cửa hàng để chọn kho bán." />
      ) : (
        <>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm sản phẩm, quy cách hoặc vật tư"
            aria-label="Tìm trong tồn bán hàng"
            className="max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm / quy cách</TableHead>
                <TableHead>Vật tư</TableHead>
                <TableHead className="text-right">Tồn vật lý</TableHead>
                <TableHead className="text-right">Đang giữ</TableHead>
                <TableHead className="text-right">Khả dụng</TableHead>
                <TableHead>Trạng thái bán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    {rows.length === 0
                      ? "Trại chưa gắn vật tư nào vào quy cách bán."
                      : "Không có dòng phù hợp."}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((row) => (
                  <TableRow key={row.variantId}>
                    <TableCell>
                      {row.productName}
                      <span className="block text-xs text-muted-foreground">
                        {row.variantName}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.itemName}
                      <span className="block text-xs text-muted-foreground">
                        {row.itemCode}
                      </span>
                    </TableCell>
                    {[row.onHand, row.held, row.available].map(
                      (value, index) => (
                        <TableCell key={index} className="text-right">
                          {formatInventoryQuantity(value)} {row.unitSymbol}
                        </TableCell>
                      ),
                    )}
                    <TableCell>
                      <Badge variant={row.saleable ? "success" : "secondary"}>
                        {row.saleable ? "Đang bán" : "Không bán"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
