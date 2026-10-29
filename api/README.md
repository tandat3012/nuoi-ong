# Nuôi Ong API

NestJS 11 API for farm operations and the public storefront. PostgreSQL access uses Drizzle ORM and `pg`; Clerk verifies session JWTs. All routes use the `/api/v1` prefix.

## Structure

```text
api/
├── src/
│   ├── main.ts                 # Bootstrap, validation, CORS, Swagger
│   ├── app.module.ts           # Registers infrastructure and business modules
│   ├── app.controller.ts       # Public root endpoint
│   ├── health.controller.ts    # Public health endpoint
│   ├── common/                 # Query parsing, pagination, OpenAPI constants
│   ├── cloudinary/             # Cloudinary provider and image upload service
│   ├── db/
│   │   ├── database.service.ts # pg Pool and typed Drizzle database
│   │   └── schema/
│   │       ├── schema.ts       # Farm, catalog, warehouse, inventory, asset data
│   │       ├── relation.ts     # Drizzle relations
│   │       ├── storefront.ts   # Store settings, categories, products, variants, images
│   │       └── index.ts        # Schema exports
│   └── modules/                # Controllers, services, DTOs, and colocated unit tests
├── drizzle/                    # SQL migrations, triggers, snapshots, journal
├── drizzle.config.ts           # Schema and migration configuration
├── scripts/                    # seed.ts, seed-storefront.ts, seed-demo-inventory.ts
└── test/                       # HTTP and database integration suites
```

## Module ownership

| Module | Responsibility |
| --- | --- |
| `auth/` | `clerk/`: session authentication, provider, request types and decorators; `accounts/`: account context, state guard and initial password change; `farm-access/`: membership and farm role guard. `auth.module.ts` composes these parts. |
| `personnel/` | Farm personnel profiles, roles, workplace assignments, status, handover and audit history; resumable Clerk account provisioning |
| `catalog/` | Internal categories, units, items, suppliers, and farm reference data |
| `materials/` | Material records and tracking modes: `QUANTITY`, `LOT`, `ASSET` |
| `warehouses/` | Warehouses and stock receipts, issues, counts, and transfers; each document flow has its own controller/service |
| `inventory/` | Balances, lots, ledger, alerts, and manual inventory adjustments |
| `assets/` | Asset lookup/return in `AssetsService`, lifecycle operations in `AssetLifecycleService`, history in `AssetHistoryService`, employee transfer requests in `AssetTransferRequestsService`; imports `WarehousesModule` |
| `maintenance/` | Maintenance records, completion/cancellation, employee maintenance requests, and integration with asset and stock state |
| `notifications/` | In-app notifications, mobile push devices, and the Expo push outbox worker |
| `audit-logs/` | Stock document change history, scoped by role |
| `dashboard/` | Farm summary: stock value, items below minimum, expiring lots, assets in maintenance, pending adjustments and today's orders (`Asia/Ho_Chi_Minh`) |
| `commerce/` | Public product/category reads through `CommerceController` and `CommerceService`; `products/` and `orders/` are placeholders for future module separation |
| `store-admin/` | Back-office management of store products, variants, images, and categories |
| `store-orders/` | Customer orders (`/store/orders`) and staff order handling (`/store-orders`): confirm reserves stock through a draft issue, ship confirms it, cancel releases it |

`AppModule` composes these modules with `DatabaseModule` and `CloudinaryModule`. Controllers validate HTTP input and delegate to services. `DatabaseService` owns the connection pool and closes it on shutdown. The Drizzle schema under `src/db/schema/` is the application's schema source; `drizzle/` holds migrations and generated metadata.

The global validation pipe transforms DTO input, rejects unknown properties, and applies DTO validation. The global Clerk guard allows explicitly public endpoints. Farm-scoped controllers additionally enforce membership/roles and accept `farmId` in the query. Public store reads choose their sales warehouse on the server via `store_settings`.

See [commerce contracts and seed requirements](src/modules/commerce/README.md), [Cloudinary setup](src/cloudinary/README.md), and [repository architecture](../README.md).

## Local development

From `api/`:

```bash
cp .env.example .env
pnpm install
pnpm start:dev
```

Configure `DATABASE_URL`, Clerk keys, `CLERK_AUTHORIZED_PARTIES`, and `WEB_ORIGIN` for your environment. The root Compose database is exposed on `localhost:5435`; the API listens on port `5050` by default. Image upload configuration is documented in `src/cloudinary/README.md`.

```bash
pnpm db:generate         # Generate migrations from schema changes
pnpm db:migrate          # Apply migrations to the configured database
pnpm db:studio           # Inspect the configured database
pnpm db:seed             # Write core demo data
pnpm db:seed:storefront  # Write storefront demo data after core seed
pnpm db:seed:demo-inventory --farm FARM-DEMO      # Optional: DEMO-KHO warehouse stocked through the real services
```

