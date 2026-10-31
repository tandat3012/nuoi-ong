# Internal Asset Management — Implementation Specification

Status: Historical baseline; see [current phases and progress](ASSET_MANAGEMENT_PHASES.md)  
Source review date: 2026-10-24

The current-state tables and deferred list below describe the original review, not today's working tree. The expansion phases supersede that deferred scope.

## 1. Objective

Replace the asset module placeholder with a working, farm-scoped asset management interface. Users must be able to find an asset, inspect its current record, and, when authorized, return it to a valid warehouse location without corrupting inventory.

Deliver read-only list and detail screens independently of the return action. Enable returns only after the backend transaction and concurrency requirements in this specification pass verification.

This document specifies planned changes. It does not claim that the described screens or backend fixes already exist.

## 2. Verified Current State

| Area | Current implementation |
| --- | --- |
| `/assets` | Renders `ModuleOverview`, not asset data. |
| Asset list API | Supports search, status, item, warehouse, location, and pagination. |
| Asset detail API | Supports lookup by ID, asset code, and QR token. |
| Asset return API | Exists, but requires concurrency and receiving-location safeguards before exposure through the new UI. |
| `/scan/[assetCode]` | Displays the supplied code; does not load the asset. |
| Assignment data | Stored in `asset_assignments`; not included in asset detail responses. |
| Asset tests | Existing service/controller tests cover reads. No direct return workflow tests were found in the reviewed files. |

### 2.1 Backend Risks Found During Source Review

`api/src/modules/assets/assets.service.ts`, `AssetsService.returnAsset()` currently:

1. Reads asset status without locking the asset before mutation. Concurrent requests may both pass the eligibility check and increment stock.
2. Increments the selected warehouse balance without updating `assets.current_location_id`. Returning to a different warehouse can leave inventory and physical-location records inconsistent.
3. Uses a read-then-insert path when the balance does not exist, which needs explicit handling for concurrent returns of different assets sharing the same balance.

These are source-based risks. Reproduce the relevant failures with focused tests before implementing fixes.

Existing issue confirmation locks balances before individual assets. The return implementation must respect compatible lock ordering.

## 3. Scope

### Included

- Asset list, filters, pagination, and refresh.
- Asset detail route with direct navigation and reload support.
- Farm-scoped code lookup through the existing scan route.
- Authorized returns to an active warehouse and an active location in that warehouse.
- Backend fixes needed to make returns safe.
- Loading, empty, error, conflict, and permission states.
- Farm-switch isolation and stale-response handling.
- Focused frontend, backend, database, and browser verification.

### Deferred

- Direct asset creation, editing, or deletion. New assets continue to originate from confirmed stock receipts.
- Assignment creation or reassignment to members.
- Incident reporting and maintenance management screens.
- Complete asset lifecycle/history views and current-holder display.
- Camera scanning, QR label generation, and printing.
- Dashboard metrics, notifications, and approval workflows.

Remove the placeholder “Add asset” action from the new asset screen rather than presenting an unsupported operation.

## 4. Architecture and Reuse

- Keep route files thin; place business UI and orchestration in `web/features/assets/`.
- Use `useAuthContext()` for the selected farm and membership roles.
- Use `useAuthenticatedRequest()` for authenticated transport. Do not create another Axios client or fetch `/auth/me` independently in this module.
- Reuse `PageInfo` and `PaginatedResponse<T>` from `web/shared/api/contracts.ts`.
- Reuse the existing UI components and warehouse patterns: `PageHeader`, `Badge`, `Pagination`, `ErrorAlert`, `Dialog`, and `Button`.
- Use the existing database schema and migrations. No schema migration is planned for this specification.
- Do not introduce a new dependency or global data cache.

## 5. API Contracts

All API routes below have the `/api/v1` prefix. Frontend request helpers must omit that prefix because the shared client supplies it.

Every request includes `farmId` from the selected farm. Route parameters, form inputs, and stored browser values must not override this scope.

