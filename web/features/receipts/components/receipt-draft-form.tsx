'use client';

import { useState } from 'react';
import { useSaveReceiptDraft } from '../hooks/use-save-receipt-draft';
import type { ReceiptDraftInitial } from '../types/receipt';
import {
  ReceiptDraftPicker,
  type DraftChoice,
  type DraftPickerKind,
} from './receipt-draft-picker';

type DraftLine = DraftChoice & {
  rowKey: string;
  quantity: string;
  unitPrice: string;
  lotNumber: string;
  manufacturedDate: string;
  expiryDate: string;
  assetCode: string;
  serialNumber: string;
  locationId: string | null;
  locationLabel: string;
  note: string;
};

export function ReceiptDraftForm({
  farmId,
  canWrite,
  initial,
  onSaved,
  onCancel,
}: {
  farmId: string;
  canWrite: boolean;
  initial?: ReceiptDraftInitial;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [warehouse, setWarehouse] = useState<DraftChoice | null>(() =>
    initial
      ? {
          id: initial.detail.receipt.warehouseId,
          label:
            initial.warehouseLabel ??
            `Kho (${initial.detail.receipt.warehouseId})`,
        }
      : null,
  );
  const [supplier, setSupplier] = useState<DraftChoice | null>(() =>
    initial?.detail.receipt.supplierId
      ? {
          id: initial.detail.receipt.supplierId,
          label:
            initial.supplierLabel ??
            `Nhà cung cấp (${initial.detail.receipt.supplierId})`,
        }
      : null,
  );
  const [code, setCode] = useState(initial?.detail.receipt.receiptCode ?? '');
  const [date, setDate] = useState(initial?.detail.receipt.receiptDate ?? '');
  const [note, setNote] = useState(initial?.detail.receipt.note ?? '');
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initial
      ? initial.detail.items.map((line) => {
          const reference = initial.references?.[line.itemId];
          return {
            id: line.itemId,
            rowKey: line.id,
            trackingMode: reference?.item.trackingMode ?? 'QUANTITY',
            label: reference
              ? `${reference.item.code} — ${reference.item.name} (${reference.unitSymbol || reference.unitName || '—'})`
              : `Vật tư (${line.itemId})`,
            quantity:
              reference?.item.trackingMode === 'ASSET'
                ? '1'
                : line.quantity,
            unitPrice: line.unitPrice,
            lotNumber: line.lotNumber ?? '',
            manufacturedDate: line.manufacturedDate ?? '',
            expiryDate: line.expiryDate ?? '',
            assetCode: line.assetCode ?? '',
            serialNumber: line.serialNumber ?? '',
            locationId: line.locationId ?? null,
            locationLabel:
              initial.locationLabels?.[line.locationId ?? ''] ??
              (line.locationId ? `Vị trí (${line.locationId})` : ''),
            note: line.note ?? '',
          };
        })
      : [],
  );
  const [picker, setPicker] = useState<{
    kind: DraftPickerKind;
    rowKey?: string;
  } | null>(null);
  const { submit, isSaving, error } = useSaveReceiptDraft(
    farmId,
    canWrite,
    initial?.detail.receipt.id,
    onSaved,
  );
  const inputClass = 'w-full rounded-lg border bg-background p-2';
  function select(choice: DraftChoice) {
    if (picker?.kind === 'warehouse') {
      if (warehouse?.id !== choice.id)
        setLines((previous) =>
          previous.map((line) => ({
            ...line,
            locationId: null,
            locationLabel: '',
          })),
        );
      setWarehouse(choice);
    } else if (picker?.kind === 'supplier') setSupplier(choice);
    else if (picker?.kind === 'location' && picker.rowKey)
      setLines((previous) =>
        previous.map((line) =>
          line.rowKey === picker.rowKey
            ? { ...line, locationId: choice.id, locationLabel: choice.label }
            : line,
        ),
      );
    else if (picker?.kind === 'material' || picker?.kind === 'asset')
      setLines((previous) =>
        choice.trackingMode === 'QUANTITY' &&
        previous.some((line) => line.id === choice.id)
          ? previous
          : [
              ...previous,
              {
                ...choice,
                rowKey: crypto.randomUUID(),
                quantity: '1',
                unitPrice: '0',
                lotNumber: '',
                manufacturedDate: '',
                expiryDate: '',
                assetCode: '',
                serialNumber: '',
                locationId: null,
                locationLabel: '',
                note: '',
              },
            ],
      );
    setPicker(null);
  }
  if (!canWrite)
    return (
      <div role="alert">
        <p>Bạn không có quyền lưu phiếu nhập.</p>
        <button type="button" onClick={onCancel} className="underline">
          Quay lại danh sách
        </button>
      </div>
    );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (picker) return;
        void submit({
          warehouseId: warehouse?.id ?? '',
          supplierId: supplier?.id ?? null,
          receiptCode: code.trim(),
          receiptDate: date || undefined,
          note: note.trim() || null,
          items: lines.map((line) => ({
            itemId: line.id,
            quantity:
              line.trackingMode === 'ASSET' ? '1' : line.quantity.trim(),
            unitPrice: line.unitPrice.trim() || '0',
            note: line.note.trim() || null,
            ...(line.trackingMode === 'LOT'
              ? {
                  lotNumber: line.lotNumber.trim(),
                  manufacturedDate: line.manufacturedDate || undefined,
                  expiryDate: line.expiryDate || undefined,
                }
              : {}),
            ...(line.trackingMode === 'ASSET'
              ? {
                  assetCode: line.assetCode.trim(),
                  serialNumber: line.serialNumber.trim() || undefined,
                  locationId: line.locationId ?? undefined,
                }
              : {}),
          })),
        });
      }}
      className="space-y-4"
    >
      <h1 className="text-2xl font-bold">
        {initial ? 'Sửa phiếu nhập nháp' : 'Tạo phiếu nhập nháp'}
      </h1>
      <p className="text-sm text-muted-foreground">
        Nhập vật tư theo số lượng/lô hoặc thiết bị theo từng tài sản. Lưu nháp
        chưa làm thay đổi tồn kho. Để trống ngày nhập để dùng ngày hiện tại của
        hệ thống.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-3 text-destructive"
        >
          {error}
        </p>
      )}
      <fieldset disabled={isSaving} className="space-y-4 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            Mã phiếu *
            <input
              required
              maxLength={50}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            Ngày nhập
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div>
          <p>Kho nhập *: {warehouse?.label ?? 'Chưa chọn'}</p>
          <button
            type="button"
            onClick={() => setPicker({ kind: 'warehouse' })}
            className="underline"
          >
            Chọn kho
          </button>
        </div>
        <div>
          <p>Nhà cung cấp: {supplier?.label ?? 'Không chọn'}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPicker({ kind: 'supplier' })}
              className="underline"
            >
              Chọn nhà cung cấp
            </button>
            {supplier && (
              <button
                type="button"
                onClick={() => setSupplier(null)}
                className="underline"
              >
                Bỏ chọn
              </button>
            )}
          </div>
        </div>
        <label className="block">
          Ghi chú
          <textarea
            maxLength={4000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
          />
        </label>
        <h2 className="font-semibold">Hàng hóa nhập</h2>
        {lines.length === 0 && <p>Chưa có dòng hàng.</p>}
        {lines.map((line) => (
          <div key={line.rowKey} className="space-y-2 rounded-xl border p-3">
            <p>{line.label}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {line.trackingMode === 'ASSET' ? (
                <p>Số lượng: 1 tài sản</p>
              ) : (
                <label>
                  Số lượng *
                  <input
                    aria-label={`Số lượng ${line.label}`}
                    required
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row) =>
                          row.rowKey === line.rowKey
                            ? { ...row, quantity: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
              )}
              <label>
                Đơn giá
                <input
                  aria-label={`Đơn giá ${line.label}`}
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(event) =>
                    setLines((previous) =>
                      previous.map((row) =>
                        row.rowKey === line.rowKey
                          ? { ...row, unitPrice: event.target.value }
                          : row,
                      ),
                    )
                  }
                  className={inputClass}
                />
              </label>
            </div>
            {line.trackingMode === 'LOT' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  Số lô *
                  <input
                    required
                    maxLength={100}
                    value={line.lotNumber}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row) =>
                          row.rowKey === line.rowKey
                            ? { ...row, lotNumber: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label>
                  Ngày sản xuất
                  <input
                    type="date"
                    value={line.manufacturedDate}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row) =>
                          row.rowKey === line.rowKey
                            ? { ...row, manufacturedDate: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label>
                  Hạn sử dụng
                  <input
                    type="date"
                    value={line.expiryDate}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row) =>
                          row.rowKey === line.rowKey
                            ? { ...row, expiryDate: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
              </div>
            )}
            {line.trackingMode === 'ASSET' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  Mã tài sản *
                  <input
                    required
                    maxLength={100}
                    value={line.assetCode}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row) =>
                          row.rowKey === line.rowKey
                            ? { ...row, assetCode: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label>
                  Số serial
                  <input
                    maxLength={255}
                    value={line.serialNumber}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row) =>
                          row.rowKey === line.rowKey
                            ? { ...row, serialNumber: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <div className="sm:col-span-2">
                  <p>Vị trí: {line.locationLabel || 'Chưa chọn'}</p>
                  <button
                    type="button"
                    disabled={!warehouse}
                    onClick={() =>
                      setPicker({ kind: 'location', rowKey: line.rowKey })
                    }
                    className="underline disabled:opacity-50"
                  >
                    Chọn vị trí trong kho
                  </button>
                  {line.locationId && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines((previous) =>
                          previous.map((row) =>
                            row.rowKey === line.rowKey
                              ? {
                                  ...row,
                                  locationId: null,
                                  locationLabel: '',
                                }
                              : row,
                          ),
                        )
                      }
                      className="ml-3 underline"
                    >
                      Bỏ vị trí
                    </button>
                  )}
                </div>
              </div>
            )}
            <label className="block">
              Ghi chú dòng
              <textarea
                maxLength={4000}
                value={line.note}
                onChange={(event) =>
                  setLines((previous) =>
                    previous.map((row) =>
                      row.rowKey === line.rowKey
                        ? { ...row, note: event.target.value }
                        : row,
                    ),
                  )
                }
                className={inputClass}
              />
            </label>
            <button
              type="button"
              aria-label={`Bỏ dòng ${line.label}`}
              onClick={() =>
                setLines((previous) =>
                  previous.filter((row) => row.rowKey !== line.rowKey),
                )
              }
              className="text-sm underline"
            >
              Bỏ dòng
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPicker({ kind: 'material' })}
            className="rounded-lg border px-3 py-2"
          >
            Thêm vật tư
          </button>
          <button
            type="button"
            onClick={() => setPicker({ kind: 'asset' })}
            className="rounded-lg border px-3 py-2"
          >
            Thêm thiết bị/tài sản
          </button>
        </div>
        {picker && (
          <ReceiptDraftPicker
            key={`${picker.kind}-${picker.rowKey ?? ''}`}
            farmId={farmId}
            kind={picker.kind}
            warehouseId={warehouse?.id}
            onSelect={select}
            onClose={() => setPicker(null)}
          />
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={Boolean(picker)}
            className="rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : initial ? 'Lưu thay đổi' : 'Lưu nháp'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border px-4 py-2"
          >
            Quay lại danh sách
          </button>
        </div>
      </fieldset>
    </form>
  );
}
