# Stock Document Numbering — Implementation Plan and Specification

Status: Agreed design; implementation pending.

## 1. Objective

Remove mandatory manual document-code entry from normal stock workflows. Assign a permanent, human-readable code when a document is confirmed. Support paper-document matching through owner-only advanced options without disrupting automatic numbering.

Cover the API, web, mobile, stock issues generated from store orders, and consumers of document codes. Preserve existing approval permissions and historical references.

## 2. Verified Current Behavior

- `api/src/db/schema/schema.ts` defines non-null codes for `stock_receipts`, `stock_issues`, `stock_transfers`, and `stock_counts`, with uniqueness scoped to a farm.
- The four stock services under `api/src/modules/warehouses/` accept codes when creating drafts. Their confirmation transactions lock the document and return without repeating stock mutations when it is already confirmed.
- `WarehousesService.assertDocumentWriter()` permits employees to create and submit drafts. Confirmation access currently includes `ADMIN` and `FARM_OWNER`.
- Web forms require codes. Mobile has client-generated codes based on `Date.now()`.
- `api/src/modules/store-orders/store-orders.service.ts` creates stock issue drafts with an `XB-...` code.
- Stock-document audit snapshots and notifications include document codes.
- Existing cancellation rules primarily cover pre-confirmation states. This feature does not introduce cancellation or reversal of posted stock movements.

These findings describe inspected source, not a production-data audit. Recheck affected code before implementation because the working tree contains existing changes.

## 3. Numbering Rules

| Document | Prefix | Example |
| --- | --- | --- |
| Stock receipt | PN | PN-2026-000001 |
| Stock issue, including sales | PX | PX-2026-000001 |
| Stock count | KK | KK-2026-000001 |
| Stock transfer | CK | CK-2026-000001 |

- Scope a counter by `(farm_id, document_type, year)`, shared across warehouses within that farm.
- Use the confirmation year in `Asia/Ho_Chi_Minh`, calculated once for the confirmation attempt on the server. The document's business date remains independent and may be backdated.
- Start each new scope at 1. Pad to a minimum of six digits; never wrap, truncate, or reset at 999999. For example, the next value after 999999 is 1000000.
- New drafts have no permanent code. Use the existing UUID as their identity.
- Display a localized draft label, creator, creation time, and a short ID reference where needed to distinguish drafts. Never display a temporary identifier as a permanent document code.
- Assign codes only upon successful confirmation, including documents that pass through pending approval or counting states.
- A permanent code is immutable after confirmation and must never be reused. Do not fill historical gaps or renumber existing documents.
- Different farms may use the same code. Within a document type and farm, permanent codes must be unique.

## 4. Advanced Options and Authorization

Expose advanced options only to an active `FARM_OWNER` of the selected farm. Enforce this on the API as well as in the UI; confirmation permission alone does not grant override permission. An `ADMIN` without the relevant owner role does not automatically qualify.

Provide two distinct fields/behaviors:

1. **External paper reference:** optional reference text that does not change the permanent system code or its counter. It need not be unique because external issuers may reuse references.
2. **Requested permanent code:** an explicit override for matching paper records. Require a reason and audit the actor and changes. Store it separately while the document is a draft. Validate availability again at confirmation; a draft request does not reserve a code.

Trim and uppercase requested permanent codes, enforce the existing 50-character limit, and reject empty values. Preserve external reference text after trimming. Define validation centrally and use it consistently in API and clients.

Only owners can add, change, or clear advanced values. Existing approvers may confirm an owner-authorized request without gaining permission to modify it. Audit both the owner who requested it and the actor who confirms it.

If a requested code is unavailable, roll back confirmation and return a clear conflict. Preserve the draft and its content so the owner can change the request. Do not silently substitute another code.

## 5. Manual Codes and Gaps

Manual overrides must not advance automatic counters. For example, confirming a manual `PX-2026-999999` while the counter is at 42 leaves the next automatic candidate at 43.

When an automatic candidate is already occupied by a historical or manually assigned code, skip it and continue upward. Record numbering provenance so skipped occupied codes and manual assignments remain explainable. A skipped occupied value is not an unaccounted missing document.

| Event | Expected result |
| --- | --- |
| New draft saved, rejected, or cancelled before confirmation | No number consumed |
| Confirmation fails | Counter and all document/stock mutations roll back |
| Confirmation request repeats after successful commit | Return the existing confirmed document and code |
| Owner requests a very high formatted code | Automatic counter remains unchanged |
| Automatic numbering reaches an occupied code | Skip it and allocate the next free candidate |
| Future reversal or void of a posted document | Retain the original code; never recycle it |

Use a transactional counter table, not a PostgreSQL sequence or a client-side maximum-plus-one calculation.

## 6. Transaction and Locking Design

Reuse existing confirmation transactions and document locks. The shared allocator must accept the caller's transaction and must not open or commit a separate transaction.

