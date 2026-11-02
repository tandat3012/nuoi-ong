# Inventory Lot Identity — Specification and Implementation Plan

Status: API and web implemented on `feature/inventory-lot-identity`; PostgreSQL migration rehearsal and end-to-end verification remain pending. Mobile implementation is assigned to the mobile owner; this change delivers only the handoff guide in [mobile/INVENTORY_LOT_MOBILE.md](mobile/INVENTORY_LOT_MOBILE.md).

## 1. Objective

Allow users to receive lot-tracked goods without inventing a lot number. Every inventory lot must have a mandatory, system-assigned, unique internal code. The number printed on goods is optional and must not be unique, including for the same item or supplier.

Keep the existing distinction between creating a new lot and receiving more stock into an existing lot. API and web implement this behavior in the current change. Mobile must follow the same contract in a separate implementation by the mobile owner.

## 2. Verified Current Behavior

- `api/src/db/schema/schema.ts` defines required, globally unique `inventoryLots.lotCode`, optional non-unique `supplierLotNumber`, and read-only `legacyLotNumber`. Migration `0026_inventory-lot-identity.sql` replaces the old `(farmId, itemId, lotNumber)` uniqueness rule and preserves historical values.
- Receipt lines store either an existing `lotId` or new-lot metadata in `stockReceiptItems`.
- `StockReceiptsService.confirmReceipt()` creates new lots inside its confirmation transaction without requiring a supplier number. The database assigns the internal code; confirmation links the lot to its source receipt line, updates stock, and records inventory transactions.
- Existing-lot selection checks farm and item ownership. It cannot carry replacement lot metadata.
- Web uses `lotCode` for lot identity and accepts optional supplier numbers for new lots. Mobile still uses the old fields and requires a manual number; its source code is outside the current change.
- Receipt integration tests now cover missing and repeated supplier numbers, existing-lot top-ups, legacy draft preservation, rollback, and concurrent confirmation. Seeds use stable fixture identity instead of supplier-number uniqueness. These PostgreSQL tests still need to be executed for this review.
- Stock document numbering already exists. Lot identity is a separate concern; this work must not change receipt/document numbering or its owner override rules.

These findings come from source inspection and graphify-assisted navigation, not a production-data audit or a completed PostgreSQL verification run.

## 3. Identity and Data Model

| Field | Meaning | Rules |
| --- | --- | --- |
| `id` | Technical lot identity | Keep the existing UUID primary key and all `lotId` references. |
| `lotCode` | Internal business identifier | Required, nonblank, immutable, assigned by the server, globally UNIQUE across inventory lots. |
| `supplierLotNumber` | Lot number printed on the goods | Optional, maximum 100 characters, NOT UNIQUE. Trim outer whitespace, convert blank to null, preserve case, punctuation, and leading zeros. |
| `legacyLotNumber` | Historical value of the old mixed-purpose field | Nullable, read-only migration evidence. Do not assume it represents a supplier number. |
| `manufacturedDate`, `expiryDate` | Actual batch dates | Preserve existing date validation; do not infer dates from either code. |

Global uniqueness is the chosen scope for the user's `UNIQUE` requirement: two farms cannot have the same internal `lotCode`. This does not change tenant access boundaries or make codes authorization credentials.

### Database changes

- Add `lot_code` with a global unique constraint and a nonblank check; make it NOT NULL after backfill.
- Add nullable `supplier_lot_number` and a non-unique B-tree index on `(farm_id, item_id, supplier_lot_number)` for tenant/item-scoped equality and prefix-compatible lookup where supported by the query/operator.
- Do not add a unique constraint on supplier numbers, even when combined with farm, item, supplier, or dates.
- Preserve old `lot_number` values as `legacy_lot_number` during migration. Remove `uq_lot_per_item_farm`; replace it with uniqueness on the internal code.
- Add nullable `supplier_lot_number` to receipt lines. Preserve historical receipt-line `lot_number` as legacy evidence as well.
- New drafts do not have a reserved internal lot code. They use their existing line IDs until confirmation.
- Preserve lot UUIDs, source receipt links, stock balances, ledger references, dates, quantities, and historical records.

