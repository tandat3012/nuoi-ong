# Mobile: Inventory Lot Identity

Status: API and web are implemented on `feature/inventory-lot-identity`. This PR delivers mobile handoff documentation only. Mobile implementation and verification are assigned to the mobile owner, who coordinates the items under "Decisions for the mobile owner" with the API owner.

Source of truth: the API (`api/src/modules/warehouses/stock-receipts.*`, `api/src/modules/inventory/inventory.*`) and migration `api/drizzle/0026_inventory-lot-identity.sql`. If this guide and the API disagree, follow the API.

## What changed

Each lot now has two numbers:

| Field | Meaning | Rules |
| --- | --- | --- |
| `lotCode` | Internal lot code, e.g. `LOT-000000001` | Assigned by the server when the receipt is confirmed. Unique across all farms. Clients never send it. |
| `supplierLotNumber` | Number printed on the goods | Optional, at most 100 characters, **not unique**. The server trims it and stores blank as `null`. |
| `legacyLotNumber` | Old mixed-purpose `lot_number` from before the split | Read-only reference. Do not label it as a supplier number. |

Lot identity is still the UUID `lotId`. Never use either number as a key.

## Breaking change: receipt requests

`POST /stock-receipts` and `PATCH /stock-receipts/:id` no longer accept `items[].lotNumber`. The API runs with `forbidNonWhitelisted`, so a line that sends it gets **400** `property lotNumber should not exist`.

**The current app hits this as soon as the API ships.** `ReceiptDetailScreen.tsx:281` and `:759` send `lotNumber` for new-lot lines. Existing-lot lines still work, because they send `lotNumber: undefined` and JSON drops it.

The new request contract for a LOT line:

```ts
// New lot: every field optional. The code is assigned on confirmation.
{ itemId, quantity, supplierLotNumber?, manufacturedDate?, expiryDate? }
// Existing lot: lotId only. Any supplierLotNumber or dates are rejected with 400.
{ itemId, quantity, lotId }
```

When saving an existing draft, send `lineId` (the saved line's `id`) on each row that came from the draft. The server replaces all lines on save and uses `lineId` to keep each line's `legacyLotNumber`; a row without a matching `lineId` loses its legacy number. Do not reuse a `lineId` for a different row.

Also remove the client-side rule that requires a lot number (`ReceiptDetailScreen.tsx:732`, the `missingLot` check). A new-lot line without a number is valid at save, submit and confirm.

## Responses: what to read

Old fields are kept as **deprecated aliases** so the current binary keeps rendering:

| Response | New fields | Deprecated alias |
| --- | --- | --- |
| Receipt line (`GET /stock-receipts/:id`) | `supplierLotNumber`, `legacyLotNumber` (line); `lotCode`, `lotSupplierLotNumber`, `lotLegacyLotNumber` (selected or created lot) | `lotNumber` = `supplierLotNumber ?? legacyLotNumber`; `lotNumberFromLot` = `lotCode` |
| `GET /lots`, `GET /lots/suggestions` (`lot`), materials `lot` | all lot columns, plus `sourceSupplierId`/`sourceSupplierName` on `/lots` | `lotNumber` = `lotCode` |
| Balances, ledger (`lot` object), QR (`GET /inventory/:balanceId/qr`) | `lotCode`, `supplierLotNumber`, `legacyLotNumber` | `lotNumber` = `lotCode` |
| Adjustments (`lot` object) | `lotCode`, `supplierLotNumber` | `lotNumber` = `lotCode` |
| Issue, transfer and count lines | `lotCode`, `lotSupplierLotNumber` | `lotNumber` = `lotCode` |

A draft new-lot line has `lotCode: null` until confirmation. Move every read to the new fields; the aliases will be removed later.

## Duplicate supplier-number hint

`GET /lots?farmId=&itemId=&supplierLotNumber=` returns lots of that item whose printed number matches exactly, scoped to the farm. Web shows these matches under the new-lot fields with a "Nhập thêm vào lô này" button. The hint is advisory:

- Never block saving, submitting or confirming because of a match.
- Never switch to the existing lot automatically. The user picks it explicitly.
- If the lookup fails, hide the hint and keep what the user typed.

## Screens to update

| File | Change |
| --- | --- |
| `features/inventory/api.ts:60-68, 246-247` | Types: add `lotCode`, `supplierLotNumber`, `legacyLotNumber`; drop `lotNumber`/`lotNumberFromLot` reads. |
| `presentation/ReceiptDetailScreen.tsx` | Request payloads (`:281`, `:759`) send `supplierLotNumber`. Drop the required-number check (`:732`). New-lot form: show "Mã lô nội bộ — Tự cấp khi xác nhận phiếu"; label the input "Số lô trên hàng" (optional) with the hint "Số lô do nhà sản xuất/nhà cung cấp ghi trên hàng." Existing-lot picker and search (`:495`): show and search `lotCode`, with supplier number and expiry as secondary text. Expiry alerts (`:388`, `:447`, `:550`, `:604`, `:668`) should name the lot by `lotCode`. |
| `presentation/LotDetailScreen.tsx:18-50` | Title is `lotCode`; show the supplier number and legacy number (labelled as legacy) separately. |
| `presentation/InventoryScreen.tsx:120-172` | Group and label by `lotCode`. Do not group by supplier number, because it repeats. |
| `presentation/InventoryQrResultScreen.tsx:27, 85` | "Mã lô" shows `lotCode`; add the supplier number when present. |
| `presentation/InventoryActionScreen.tsx:63`, `features/activity/model.ts:37` | Rename the field and labels: `supplierLotNumber` is "Số lô trên hàng"; "Mã lô" is reserved for `lotCode`. |

Copy used on web, for consistency: **Tạo lô mới** / **Nhập thêm vào lô có sẵn**, "Mã lô nội bộ", "Số lô trên hàng", "Số lô cũ (tham khảo)".

## Decisions for the mobile owner

1. **Release order.** Coordinate with the API owner before deployment. If the API ships first, the current binary fails new-lot receipts with a clear 400 (existing-lot top-ups keep working). Agree whether to ship the mobile update together with the API, accept the gap, or add a supported-version gate. The repo has no version gate today; this documentation handoff does not decide the release order or accept a gap.
2. **Duplicate hint on mobile.** Inline list as on web, a bottom sheet, or skipped for now (it is advisory, so skipping is safe).
3. **Legacy numbers.** Where to show `legacyLotNumber` (lot detail only, or receipt lines too). Always label it as a historical reference.
4. **Alias removal.** When mobile stops reading `lotNumber`/`lotNumberFromLot`, tell the API owner so the aliases can be removed.

## Verify

- A LOT receipt with no supplier number saves, submits and confirms; after confirmation the line shows `LOT-…`.
- Two lines in one receipt with the same supplier number confirm as two lots with different codes.
- Reopening a draft keeps the entered supplier number and dates. An old draft shows its legacy number for review.
- The pickers, inventory list, lot detail and QR still identify lots correctly when supplier numbers are empty or repeated.