Confirmation order:

1. Resolve permissions and lock the document using existing conventions. Preserve existing order/document lock requirements for sales-linked issues.
2. If already confirmed, return its existing result without allocating a code or repeating stock effects.
3. Validate state and lock affected business records in a consistent order.
4. Validate and write stock balances, asset changes, and inventory ledger entries.
5. Acquire the numbering lock and allocate or validate the permanent code.
6. Persist the code, confirmation metadata, and `CONFIRMED` status in one update; write audit and required transactional notification data; commit.

Keep numbering locks near the end of the transaction. Do not perform network calls while holding database locks. Audit and notifications must use the newly confirmed row/code rather than the earlier draft snapshot.

### Automatic allocation

- Create the counter row safely when the scope is first used, then lock it for update.
- Increment from its current value, skipping occupied permanent codes, and persist the chosen value in the same transaction.
- The database unique constraint remains the final safeguard. A collision must never produce partial stock effects.
- Do not catch a PostgreSQL uniqueness error and continue issuing queries in an aborted transaction. Use a deliberate savepoint or roll back and retry the complete transaction with a bounded policy if such a fallback is needed.

### Manual allocation and coordination

- A manual code matching a canonical system code must coordinate with the counter scope represented by that code, including its encoded year. Locking only the current year is insufficient for a manually requested code from another year.
- Acquiring or creating that scope's counter for coordination must not advance its value because of the manual assignment.
- Check availability under the lock, then persist the manual code.
- Arbitrary manual codes remain protected by the unique constraint; concurrent requests for the same code yield one success and one conflict with complete rollback.
- Historical mixed-case codes must be considered during availability checks, without silently rewriting history.

### Transfers and deadlocks

- Lock balance records across both source and destination using one stable ordering, not source-first ordering. Apply the same convention across operations that touch the same balances.
- Include creation of missing destination balances in the locking/upsert design; sorting existing rows alone is insufficient.
- Inspect asset, order, document, and balance lock dependencies before finalizing the implementation. Never acquire business-record locks after acquiring a numbering lock.
- Handle PostgreSQL deadlock/serialization failures with bounded whole-transaction retry where appropriate. Retries must not duplicate stock movements, audit records, or notifications.

## 7. Database Changes and Migration

Update the runtime Drizzle schema and migration artifacts using the repository's migration conventions. Do not treat generated schema snapshots as independent sources of truth.

| Table | Permanent code column |
| --- | --- |
| stock_receipts | receipt_code |
| stock_issues | issue_code |
| stock_counts | count_code |
| stock_transfers | transfer_code |

For each of the four tables:

- Drop `NOT NULL` from its code column.
- Retain uniqueness on farm and code using normal PostgreSQL NULL semantics. Do not use `NULLS NOT DISTINCT`: multiple uncoded drafts must be valid.
- Add a check equivalent to `status <> 'CONFIRMED' OR (code IS NOT NULL AND btrim(code) <> '')`, using the actual column and enum type.
- Preserve existing constraints on confirmation actor and time.
- Add nullable external-reference, requested-code, override-reason, and numbering-provenance data as needed. Use existing audit infrastructure to record actors and changes.

Add a counter table with a unique/primary key on farm, document type, and year; a nonnegative last-used value; and a farm foreign key. Use an integer representation that supports growth beyond six digits without JavaScript precision loss.

### Existing data

- Preserve every existing permanent code, including codes on old drafts, rejected documents, and cancelled documents. These remain occupied references.
- Old drafts retain their existing code when confirmed; they do not receive a second number. Treat this as a migration compatibility rule, not permission to change their codes freely.
- Seed counters from the greatest numeric suffix of existing codes matching the canonical prefix/year format in each scope. Include all statuses because their codes remain occupied. This is a one-time compatibility policy, not the rule for new manual overrides.
- Preflight unusually large historical suffixes and normalized collisions. Report them before migration; do not automatically renumber or silently select a conflicting starting point.
- Nonmatching legacy codes remain valid and do not contribute to automatic suffix calculation.
- Validate all four tables for confirmed rows with missing/blank codes before adding checks. Resolve any invalid data explicitly.
- Coordinate backfill and deployment so concurrent legacy writes cannot invalidate counter initialization. Use a controlled write pause or a verified compatible rollout strategy.

#### Legacy codes are retained as seed/test data

Every code generated before this feature, whatever its shape, is existing seed data. Keep all of it unchanged and use it as fixtures for migration, allocation, and regression tests. Do not delete, clean up, normalize, or renumber it.