Seeds change data; check the target database and the storefront seed requirements before running them. The core seed is idempotent and writes the `FARM-DEMO` farm with ADMIN, FARM_OWNER, EMPLOYEE and GUEST members. Its users have placeholder Clerk IDs (`seed_admin`, …), so they cannot sign in; add your own Clerk account to the farm to browse the data. Besides confirmed documents it seeds approval work from the employee: a pending receipt (`RCV-DEMO-PENDING`) and issue (`ISS-DEMO-PENDING`), a rejected issue (`ISS-DEMO-REJECTED`), a pending maintenance request for `AST-SMOKER-001`, a pending transfer request that holds `AST-EXTRACTOR-001` in `TRANSFER_PENDING`, and matching notifications for every active farm approver.

## Checks

```bash
pnpm exec eslint "{src,apps,libs,test}/**/*.ts"
pnpm test --runInBand
pnpm test:e2e --runInBand
pnpm test:db --runInBand
pnpm build
```

Unit tests are colocated as `src/**/*.spec.ts`; HTTP and database suites live in `test/`. `test:e2e` uses `test/jest-e2e.json` and runs the integration suites against `DATABASE_URL`; most create their own fixtures, but some assertions can be thrown off by existing rows. `test:db` (`test/jest-db.json`) runs only the database suite. Use a dedicated migrated database: some suites seed or reset data. `pnpm lint` also applies fixes; the ESLint command above checks without rewriting files.

## Stock document approval

Receipts, issues, counts and transfers share one lifecycle. Stock moves only inside the confirm transaction.

```text
DRAFT ──submit──▶ PENDING_APPROVAL ──confirm──▶ CONFIRMED
  │                     └──reject (rejectionReason)──▶ REJECTED (final)
  ├──confirm (ADMIN/FARM_OWNER only)──▶ CONFIRMED
  └──cancel──▶ CANCELLED
```

- ADMIN and FARM_OWNER are approvers: they confirm drafts directly and confirm or reject pending documents.
- EMPLOYEE creates drafts and edits, cancels or submits only their own; they cannot confirm.
- GUEST cannot create documents.
- A submitted document cannot be withdrawn by its creator. REJECTED is final.
- Submit notifies the farm's approvers; confirm and reject notify the creator.

Every create, edit, submit, confirm, reject and cancel writes an audit log in the same transaction. `GET /audit-logs` returns all entries to approvers and only the employee's own documents to EMPLOYEE (GUEST: 403); its `references` map ids to codes and names.

## Requests from employees

| Request | Create | Review | Effect of approval |
| --- | --- | --- | --- |
| `/maintenance-requests` | EMPLOYEE only, for an asset without active maintenance | ADMIN/FARM_OWNER; approve takes `scheduledAt` | Creates a SCHEDULED maintenance record in the same transaction |
| `/asset-transfer-requests` | EMPLOYEE only, for an `AVAILABLE` asset, with destination `warehouseId` and `locationId` | ADMIN/FARM_OWNER; reject takes `rejectionReason` | Runs the regular asset transfer in the same transaction |

Requests start as PENDING_APPROVAL; approvers see all of them, other members only their own. A pending transfer request holds the asset in `TRANSFER_PENDING`, which blocks other asset actions, and an asset can have only one pending request. If the destination is no longer valid, approval returns `409` and the request stays pending. Employees cannot withdraw requests yet.

## QR codes and notifications

Every QR encodes a web URL so a phone camera opens the web page and the mobile app reads the path: `{WEB_APP_URL}/scan/{assetCode}` for assets (`GET /assets/:id/label`), `/scan/item/{itemId}` (`GET /items/:id/qr`) and `/scan/inventory/{balanceId}` (`GET /inventory/:balanceId/qr`). Assets are looked up with `GET /assets/by-code/:assetCode`; `by-qr` remains but is unused. `WEB_APP_URL` falls back to `WEB_ORIGIN`, then `http://localhost:3000`.

`/notifications` lists and marks in-app notifications; `/notifications/devices/:installationId` registers mobile push devices. Push delivery runs from an outbox worker that is off by default: set `PUSH_WORKER_ENABLED=true`, plus `EXPO_ACCESS_TOKEN` when EAS enhanced push security is on (`PUSH_RECEIPT_DELAY_MS` controls the receipt check delay). The Clerk guard accepts native `Authorization: Bearer` tokens without an `azp` claim; tokens that carry `azp` must match `CLERK_AUTHORIZED_PARTIES`.

## Stock and asset rules

Stock issues accept ASSET lines only for `CONSUMPTION`, `OTHER`, and `DISPOSAL`. Report damage and start asset maintenance through the asset lifecycle endpoints. `DAMAGE` and `MAINTENANCE` stock issues accept only `QUANTITY`/`LOT` materials. Existing incompatible drafts can be cancelled or edited into a supported combination; confirmation returns `409` without moving stock. Any asset with active scheduled/in-progress maintenance must finish or cancel that workflow before a stock issue can be confirmed.