| Method and route | Purpose | Response |
| --- | --- | --- |
| `GET /assets` | List assets | `{ data: AssetView[], page: PageInfo }` |
| `GET /assets/:id` | Read an asset | `{ data: AssetView }` |
| `GET /assets/by-code/:assetCode` | Exact asset-code lookup | `{ data: AssetView }` |
| `GET /assets/by-qr/:qrToken` | QR-token lookup; existing API, no new scanner in scope | `{ data: AssetView }` |
| `POST /assets/:id/return` | Return an asset | `{ data: Asset }` |
| `GET /warehouses` | Warehouse lookup | Existing paginated response |
| `GET /locations` | Location lookup, filtered by warehouse | Existing paginated response |
| `GET /items` | Asset-tracked item lookup | Existing paginated response |

### 5.1 Read Models

Preserve the existing response shape:

```ts
type AssetStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'IN_USE'
  | 'MAINTENANCE'
  | 'LOST'
  | 'RETIRED';

type AssetView = {
  asset: Asset;
  itemCode: string;
  itemName: string;
  locationCode: string | null;
  locationName: string | null;
  locationWarehouseId: string | null;
};
```

Define `Asset` from the actual controller/schema fields: identifiers, asset code, serial, QR token, status, source receipt item, current location, purchase and warranty information, maintenance dates, note, and timestamps.

- Keep `purchasePrice` as `string | null`, matching PostgreSQL numeric serialization.
- Keep date-only values as date strings; do not shift calendar dates through timezone conversion.
- Display absent values explicitly; do not render missing monetary values as zero.
- Do not coerce decimal strings through an unsafe floating-point conversion. Reuse a formatter only if its accepted range and precision meet the field contract; otherwise add the smallest exact display formatter with boundary tests.
- Do not synthesize holder, assignment, warehouse-name, or history fields absent from the response. Resolve labels through existing lookup APIs only where needed.

### 5.2 List Parameters

Use the existing parameters:

```ts
type AssetFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: AssetStatus;
  itemId?: string;
  warehouseId?: string;
  locationId?: string;
};
```

Defaults are page `1` and page size `20`; the API caps page size at `100`. Search currently covers asset code, serial number, and item name. Preserve the current backend search contract in this work.

### 5.3 Return Input Extension

Extend `ReturnAssetDto` with optional `locationId`:

```ts
type ReturnAssetInput = {
  warehouseId: string;
  locationId?: string;
  note?: string | null;
};
```

- `warehouseId`: required UUID.
- `locationId`: optional UUID at the API boundary; the new UI always requires a concrete selection.
- `note`: optional string or null, maximum 4,000 characters.

Location resolution:

1. When supplied, `locationId` must identify an active location in the selected warehouse and farm.
2. When omitted, reuse the asset's current location only if it is active and belongs to that warehouse and farm.
3. If neither produces a valid receiving location, reject with `409` and make no changes.

This retains the old request shape but deliberately tightens behavior: a legacy request that would return stock to a warehouse without a matching asset location must now fail. Update Swagger and test this compatibility boundary explicitly.

Do not automatically select or create a location on the server.

## 6. Authorization

| Operation | Authorization |
| --- | --- |
| List, detail, code lookup | Authenticated users with an active membership and an allowed role under the existing farm guard. |
| Return | `ADMIN` or `FARM_OWNER` in the selected farm, with active user/membership checks. |

Frontend role checks control visibility; they do not replace backend authorization. Retain `ClerkAuthGuard`, `FarmAccessGuard`, and the service-level write-access check.

Do not broaden existing roles or make asset endpoints public. Cross-farm asset IDs, codes, QR tokens, and lookup selections must never disclose records from another farm.

## 7. Asset List Screen

Route: `/assets`.

### Columns

| Field | Display |
| --- | --- |
| Asset code | Link to `/assets/[id]`. |
| Item | Item code and name. |
| Serial number | Serial or an explicit empty marker. |
| Status | Vietnamese status badge. |
| Location | Code/name, or a clear “Location not recorded” message. |
| Next maintenance date | Date or empty marker. |

Status labels:

| Value | UI label |
| --- | --- |
| `AVAILABLE` | Sẵn sàng |
| `ASSIGNED` | Đã cấp phát |
| `IN_USE` | Đang sử dụng |
| `MAINTENANCE` | Đang bảo trì |
| `LOST` | Thất lạc |
| `RETIRED` | Ngừng sử dụng |

### Filters and Behavior