- Shapes expected in the data include client-generated codes (`REC-<timestamp>`, `ISS-<timestamp>`, `TRANSFER-<timestamp>`), order-generated issue codes (`XB-...`), hand-typed codes, mixed-case or whitespace-variant codes, and codes that already look like the new format. Verify the actual shapes in the preflight rather than assuming this list is complete.
- Codes that do not match the canonical prefix/year format stay valid and occupied, and do not affect counter seeding (see the rule above). Codes that do match are seeded as specified, and any unusually large suffix is reported by the preflight, not rewritten.
- Legacy codes may be reused by tests only as existing, occupied values. No test or migration step may modify them to make a test pass.
- If the preflight finds a collision or anomaly caused by this data, resolve it with an explicit recorded decision on the counter or the migration, never by editing the legacy codes.

## 8. Affected Modules

### API

- `api/src/db/schema/schema.ts` and new migrations under `api/drizzle/`.
- `api/src/modules/warehouses/stock-receipts.service.ts`.
- `api/src/modules/warehouses/stock-issues.service.ts`.
- `api/src/modules/warehouses/stock-counts.service.ts`.
- `api/src/modules/warehouses/stock-transfers.service.ts`.
- Relevant create/update DTOs and four stock controllers, including OpenAPI examples and nullable response contracts.
- `api/src/modules/warehouses/warehouses.service.ts` for owner-specific authorization using active farm membership.
- `api/src/modules/warehouses/stock-document-audit.ts` and document notification payload construction.
- `api/src/modules/store-orders/store-orders.service.ts`: new sales issue drafts have no code and use the common PX allocator when the issue itself is confirmed. Preserve order links, allocation behavior, and restrictions on editing order-generated issues.
- Inventory/history consumers of document codes.
- Add a small shared numbering helper/service within the existing warehouse architecture; avoid a general-purpose workflow framework.

### Web

- Receipt and issue draft forms, logic, hooks, API types, tables, detail views, and draft pickers under `web/features/receipts/` and `web/features/issues/`.
- `web/features/counts/components/counts-screen.tsx`.
- `web/features/transfers/components/transfers-screen.tsx`.
- Related audit, notification, search, and confirmation labels.

### Mobile

- `mobile/src/features/inventory/api.ts`.
- `mobile/src/features/inventory/presentation/ReceiptDetailScreen.tsx`: remove timestamp-generated receipt/issue codes from all submission paths.
- `mobile/src/features/inventory/presentation/InventoryActionScreen.tsx`: remove client-generated transfer codes.
- Stock count, receipt list/detail, dashboard, activity, and transfer-notification views that consume document codes.
- Trace remaining request builders before editing to ensure no legacy client-generated codes remain.

### Coverage of all code-generating paths

The change is complete only when every path that previously created or required a code is converted. Converting the web alone, or one document family alone, is not acceptable.

| Path | Receipt (PN) | Issue (PX) | Count (KK) | Transfer (CK) |
| --- | --- | --- | --- | --- |
| API create/update (DTO, service, OpenAPI) | required | required | required | required |
| Web draft form and screens | required | required | required | required |
| Mobile request builders | required | required | required | required |
| Store-order generated draft (`XB-...`) | n/a | required | n/a | n/a |

- Before implementation, build the path list from code, not from this table: search the API, web, and mobile sources for client- or service-side code construction (for example `Date.now()`, `REC-`, `ISS-`, `TRANSFER-`, `XB-`, and any other literal prefix used to build a document code) and for required-code form fields and DTO validators. Record the findings in the implementation notes.
- After implementation, repeat the same search. The only remaining matches may be seed data, tests, and the new allocator. Any other match is a missed path and blocks completion.
- Every document family must be exercised end to end in each client that creates it: create an uncoded draft, submit, confirm, and verify the allocated code.

## 9. UX and Scope Boundaries

- Normal forms explain that the permanent code is assigned upon confirmation.
- Advanced options are collapsed by default and visible only to eligible owners.
- Preserve employee submission and approval workflows. Do not remove required approval steps as part of numbering changes.
- A one-step create-and-confirm experience is a separate follow-up unless implemented with server-side request idempotency. Chaining create and confirm requests in the client alone is insufficient to prevent duplicate drafts on retry.
- Retrying confirmation of the same document is in scope. General idempotency of all draft-creation endpoints is not implicitly solved by the allocator.
- Do not renumber orders, assets, maintenance records, or other entities merely because they also have identifiers. Only the four stock-document families are covered here.

## 10. Implementation Sequence

1. Reinspect affected code and existing changes; follow `GIT_WORKFLOW.md` before Git operations. Preserve unrelated work.
2. Finalize migration fields and lock ordering from connected business paths; run read-only data preflight on the intended migration dataset when available.
3. Implement schema changes, counter backfill, and direct database constraint tests for all four tables.
4. Implement the shared transactional allocator and owner-only override validation, including concurrency and rollback tests.
5. Integrate the four confirmation paths, sales-generated drafts, audit, notifications, and API contracts.
6. Update web and mobile together for nullable draft codes and advanced options, covering every path in the coverage table in section 8.
7. Run focused regression, migration, concurrency, build/type checks, and manual UI checks. Review the final diff against this specification.
8. Coordinate deployment of schema, API, and clients using the legacy client compatibility policy below.