The lookup index is not a claim of efficient arbitrary substring search. Start with an exact supplier-number match for duplicate suggestions; use existing lookup behavior for ordinary picker search. Add specialized text indexing only if a measured need appears.

## 4. Internal Code Allocation

Use the dedicated PostgreSQL sequence `inventory_lot_code_seq` through `next_inventory_lot_code()` and the format `LOT-000000001` with a minimum of nine digits. Never truncate or wrap larger values. A global sequence matches global uniqueness without adding a farm counter or changing the stock-document allocator.

- The database-backed allocator is server-only and runs when a new lot is inserted during receipt confirmation.
- Do not use timestamps, client-generated counters, row counts, or `MAX(code) + 1`.
- The unique constraint remains the final guarantee, including seed and import paths.
- Sequence values may be skipped after failed transactions. Gap-free lot numbering is not required, and gaps do not represent missing stock.
- Draft creation, submission, rejection, and cancellation must not allocate a lot code.
- A repeated confirmation of an already confirmed receipt returns the existing lots and codes without allocating again or repeating stock effects.
- Users cannot supply or edit `lotCode`, including through direct API requests. There is no manual override in this scope.

## 5. Receipt Behavior

### New lot

For a LOT item with no selected `lotId`, treat the line as a request to create a new lot. An omitted supplier number is valid during draft save, submission, and confirmation.

Each new-lot line creates its own lot. Equal supplier numbers, including two lines in the same receipt, must not cause a rejection or an automatic merge. Lines containing physically different batches or different expiry dates must remain separate.

### Existing lot

Use `lotId` when the user has verified that incoming goods belong to a lot already tracked by the business. Require the existing farm/item checks. Do not accept new supplier metadata or dates alongside `lotId`, and do not overwrite the selected lot's metadata.

Existing-lot selection is independent of warehouse stock availability: a lot may be received into another permitted warehouse without creating a second identity. Preserve current permissions and expiry-related behavior.

### Duplicate supplier-number suggestion

When a new-lot line has a supplier number, look for matching lots for the same farm and item. Show the internal code, supplier number, dates, and source supplier when available through the source receipt.

- This is advisory and must never block saving, submission, or confirmation.
- Offer an explicit action to choose an existing lot; never switch modes automatically.
- Display multiple matches separately by internal code.
- Do not infer the same batch from equal numbers, equal supplier, or equal dates alone.
- A lookup failure must not discard entered content or prevent otherwise valid receipt processing.

## 6. Web and Mobile UX

The following behavior is implemented on web. For mobile, it is the target behavior handed off to the mobile owner, not completed work in this PR.

Keep two choices: **Tạo lô mới** and **Nhập thêm vào lô có sẵn**.

For a new lot, show:

```text
Mã lô nội bộ       Tự cấp khi xác nhận phiếu
Số lô trên hàng    [Optional text input]
                   Số lô do nhà sản xuất/nhà cung cấp ghi trên hàng.
Ngày sản xuất     [Date]
Hạn sử dụng       [Date]
```

- Remove the required indicator and manual-number validation from the supplier-number input.
- Do not introduce automatic/manual numbering modes or a code-generation button.
- After confirmation, show the internal code prominently and the supplier number separately when present.
- Existing-lot pickers must distinguish rows by internal code and display supplier number and expiry as secondary details.
- Keep legacy numbers available as clearly labeled historical references; do not label unknown historical values as verified supplier numbers.
- Inventory, issue, transfer, adjustment, ledger, lot-detail, and QR views must continue identifying lots even when supplier numbers are null or duplicated.
- Preserve accessible labels, keyboard navigation, loading states, date validation, and entered content on API errors.

## 7. API Contract and Validation

