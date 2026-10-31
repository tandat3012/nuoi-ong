# Asset management — expansion phases

Authorized scope: implement the deferred asset workflows discussed on 2026-10-24.
This extends ASSET_MANAGEMENT_SPEC.md; its original deferred list is no longer the current implementation scope.

## Functional scope

1. Assignment and holder: active farm member/location selection, assign, hand over, start use, return. Exactly one active holder; stock leaves a warehouse only once.
2. History: paginated assignment, movement, incident, maintenance and metadata audit records; readable actor and holder names within the selected farm.
3. Incidents and maintenance: report damage/loss, resolve/cancel incidents, recover lost assets, schedule/start/complete/cancel maintenance. State transitions and stock movements are atomic. Finishing maintenance leaves an asset out of inventory until an explicit return to a valid receiving location.
4. Records and QR: manually register an asset with an opening inventory movement, edit descriptive fields with stale-write protection, retire with stock adjustment and retained history, generate/print QR, camera and manual code lookup. Do not hard-delete financial records.
5. Acceptance: scoped tests, HTTP/PostgreSQL lifecycle and concurrent transactions, stock receipt/issue regression, mobile/desktop browser interactions, real Clerk authentication through FE → BE → PostgreSQL. Distinguish fixture and real authentication evidence.

## Engineering boundaries

- Existing farm guards and ADMIN/FARM_OWNER write access apply throughout.
- Keep balance-before-asset lock ordering compatible with receipt/issue/return.
- Keep precise decimal strings and calendar dates. Validate all foreign references in the selected farm.
- Existing schema, inventory ledger, assignment, incident, maintenance and audit tables are authoritative.
- Reuse current components; do not add a second client or global cache.
- Unsafe/uncertain writes require reload before another attempt. Ignore late responses after farm/navigation changes.
- Existing inconsistent locations are reported, never silently repaired.
- Primary owns architecture, implementation and final acceptance; supporting review is read-only.
- No commits, publication or changes to application/production data are part of this work. Existing migrations may run only on a disposable test database for acceptance.

## Completion phases

The original feature groups above already have substantial frontend/backend code. The remaining phases below separate implementation presence from verified acceptance. The original specification's current-state section is historical.

| Phase | Deliverable | Exit criteria | Status |
| --- | --- | --- | --- |
| 0 | Fix asset type/lint failures; explicit isolated asset/warehouse integration target; current documentation | Full API type-check and scoped lint pass; test command rejects unsafe DB targets and runs asset, issue and receipt suites | Completed |
| 1 | Reconcile stock issues with asset maintenance and lifecycle | No unsupported damage/maintenance ASSET issue; active maintenance blocks generic asset issue; valid unassigned IN_USE assets can enter maintenance without another stock debit | Completed |
| 2 | Accept assignment, handover, start use, return and dedicated transfer | One active holder, correct location/balance/ledger, concurrent writes and rollback verified across relevant transitions | Completed; browser acceptance remains in Phase 6 |
| 3 | Accept incidents, loss, recovery and retirement | Valid transitions, farm/role checks, duplicate/concurrent requests and rollback verified; closing loss reports never implicitly receives stock | Completed; real authentication remains in Phase 7 |
| 4 | Complete maintenance acceptance and agreed editing workflow | Test each starting state, completion/cancellation and explicit receiving; decide scope of schedule/metadata editing in the UI | Partially covered by Phase 1 regressions |
| 5 | Verify history and audit across all entry points | Actor/holder names, references, paging, costs/results and changes remain readable and complete | Pending |
| 6 | Browser and device acceptance | Farm switch/stale responses, permissions, uncertain writes, keyboard/dialog behavior, 390px/1440px layouts, camera and print verified | Automated browser checks recorded; physical camera/print and Safari pending |
| 7 | Real environment acceptance | Hosted Clerk → frontend → API → isolated PostgreSQL; receipt/issue regression and acceptance evidence recorded | Real unauthenticated smoke passed; authenticated Clerk acceptance pending |

### Phase 0–1 behavior