### Legacy client compatibility policy

Older mobile builds, and web sessions still running a stale bundle, may submit generated codes and may assume that draft codes are never null.

- **Upgrade gate:** the API must not return uncoded drafts to clients that cannot handle them. Ship the new mobile version first, then enforce a minimum supported mobile version (force-upgrade prompt or an equivalent mechanism) before or together with the API release that returns null draft codes. If no such mechanism exists today, building it is a prerequisite of this release.
- **Legacy request fields:** during the transition, the API accepts the old code fields on draft create/update and ignores them. It does not store them as the requested permanent code, and does not store them as the external paper reference. The draft is created uncoded and receives its permanent code at confirmation. Log each ignored legacy field with the client version so the transition can be monitored.
- **No reinterpretation:** old field names must never map to the owner-only advanced fields. Advanced fields use new names and remain subject to the owner-only authorization in section 4.
- **Removal:** once the minimum supported version excludes legacy builds and usage of the old fields has stopped, remove the tolerance and reject the old fields.
- This policy applies to all four document families and to the order-generated issue flow.

## 11. Verification and Acceptance Criteria

### Database

Test each table independently with direct database writes:

- Multiple drafts with null codes in one farm succeed.
- A confirmed row with a null or blank code fails.
- Duplicate permanent codes in one farm fail; the same code in different farms succeeds.
- Existing confirmation metadata checks still work.
- Migration preserves historical codes and correctly seeds counters, including legacy drafts and cancelled records.
- Migration tests run against seed data containing every legacy code shape found by the preflight (including non-canonical, mixed-case, and canonical-looking codes). The legacy codes are unchanged after migration, remain occupied, and non-canonical ones do not affect counters.
- Confirming an old draft keeps its existing legacy code and does not consume a counter value.

### Allocation and concurrency

- Many simultaneous confirmations in one scope receive distinct codes.
- Repeated and concurrent confirmation of one document produces one code and one set of stock effects.
- Injected failure after allocation rolls back the counter, stock changes, status, audit, and transactional notifications.
- A high manual code does not advance the automatic counter.
- Automatic allocation skips an occupied manual code without failing or duplicating stock effects.
- Manual and automatic attempts for the same canonical code serialize correctly, including an explicitly requested code from a different year.
- Concurrent arbitrary manual duplicates yield one success and one clear conflict.
- Confirmations across farms/types/years use independent counters.
- Year rollover follows the specified timezone; backdating the business date does not change the numbering year.
- Opposite-direction transfers, multiple lines, and missing destination balances do not cause inconsistent stock. Exercise and verify bounded retry behavior for transient database failures.

### Coverage and client compatibility

- The post-implementation source search described in section 8 finds no code-generating path outside seed data, tests, and the allocator.
- For each of the four document families, an uncoded draft created from each client that can create it (web, mobile, and the order flow for issues) is confirmed and receives a correctly formatted permanent code.
- A request carrying legacy code fields creates an uncoded draft, the legacy value is ignored and logged, and the document is not stored under that value.
- A client below the minimum supported version is stopped by the upgrade gate before it can receive uncoded drafts.

### Authorization and regression

- Employees and non-owner admins cannot inject advanced fields through direct requests.
- Owners cannot override another farm's documents or modify confirmed codes.
- Owner-authorized draft overrides remain auditable when another permitted approver confirms them.
- Existing receipt, issue, count, transfer, asset-related stock, and store-order workflows remain correct.
- Web/mobile show useful labels for uncoded drafts and permanent codes after confirmation; conflict errors preserve entered content.
- Audit and confirmation notifications contain the allocated code.

Extend the existing suites under `api/test/`, especially `stock-receipts.integration.e2e-spec.ts`, `stock-issues.integration.e2e-spec.ts`, `stock-counts-transfers.integration.e2e-spec.ts`, `warehouse-schema.integration.e2e-spec.ts`, and relevant store-order/business-flow tests. Use focused client logic tests and UI verification. Prefer pnpm for project commands.

Record checks as passed, failed, or not executed. Do not claim migration or concurrency correctness based only on mocks or static inspection.

## 12. Completion Definition

Normal users can create and submit stock drafts without entering a code, from every client and path that previously required or generated one, with no legacy code generation left outside seed data and tests. Existing legacy codes of any shape are retained unchanged as seed data. Successful confirmation assigns the correct immutable code without duplication or number consumption on rollback. Owner exceptions cannot force the automatic counter to jump. Database constraints enforce valid confirmed documents in all four tables. Historical references, approval permissions, stock integrity, sales links, and web/mobile compatibility are preserved and verified.