- Provide search, status, item, warehouse, and location filters.
- Restrict item choices to `trackingMode=ASSET`. Allow inactive items in read filters so historical assets remain discoverable.
- Restrict location choices to the selected warehouse when a warehouse filter is set.
- Clear the selected location whenever the warehouse changes.
- Reset pagination to page 1 when search or any filter changes.
- If the current page exceeds the available range after refresh, load the last valid page; use page 1 for an empty result.
- Keep filters in component state, following the current internal-module pattern. Cross-reload filter persistence is not required.
- Provide refresh, clear filters, loading, empty, and retryable error states.
- Use searchable or paginated lookup controls. Do not silently truncate selectable data to the first 100 results.
- Do not show a previous farm's or previous query's data as the current result while loading.
- Support keyboard navigation and readable mobile layouts without page-level horizontal overflow.

## 8. Asset Detail Screen

Route: `/assets/[id]`.

Load data using the route asset ID and the currently selected farm. Direct URL entry and browser reload must work.

### Content

- Identity: asset code, serial, item, and status.
- Location: current location and associated warehouse, when known.
- Purchase and warranty: purchase date, purchase price, and warranty expiry.
- Maintenance dates: last and next maintenance dates.
- Notes, rendered as plain text.
- Created and updated timestamps.

Do not display a current holder or lifecycle timeline until a backend contract supplies that information.

### Actions and States

- Back to asset list.
- Refresh asset detail.
- Return to warehouse when both role and status allow it.
- Invalid ID state without issuing an invalid API request.
- Loading, forbidden, not-found, and retryable-error states.

An asset missing from the selected farm must be treated as unavailable in that scope. Do not automatically switch farms to locate it.

## 9. Asset Return Workflow

### UI Eligibility and Form

Show the return action only for `ADMIN` or `FARM_OWNER` when the asset is `ASSIGNED` or `IN_USE`. Recheck all conditions on the backend.

The form requires:

1. An active receiving warehouse in the selected farm.
2. An active receiving location within that warehouse.
3. An optional note, up to 4,000 characters.

Changing warehouse clears the location. A warehouse without an eligible location must produce a clear explanation and disable submission. Do not choose the first location silently.

Show the asset identity and receiving destination before confirmation. Disable duplicate submission while the request is pending.

### Backend Transaction

All return mutations must execute in one transaction:

1. Validate the user's write access.
2. Identify the farm-scoped asset and its item.
3. Acquire the receiving balance lock before the asset lock, consistent with issue confirmation. When needed, create the balance row safely using the existing uniqueness constraint, then lock it.
4. Lock and reread the asset. Validate its farm, item identity, and returnable status after locking.
5. Validate the active receiving warehouse and resolved location within the same transaction; protect relevant rows where required for the chosen concurrency strategy.
6. Mark any active assignment for this asset/farm as `RETURNED`, with return and update timestamps.
7. Set asset status to `AVAILABLE` and update `currentLocationId` and `updatedAt`.
8. Increase the receiving balance by exactly one using database arithmetic.
9. Insert exactly one transaction with `transactionType=RETURN_IN`, `sourceType=ASSET_RETURN`, the asset ID, receiving warehouse, performer, and note.
10. Return the updated asset row. Any failure rolls back all changes, including a newly created balance row.

Use the existing `uq_inventory_balance` uniqueness constraint, including its null-lot behavior. Do not rely on an unprotected read-then-insert sequence. Revalidate any preliminary asset/item read after obtaining the locks.

Preserve compatible lock ordering with issue confirmation. A local asset-first locking fix is insufficient if it introduces a balance/asset deadlock.

### Concurrency and Retry Contract

- Concurrent returns of the same asset: exactly one succeeds; the other receives `409`, with no second stock increment or ledger entry.
- Sequential duplicate return before another valid issue: reject with `409`.
- Concurrent returns of different assets sharing a balance: both succeed without lost increments or balance-row uniqueness errors.
- Return competing with issue confirmation: no partial changes, duplicate movements, or deadlock in the tested scenarios. Outcomes must follow the serialized asset state.
- A failed ledger insert rolls back asset, assignment, and balance changes.
- Do not automatically retry POST requests after a client timeout or network error. The result may already have committed; instruct the user to reload asset state before retrying.

After success, reload detail to obtain the full `AssetView` and location labels. Invalidate or reload the list when shown again. Do not optimistically adjust inventory in the browser.

## 10. Code Lookup

