"use client";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  AssetMutationDialog,
  type AssetWriteError,
} from "@/features/assets/components/asset-mutation-dialog";
import {
  maintenanceActions,
  formatMaintenanceCost,
  maintenanceCostValue,
} from "./maintenance.logic";
import type { PaginatedResponse } from "@/shared/api/contracts";

type Record = {
  id: string;
  status: string;
  supplierId?: string | null;
  expectedReturnAt?: string | null;
  returnStatus: string | null;
  receivedAt?: string | null;
  returnWarehouseInScope?: boolean;
};

type Lookup = { id: string; name: string; warehouseId?: string | null };

const LABELS: { [key: string]: string } = {
  prepare: "Chuẩn bị gửi sửa",
  start: "Xác nhận xuất đi sửa",
  receive: "Nhận lại thiết bị",
  complete: "Nghiệm thu",
  cancel: "Hủy lịch",
  "return-receipt": "Lập phiếu nhập lại",
  "return-receipt/approve": "Duyệt nhập kho",
  "return-receipt/reject": "Từ chối nhập kho",
};

export function MaintenanceActions({
  record,
  farmId,
  roles,
  onSaved,
}: {
  record: Record;
  farmId: string;
  roles: readonly string[];
  onSaved: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<AssetWriteError>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Lookup[]>([]);
  const [warehouses, setWarehouses] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupRevision, setLookupRevision] = useState(0);
  const [outcome, setOutcome] = useState("PASSED");
  const [costs, setCosts] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (action !== "prepare" && action !== "return-receipt") return;
    let alive = true;
    const all = async (path: string) => {
      const rows: Lookup[] = [];
      for (let page = 1; ; page++) {
        const result = await request<PaginatedResponse<Lookup>>(path, {
          params: { farmId, status: "ACTIVE", page, pageSize: 100 },
        });
        rows.push(...result.data);
        if (page >= result.page.totalPages) return rows;
      }
    };

    void Promise.all([all("/suppliers"), all("/warehouses"), all("/locations")])
      .then(([s, w, l]) => {
        if (alive) {
          setSuppliers(s);
          setWarehouses(w);
          setLocations(l);
          setLookupLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setLookupError("Không tải được danh mục. Đóng và mở lại để thử lại.");
          setLookupLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [action, farmId, request, lookupRevision]);

  const actions = maintenanceActions(record, roles);
  const receivingLocations = locations.filter(
    (l) => l.warehouseId === warehouseId,
  );
  if (!actions.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {actions.map((value) => (
        <Button
          key={value}
          variant={
            value === "cancel" || value === "return-receipt/reject"
              ? "ghost"
              : "default"
          }
          size="sm"
          className={
            value === "cancel" || value === "return-receipt/reject"
              ? "min-h-9 text-muted-foreground hover:text-destructive"
              : "min-h-9"
          }
          onClick={() => {
            setLookupError(null);
            setError(null);
            setCosts({});
            setWarehouseId("");
            setLookupLoading(true);
            setAction(value);
          }}
        >
          {LABELS[value]}
        </Button>
      ))}
      {action && (
        <AssetMutationDialog
          title={LABELS[action]}
          description={
            action === "start"
              ? "Xác nhận thiết bị đã bàn giao thực tế cho đơn vị sửa. Thiết bị đang ở kho sẽ giảm tồn 1; chỉ xác nhận được một lần."
              : "Ghi nhận bàn giao, kết quả và phiếu nhập lại của đúng thiết bị. Tồn kho chỉ cập nhật khi kho xác nhận."
          }
          error={error}
          onError={setError}
          onReload={onSaved}
          onSaved={() => {
            setAction(null);
            onSaved();
          }}
          onClose={() => setAction(null)}
          disabled={
            !!lookupError ||
            (action === "return-receipt" &&
              (lookupLoading ||
                !warehouseId ||
                receivingLocations.length === 0))
          }
          perform={async (data) => {
            let body: { [key: string]: unknown } = {};
            if (action === "prepare")
              return request(`/maintenance-records/${record.id}`, {
                method: "PATCH",
                params: { farmId },
                data: {
                  supplierId: String(data.get("supplierId")),
                  expectedReturnAt: new Date(
                    String(data.get("expectedReturnAt")),
                  ).toISOString(),
                },
              });
            if (action === "receive")
              body = {
                receivedAt: new Date(
                  String(data.get("receivedAt")),
                ).toISOString(),
              };
            if (action === "complete")
              body = {
                outcome,
                resultNote: String(data.get("resultNote")),
                ...(outcome === "PASSED"
                  ? { intervalMonths: Number(data.get("intervalMonths")) }
                  : {}),
                ...Object.fromEntries(
                  ["laborCost", "materialCost", "otherCost"]
                    .filter((key) => String(data.get(key) ?? "").trim())
                    .map((key) => [key, String(data.get(key))]),
                ),
              };
            if (action === "return-receipt")
              body = {
                warehouseId,
                locationId: String(data.get("locationId")),
              };
            if (action === "return-receipt/reject")
              body = { reason: String(data.get("reason")) };
            return request(`/maintenance-records/${record.id}/${action}`, {
              method: "POST",
              params: { farmId },
              data: body,
            });
          }}
        >
          {lookupError && <p role="alert">{lookupError}</p>}
          {action === "prepare" && (
            <>
              <label className="block">
                Đơn vị bảo trì
                <Select
                  name="supplierId"
                  required
                  defaultValue={record.supplierId ?? ""}
                >
                  <option value="">Chọn đơn vị</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                Ngày hẹn trả
                <Input type="datetime-local" name="expectedReturnAt" required />
              </label>
            </>
          )}
          {action === "receive" && (
            <label className="block">
              Ngày nhận thực tế
              <Input type="datetime-local" name="receivedAt" required />
            </label>
          )}
          {action === "complete" && (
            <>
              <label className="block">
                Kết quả
                <Select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="PASSED">Đạt</option>
                  <option value="FAILED">Bảo trì không thành công</option>
                </Select>
              </label>
              <label className="block">
                Ghi nhận nghiệm thu
                <Textarea name="resultNote" required maxLength={4000} />
              </label>
              {outcome === "PASSED" && (
                <label className="block">
                  Chu kỳ đề xuất (tháng)
                  <Input
                    name="intervalMonths"
                    type="number"
                    min={1}
                    max={120}
                    required
                  />
                  <span className="text-sm">
                    Tính từ ngày nhận lại thực tế.
                  </span>
                </label>
              )}
              <p className="text-sm text-muted-foreground">
                Nhập chi phí theo báo giá hoặc chứng từ đơn vị bảo trì gửi kèm
                khi trả thiết bị. Tổng chi phí được cộng từ các khoản bạn nhập.
                Vật tư là tiền linh kiện, phụ tùng; không tự xuất kho.
              </p>
              {[
                ["laborCost", "Tiền công sửa chữa"],
                ["materialCost", "Tiền linh kiện / vật tư"],
                ["otherCost", "Chi phí khác"],
              ].map(([name, label]) => (
                <label className="block" key={name}>
                  {label} (VNĐ)
                  <div className="relative">
                    <Input
                      value={costs[name] ?? ""}
                      inputMode="decimal"
                      pattern="(0|[1-9][0-9]{0,2}(\.[0-9]{3}){0,4}|[1-9](\.[0-9]{3}){5})(,[0-9]{1,2})?"
                      placeholder="Để trống để giữ nguyên"
                      className="pr-10"
                      onChange={(event) => {
                        const input = event.currentTarget;
                        let value = input.value;
                        let position = input.selectionStart ?? value.length;
                        const previous = costs[name] ?? "";
                        if (
                          (event.nativeEvent as InputEvent).inputType ===
                            "deleteContentBackward" &&
                          previous[position] === "."
                        ) {
                          value =
                            value.slice(0, Math.max(0, position - 1)) +
                            value.slice(position);
                          position = Math.max(0, position - 1);
                        }
                        const before = value
                          .slice(0, position)
                          .replaceAll(".", "").length;
                        const formatted = formatMaintenanceCost(value);
                        setCosts((current) => ({
                          ...current,
                          [name]: formatted,
                        }));
                        requestAnimationFrame(() => {
                          let caret = 0,
                            count = 0;
                          while (caret < formatted.length && count < before) {
                            if (formatted[caret] !== ".") count++;
                            caret++;
                          }
                          input.setSelectionRange(caret, caret);
                        });
                      }}
                    />
                    <span
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    >
                      ₫
                    </span>
                  </div>
                  <input
                    type="hidden"
                    name={name}
                    value={maintenanceCostValue(costs[name] ?? "")}
                  />
                </label>
              ))}
            </>
          )}
          {action === "return-receipt" && (
            <>
              <label className="block">
                Kho nhận
                <Select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                >
                  <option value="">Chọn kho</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                Vị trí nhận
                <Select
                  key={warehouseId}
                  name="locationId"
                  required
                  disabled={
                    !warehouseId ||
                    lookupLoading ||
                    receivingLocations.length === 0
                  }
                  aria-describedby="return-location-help"
                >
                  <option value="">
                    {lookupLoading ? "Đang tải vị trí…" : "Chọn vị trí"}
                  </option>
                  {receivingLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </label>
              <div
                id="return-location-help"
                role="status"
                className="space-y-2 text-sm text-muted-foreground"
              >
                {warehouseId &&
                  !lookupLoading &&
                  !lookupError &&
                  receivingLocations.length === 0 && (
                    <>
                      <p>
                        Kho này chưa có vị trí nhận đang hoạt động. Chọn kho
                        khác hoặc nhờ quản lý kho tạo vị trí trong Danh mục → Vị
                        trí và gắn với kho này.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLookupError(null);
                          setLookupLoading(true);
                          setLookupRevision((value) => value + 1);
                        }}
                      >
                        Tải lại vị trí
                      </Button>
                    </>
                  )}
              </div>
            </>
          )}
          {action === "return-receipt/reject" && (
            <label className="block">
              Lý do từ chối
              <Textarea name="reason" required minLength={3} maxLength={4000} />
            </label>
          )}
        </AssetMutationDialog>
      )}
    </div>
  );
}