- New-lot receipt input accepts optional `supplierLotNumber`, `manufacturedDate`, and `expiryDate`; existing-lot input uses `lotId` exclusively for lot selection.
- Return `lotCode`, `supplierLotNumber`, and applicable legacy references in lot-bearing responses. Draft new-lot lines have no `lotCode`; confirmed or existing-lot lines resolve it from their selected lot.
- Never use supplier numbers as map keys, identity, deduplication keys, or mutation targets. Continue using `lotId` for stock operations.
- Remove client and server validation that requires a supplier number or rejects duplicate supplier numbers within a receipt.
- Preserve quantity, money, date, tracking-mode, tenant, warehouse, and authorization validation. QUANTITY/ASSET lines must reject the new LOT metadata just as they reject inappropriate lot metadata today.
- Update DTOs, OpenAPI responses, API types, serializers, selectors, audit snapshots, and relevant notification content together.
- Do not silently reinterpret legacy `lotNumber` request fields as internal codes or supplier numbers. Updated clients use the explicit new field. Receipt mutations reject obsolete `lotNumber` and client-supplied `lotCode` with HTTP 400 through `forbidNonWhitelisted`; no supported-version gate currently exists.
- Keep deprecated response aliases for existing readers: lot responses expose `lotNumber = lotCode`; receipt lines expose `lotNumber = supplierLotNumber ?? legacyLotNumber` and `lotNumberFromLot = lotCode`. These aliases do not make old mutation payloads compatible.
- When updating draft rows, clients send the saved row's `id` as `lineId` to preserve its legacy reference. Rows are replaced on save; missing, foreign, or reused line IDs do not copy another row's legacy number.

## 8. Confirmation, Concurrency, and Failure Handling

Preserve the existing receipt lock and idempotent confirmed-state handling. Validate references and dates before inserting lots. Allocate internal codes while inserting new lots, link their IDs to receipt lines, and commit lots, balances, ledger, receipt state, and required audit/notification records together.

- Any failure rolls back all business writes. Sequence gaps are the only permitted allocation side effect.
- Concurrent confirmations of different receipts may carry equal supplier numbers and must create distinct internal codes.
- Concurrent confirmations of the same receipt must create each lot and stock movement only once.
- Never recover from a code collision by attaching an unrelated lot. Fail atomically and report the error; investigate sequence/seed configuration.
- Preserve existing lock ordering and any transaction retry policy. No network lookup runs inside the confirmation transaction.

## 9. Historical Data and Rollout

1. Inspect actual legacy data and all lot creation paths before writing the migration. Source inspection cannot establish whether historical numbers came from suppliers or staff.
2. Preserve every old number as a legacy reference. Migration `0026` assigns existing lots codes in `(created_at, id)` order, then sets the sequence to continue after the backfilled codes, without changing UUIDs or stock references. Leave `supplierLotNumber` null unless its provenance is independently verified.
3. Preserve old draft numbers as legacy references; show them for review instead of silently discarding them or asserting that they are supplier numbers. New-lot drafts can still confirm with no supplier number.
4. Verify row counts, code uniqueness/non-nullness, preserved legacy text, unchanged quantities, and intact foreign keys. Complete backfill and constraints before enabling new writers.
5. Coordinate migration and API/web deployment with the mobile owner using the handoff guide. Mobile code changes are a separate task. If the API is deployed before mobile is updated, current mobile new-lot receipt requests fail with HTTP 400; deprecated response aliases only preserve reads. Release timing and any accepted interruption must be agreed before deployment; handing off documentation does not imply acceptance of that interruption.
6. Update seeds, fixtures, and import paths. In particular, replace seed upserts keyed by `(farm_id, item_id, lot_number)` with stable fixture identity, not supplier-number uniqueness.

Rehearse the migration on representative data before release. Do not perform a destructive reverse migration after non-unique supplier numbers exist: the old constraint and contract cannot represent the new data safely. Prefer a forward fix or a verified restore procedure.

## 10. Implementation Order and Affected Areas