Connect `/scan/[assetCode]` to `GET /assets/by-code/:assetCode`, scoped to the selected farm, and reuse the asset detail presentation and return flow.

- Treat the existing route parameter as an asset code.
- Encode the value as a URL path segment when calling the API.
- Reject blank or overlength codes consistently with the 100-character asset-code field.
- Do not infer that a UUID-looking asset code is a QR token.
- Do not add camera access, a new QR payload format, or token lookup UI in this phase.

## 11. State Isolation and Error Handling

### Farm Changes and Stale Responses

- Scope request state to farm and asset/query identity. Reuse keyed farm components and request-generation or cleanup patterns already used in warehouse screens.
- On farm change, clear list/detail data, pagination, selected lookups, and the return form.
- Ignore responses from prior farms, prior detail IDs, or superseded list queries.
- A submitted mutation may complete in the old farm after navigation. Do not show its result or success message in the new farm.
- Closing or unmounting a form must not cause late responses to update unrelated state.

### Error Mapping

| Condition | UI behavior |
| --- | --- |
| `400` | Display validation errors relevant to the form or filters. |
| `401` | Use the existing shared unauthorized/sign-in handling. |
| `403` | Display lack of access; do not retain stale protected data as current content. |
| `404` | Show that the asset is unavailable in the selected farm. |
| `409` during return | Display conflict, preserve useful input where appropriate, and allow asset refresh. Reevaluate action eligibility after refresh. |
| Read network/server error | Show a retry action. |
| Write network/server error with uncertain outcome | Explain that completion is unknown and require reload before retry; do not automatically resubmit. |

Return errors must remain visible and understandable without relying on raw stack traces. Form controls need labels, keyboard access, focus handling, and pending feedback using existing dialog/UI primitives.

## 12. Planned File Changes

New paths below are proposed implementation locations, not existing files.

| File or area | Change |
| --- | --- |
| `web/app/(dashboard)/assets/page.tsx` | Replace placeholder composition with the asset list screen. |
| `web/app/(dashboard)/assets/[id]/page.tsx` | Add thin detail route. |
| `web/features/assets/index.ts` | Export implemented screens/components instead of the placeholder definition where no longer needed. |
| `web/features/assets/types/asset.ts` | Define read/filter/return types matching the API. |
| `web/features/assets/api/assets.api.ts` | Add asset reads, code lookup, return, and required lookup helpers. Reuse existing warehouse API helpers. |
| `web/features/assets/hooks/` | Add only orchestration needed for list, detail, return, and stale-response handling. |
| `web/features/assets/components/` | Implement list, filter toolbar, detail, and return form/dialog. |
| `web/features/qr/index.tsx` | Replace code-lookup placeholder with implemented asset lookup composition. |
| `api/src/modules/assets/dto/return-asset.dto.ts` | Add validated optional location ID. |
| `api/src/modules/assets/assets.service.ts` | Implement transaction, concurrency, and receiving-location guarantees. |
| `api/src/modules/assets/assets.controller.ts` | Update return documentation and examples. Preserve response envelopes. |
| `api/src/modules/assets/assets.controller.spec.ts` | Cover changed DTO/controller behavior where appropriate. |
| `api/test/assets.integration.e2e-spec.ts` | Add actual HTTP/PostgreSQL asset read and return coverage. |
| Frontend tests beside changed files | Cover request contracts and interaction/state behavior. |

Keep component/hook count proportional to the implementation. Do not create empty layers or wrappers solely to match the directory list.

The existing proxy already protects `/assets(.*)` and `/scan(.*)`. Verify the new routes remain covered instead of adding redundant route entries.

## 13. Implementation Sequence

| Step | Deliverable | Exit criteria |
| --- | --- | --- |
| 1 | Focused backend regression tests | Tests reproduce unsafe duplicate return and incorrect receiving-location behavior. |
| 2 | Safe backend return workflow | Pass transaction, location, authorization, rollback, and concurrency tests. |
| 3 | Frontend types, API helpers, and list | Correct contracts, filters, pagination, lookups, and farm changes. |
| 4 | Detail and code lookup | Direct URL/reload, scoped lookup, error handling, and stale-response isolation work. |
| 5 | Return UI | Validated destination, pending/error states, conflict handling, and refresh after success work. |
| 6 | Integrated acceptance | Browser interactions and real API/database flows pass; remaining environment limitations are documented. |