| Stock issue type | ASSET lines | QUANTITY / LOT lines |
| --- | --- | --- |
| CONSUMPTION / OTHER | AVAILABLE → IN_USE, unless active maintenance exists | Existing behavior |
| DISPOSAL | AVAILABLE → RETIRED, unless active maintenance exists | Existing behavior |
| DAMAGE / MAINTENANCE | Rejected; use the asset incident/maintenance workflow | Existing behavior; MAINTENANCE requires its farm-scoped maintenance record |

- Unsupported ASSET combinations return `400` on create/edit. Confirmation rechecks old drafts and returns `409` with no stock or ledger movement. Cancel or edit an old draft into a supported combination; existing data is not silently repaired.
- Confirmation locks inventory balance before the asset, then checks scheduled/in-progress maintenance under the asset lock. Asset source locations must be active in the issuing warehouse.
- `IN_USE` can mean outside available warehouse inventory without a named holder after a direct issue or completed/cancelled repair. Starting maintenance from this state neither invents a holder nor debits stock again. `ASSIGNED` still requires an active assignment.
- Completing/cancelling started maintenance leaves the asset outside available inventory. Explicit return to a valid warehouse/location receives it once.
- No dependency or schema migration was added.

### Verification recorded for Phase 0–1

- Regression tests first reproduced scheduled-maintenance bypass and rejection of valid IN_USE assets without a holder before the production changes.
- API full TypeScript check: passed, including test sources.
- API scoped ESLint for assets, maintenance, affected issue code and integration suites: passed. The earlier formatting and unsafe test payload errors were fixed without disabling rules.
- API asset unit tests: 2 suites, 9 tests passed.
- HTTP/PostgreSQL regression: 3 suites, 119 tests passed, including assignment/return/transfer concurrency, stock receipt/issue behavior and the new Phase 1 cases, including inactive source locations.
- Test database configuration checks: 2 tests passed, covering missing/remote/application/query-overridden targets and explicit local test URLs.
- Frontend asset/API/QR and issue validation logic: 14 tests passed; scoped ESLint and TypeScript check passed.
- API build: passed.

PostgreSQL acceptance used a disposable PostgreSQL 18 container on loopback port 55439, without application volumes. Existing migrations were applied only there. Test HTTP identities are fixtures; these results do not prove real Clerk sign-in or browser/device acceptance. Full web build and camera/print checks were not run in these phases.

### Phase 2–3 behavior and acceptance

The existing lifecycle services already implement these workflows. Phase 2–3 added HTTP/PostgreSQL acceptance and fault-injection tests rather than duplicating the implementation. No runtime service, schema, migration or dependency change was needed.

| Action | Accepted behavior |
| --- | --- |
| Assign / hand over | An active farm member receives the asset at an active farm location. AVAILABLE → ASSIGNED debits one stock unit; changing the holder of ASSIGNED/IN_USE leaves inventory unchanged and cancels the previous assignment. An issued IN_USE asset without a holder can be assigned without another debit. |
| Start use | ASSIGNED with an active assignment → IN_USE, without another stock movement. Duplicate starts conflict. |
| Return | ASSIGNED/IN_USE → AVAILABLE at a valid receiving location; close the active assignment and receive one unit. Duplicate returns conflict. |
| Dedicated transfer | Only AVAILABLE assets with valid source inventory can move. Crossing warehouses writes one balanced TRANSFER_OUT/TRANSFER_IN pair with a shared movement group; relocating within one warehouse changes location and audit only. Use `/assets/:id/transfer`; general stock transfers reject ASSET lines, including old drafts. |
| Report damage / other incident | Record an OPEN incident and audit without changing asset status, holder or inventory. |
| Report loss | AVAILABLE → LOST debits one unit. Loss of an assigned/in-use asset cancels its active assignment without another debit. Duplicate loss reports conflict. |
| Close an incident | OPEN → IN_PROGRESS/RESOLVED/CANCELLED; IN_PROGRESS → RESOLVED/CANCELLED. Terminal/repeated transitions conflict. RESOLVED records a resolution timestamp. Resolving or cancelling a loss report does not receive inventory or change the asset's status. |
| Recover | Only LOST → AVAILABLE at an active farm warehouse/location, with one RETURN_IN movement. The previous assignment is not restored, and the incident remains independently open or closed. Duplicate recovery conflicts. |
| Retire | Only AVAILABLE, with source inventory, no active maintenance and a required reason → RETIRED. Debit one unit; retain the asset, reason, history and audit. |