Direct stock issues and completed/cancelled repairs can leave an asset `IN_USE` without a holder. Maintenance supports this state without another inventory debit or a fabricated assignment. Completion does not receive stock; an explicit return to a valid warehouse/location does.

The asset lifecycle covers assignment/handover/start/return, dedicated physical transfers, incidents/loss, recovery and retirement. General stock transfers and stock counts reject ASSET lines; use `/assets/:id/transfer` (or a transfer request) to preserve physical location and stock consistency. Count and transfer lines for LOT items must carry a `lotId` of the same item. `SALE` issues are created only by store orders. Receipt lines for LOT items may reference an existing lot with `lotId` (`GET /lots`) instead of creating one. Resolving or cancelling a loss report does not receive inventory; `/assets/:id/recover` records physical recovery into a valid warehouse/location.

## API documentation

With `NODE_ENV=development`, Swagger UI is at `http://localhost:5050/api/v1/docs` and OpenAPI JSON at `http://localhost:5050/api/v1/docs-json`. Documentation is disabled outside development mode.

To authorize Swagger, sign in through the web app and copy the Clerk JWT from an authenticated request's `Authorization: Bearer …` header. Paste only the JWT into **Authorize**; copy a fresh token after expiry. Farm-scoped operations require a `farmId` UUID query parameter. **Try it out** calls the real API, so write operations change records.

## Personnel management

Apply the additive `0016_personnel-management` migration through `pnpm db:migrate` in the intended environment before running the new application version. Existing users keep `must_change_password=false`; user/member IDs and historical references are retained. The core seed adds demo work profiles, a workplace assignment and a `FAILED/DEMO_ONLY` provision with no Clerk identity or password.

All personnel routes require an active user, active farm membership and active farm, with ADMIN or FARM_OWNER in that farm. There is no system-role bypass for arbitrary farms. Owners manage EMPLOYEE/GUEST; only a farm ADMIN can assign FARM_OWNER. Existing SYSTEM grants are preserved during FARM role replacement. Role/status changes cannot change the actor's own membership or remove the last active owner. Warehouse assignments record workplaces and do not restrict farm access.

`POST /api/v1/personnel/accounts?farmId=...` requires a UUID `requestId`, name, real email, initial password, roles, optional work profile and warehouse IDs. It creates a banned Clerk identity with a reserved email, then commits the local membership before enabling sign-in. Reuse the same requestId and non-password payload for retries. Responses are 201 on completion, 200 on completed replay, or 202 while another request processes identity creation. A dependency failure returns a safe error and retains recoverable state. Passwords are never persisted or returned. Existing accounts use the separate `/personnel/existing-accounts` endpoint and keep their shared identity/password unchanged.

The global guard order is Clerk authentication, then database account state, then route guards. A new employee may call `/auth/me` and `/auth/change-initial-password` before changing the initial password. The password endpoint verifies the session user's current password, asks Clerk to update it and revoke active sessions, then clears the database flag. On a database failure after the Clerk update, sign in with the new password and repeat the required change; do not manually clear the flag to bypass the flow.

In development, the Clerk provider raises Node's process-wide address-selection attempt timeout to a minimum of 2,000 ms to accommodate slow IPv4 connections before falling back to unreachable IPv6. Larger existing values and production/test settings are preserved. Restart the development API if the watcher has not reloaded the provider. This adjustment does not establish production-host connectivity.

Password checks follow the Clerk instance's effective settings; the API does not bypass them or add its own blacklist. The development acceptance check found `disable_hibp=true` and observed a weak password being accepted. Enable **Reject compromised passwords** on the intended instance and verify both account creation and initial password change before release. Revoked sessions cannot mint new tokens, but already-issued JWTs can remain valid until their expiry.

Credential actions are limited to ten attempts per user/action per minute using atomic PostgreSQL buckets, shared across API instances. No additional deployment service or dependency is required.

### Provision recovery

An authorized operator may inspect `personnel_account_provisions` by requestId, selecting `id`, `farm_id`, `actor_user_id`, `status`, `error_code`, `clerk_user_id`, `member_id`, and timestamps. Do not copy the request body into logs or support tickets. Look up Clerk using the exact external ID `personnel:<requestId>` and verify the recorded identity/email; email alone does not prove ownership of a provision.

- PENDING/FAILED with no recorded identity: check that external ID for an uncertain creation result before any retry. The normal endpoint performs this recovery automatically.
- IDENTITY_CREATED: the new identity remains banned. Retry the same request while the original actor still has management permission; the API rechecks permissions before creating membership.
- MEMBERSHIP_CREATED: membership and audit are committed; retry enables sign-in without recreating either. If Clerk was already enabled but the final database update failed, the API recognizes that state.
- An abandoned identity must stay banned until reviewed. Re-authorize the original actor through normal admin procedures when appropriate, or remove only a newly created identity after verifying the matching external ID and absence of successful membership. Never ban, unban, delete, or reset a pre-existing identity based only on email. DEMO_ONLY seed records are illustrative and have no Clerk identity.