Steps 3–4 can be delivered as a read-only increment. Step 5 must not ship before step 2 passes.

## 14. Verification and Acceptance Matrix

### Backend and Database

- List filters, stable pagination, detail, exact code lookup, QR-token lookup, and missing records.
- Active reader can read; GUEST cannot return, including direct POST attempts.
- Inactive user, inactive membership, absent membership, and unauthorized farm are rejected.
- Foreign-farm asset IDs, codes, tokens, warehouse IDs, and location IDs disclose no foreign data.
- Malformed UUIDs and unsupported status values are rejected before mutation.
- Only `ASSIGNED` and `IN_USE` assets can be returned.
- Explicit location must be active and belong to the receiving farm/warehouse.
- Omitted location follows the documented fallback; missing/invalid fallback is `409`.
- Return to another warehouse updates both balance and physical location.
- Existing and absent destination balance rows are handled safely.
- Active assignment is closed; absence of an assignment does not prevent a valid `IN_USE` return.
- Repeated/concurrent same-asset return produces one increment and one ledger entry.
- Different assets returning to the same item/warehouse balance do not lose increments.
- Competing return and issue requests preserve invariants without deadlock.
- Injected late failure rolls back every preceding mutation.
- Existing receipt and issue ASSET suites continue to pass.

### Frontend and Browser

- API helpers use relative paths, the selected farm, and the actual response envelopes.
- Filter changes reset the page; changing warehouse clears location.
- More than 100 lookup records remain reachable through pagination/search.
- Missing values and large decimal prices display correctly.
- Direct detail URL and reload work; wrong-farm and missing assets show the correct state.
- Old requests cannot restore stale farm/query/detail data.
- Reader roles have no return action; eligible writers do.
- Return form requires a valid warehouse/location and enforces note length.
- Double submission is prevented while pending.
- `409` and uncertain write outcomes are handled without automatic resubmission.
- Successful return reloads the asset and displays the receiving location.
- Code lookup reuses the detail behavior and never interprets codes as tokens implicitly.
- Keyboard and dialog focus behavior work; 390px and 1440px layouts have no page-level horizontal overflow.
- Anonymous access to `/assets`, `/assets/[id]`, and `/scan/[assetCode]` is protected.

### End-to-End Operational Flow

With isolated test data, verify:

```text
Confirm ASSET receipt with location
→ inspect asset detail
→ confirm asset issue
→ return asset to a selected warehouse/location
→ inspect asset, balance, and ledger
→ issue the asset again from its receiving warehouse
```

Use actual API/PostgreSQL integration tests for transaction correctness. Browser fixture tests validate UI behavior separately. Complete a hosted Clerk sign-in followed by authenticated FE → BE → PostgreSQL verification before declaring full environment acceptance; fixture identities do not prove that integration.

Run focused tests, lint, type checks, and builds for changed code. Use `pnpm`; if the default launcher remains broken in the local environment, use `corepack pnpm`. Avoid the existing API lint script's automatic fixes when performing verification only.

## 15. Completion Criteria and Remaining Decisions

Implementation is complete when:

1. Authorized readers can find and open real assets in the selected farm.
2. Eligible writers can return an asset to a valid warehouse/location.
3. Asset status, location, assignment, balance, and ledger remain consistent under tested normal, failure, and concurrent requests.
4. Other roles and farms cannot perform or observe unauthorized operations.
5. Loading, errors, direct URLs, mobile layouts, and farm switching meet the acceptance matrix.
6. Verification results clearly distinguish real integrations, fixture-based checks, and unexecuted environment checks.

### Proposed Product Decision

Require a concrete receiving location in the new return UI. Existing warehouse filtering and ASSET issue eligibility depend on asset location; increasing only the aggregate warehouse balance is insufficient.

Do not silently repair old assets with missing or inconsistent locations. Identify such records during acceptance and handle any reconciliation as an explicit, separately reviewed data task. This specification does not introduce a direct location-editing API.

### Limits

This is a source-reviewed implementation plan. The identified return concurrency risks still need executable reproduction. Full maintenance-state synchronization, historical data repair, and broader warehouse-deactivation races are outside this change and must not be implied to be solved by the return transaction improvements.