Scheduled/in-progress maintenance blocks assignment, start use, return, physical transfer, loss and retirement. All writes retain the ADMIN/FARM_OWNER requirement; references must belong to the selected farm. Missing source stock and invalid locations are rejected instead of silently repaired.

Verification recorded on 2026-10-25:

- Added 50 asset acceptance cases covering the write boundaries and transitions above; retained the earlier 31 asset cases.
- HTTP/PostgreSQL regression: **4 suites, 182 tests passed** on a fresh migrated PostgreSQL 18 database, without a demo/application seed. This includes the general count/transfer suite, now selected by `test:assets` alongside assets, issues and receipts.
- Concurrency: duplicate assignment/handover/start/return/transfer/loss/recovery/retirement, competing incident closures, assignments competing for the last unit, opposite warehouse transfers, transfer versus issue, and loss versus retirement preserve valid balances, locations and holders.
- Injected ledger/audit failures verify complete rollback of assignment, handover, start use, return, transfer, loss, incident closure, recovery and retirement. Failure on the second transfer movement rolls back the first movement and any new destination balance; retries after rollback succeed once.
- Fixed count/transfer fixture cleanup to delete assets before their referenced items. No application data repair was performed.
- Full API TypeScript check and ESLint for both affected integration suites: passed.
- Existing frontend asset/API/QR/issue logic: **14 tests passed**. Database-target configuration: **2 tests passed**.

The asset suite uses fixture identities with the real farm guard and access service. The count/transfer contract suite stubs its access service; it adds stock compatibility evidence, not additional authentication evidence. Browser, camera/print, real Clerk authentication and staging acceptance remain in Phases 6–7. Application builds were not rerun in Phase 2–3 because runtime code did not change.

Run from `api/` with a migrated local database whose name ends in `_test`:

```bash
TEST_DATABASE_URL='postgresql://postgres:TEST_PASSWORD@127.0.0.1:55439/nuoi_ong_asset_test' pnpm test:assets
pnpm test:assets:config
```

The runner does not fall back to the application's `DATABASE_URL`. See [API test setup](api/README.md#asset-and-warehouse-regression-tests).

### Phase 6–7 verification on 2026-10-25

- Ran Next dev and Nest directly from TypeScript, without application builds. PostgreSQL 18 was isolated on loopback port 55440 with a temporary `_test` database and no application volumes.
- The initial Chromium acceptance run recorded **21 passes out of 22 cases**, with no page runtime errors. It exercised desktop/mobile layouts, lifecycle writes through the API into PostgreSQL, role restrictions, stale responses, uncertain writes, conflicts, QR download/print-document creation and synthetic camera decoding/cleanup. Browser identities were fixtures at the Clerk boundary; farm guards, services and database operations were real.
- The remaining case exposed Escape dismissing the parent dialog when an open native lookup had focus on its trigger. Both mutation and return dialogs now find the open picker within their dialog. Focused Chromium/Firefox checks verify Escape from the search field and trigger, keeping the parent open, selecting a value and restoring focus. The initial run is retained as historical evidence; it is not represented as a complete post-fix rerun.
- Real FE/BE smoke: database health `200`; protected API without a token or with an invalid token `401`; matching-origin CORS preflight `204`; `/assets`, `/maintenance` and `/scan` redirect to the hosted Clerk sign-in screen. No authenticated Clerk session was used.
- Frontend logic/API/QR/issue checks: **14 tests passed**; full frontend TypeScript check and scoped ESLint passed. Earlier Phase 2–3 receipt/issue and lifecycle regression remains the recorded backend evidence; it was not rerun for this dialog-only change.
- WebKit could not launch because host libraries were missing. Real phone camera permission/optics, physical printing and authenticated Clerk end-to-end acceptance remain manual. Phases 6 and 7 are **not complete**.

See [browser acceptance evidence and manual steps](ASSET_BROWSER_ACCEPTANCE.md) for the exact limits, repeatable dialog regression and Clerk/device checklist.