| Step | Changes | Verification |
| --- | --- | --- |
| 1. Schema and migration | `api/src/db/schema/schema.ts`, new migration and metadata under `api/drizzle/`; sequence, new fields, legacy preservation, constraints and index | Migration rehearsal, preserved IDs/references/quantities, distinct global codes |
| 2. Receipt backend | `api/src/modules/warehouses/stock-receipts.service.ts`, receipt DTOs/controllers and responses; use existing transactions and permissions | New lots without supplier numbers, duplicates accepted, top-ups unchanged, rollback/idempotency |
| 3. Lot queries and consumers | `api/src/modules/inventory/`, lot-bearing warehouse responses, audit/notification consumers identified by reference search | Lookup by both fields, tenant isolation, correct identity when supplier numbers repeat |
| 4. Web | `web/features/receipts/` form, logic, types, API and details; inventory/issue lot selectors and other lot displays | New/existing flows, advisory matches, null/duplicate supplier-number rendering |
| 5. Mobile handoff | Deliver `mobile/INVENTORY_LOT_MOBILE.md`; the mobile owner separately updates API types, receipt flows, lot detail, inventory, QR and other lot-bearing screens | Current PR checks documentation against the API; the mobile owner verifies mobile save/submit/confirm, reopened drafts, pickers and errors |
| 6. Fixtures and regression | `api/scripts/seed.ts`, `seed-demo-inventory.ts`, existing API/client tests and related fixtures | Seeds remain repeatable, no supplier-number identity assumptions remain |

Before editing, search all references to `lotNumber`, `lot_number`, `inventoryLots`, and `uq_lot_per_item_farm`, including raw SQL and generated schema artifacts. Change each affected caller according to its actual meaning; do not blindly rename every occurrence. Follow the project's existing migration/generation process for derived artifacts.

## 11. Verification and Acceptance Criteria

Extend existing suites, especially `api/test/stock-receipts.integration.e2e-spec.ts`, related inventory/schema suites, and `web/features/receipts/components/receipt-draft.logic.test.mjs`. Use the project's pnpm scripts and report checks as passed, failed, or not executed.

- A LOT receipt with no supplier number can be saved, submitted, and confirmed through the API and web. Mobile acceptance belongs to the mobile owner's separate task.
- Confirmation creates a nonblank internal code, stock balance, ledger entries, and source receipt link atomically.
- The database rejects missing or duplicate internal codes, including duplicates across farms.
- Equal supplier numbers are accepted across suppliers, within one supplier/item, across receipts, and on multiple new-lot lines within one receipt.
- Concurrent distinct receipts receive distinct internal codes; repeated/concurrent confirmation of one receipt does not duplicate lots or stock.
- A forced later-line failure leaves no partial lots, stock, ledger, or confirmed state; a sequence gap is acceptable.
- Existing-lot top-ups preserve identity and metadata, including when the supplier number is absent or shared by other lots.
- Supplier-number suggestions are tenant/item scoped, advisory, and require an explicit selection to reuse a lot.
- Invalid dates, cross-farm IDs, mismatched items, forbidden fields, and unauthorized confirmation remain rejected.
- Historical numbers remain retrievable without being misclassified; existing balances, transfers, issues, and QR identities still resolve by UUID.
- Updated API types, OpenAPI examples, web displays, seeds, and fixtures use the two fields consistently. The mobile guide documents the new contract, deprecated response aliases, required client changes, and HTTP 400 behavior for obsolete mutations; mobile implementation is not an acceptance criterion for this PR.
- Migration and concurrency checks run against PostgreSQL; mocks and source inspection alone do not establish these guarantees.

## 12. Scope Boundaries

The current change covers the API/web identity split, migration, seeds, tests, and mobile handoff documentation. Mobile source changes and mobile verification are owned separately by the mobile implementer. Excluded: manual internal-code overrides, configurable numbering formats, gap-free lot numbering, lot merging/splitting tools, automatic provenance inference, a new supplier master-data model, and changes to document numbering or approval permissions.
