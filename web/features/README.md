# Feature conventions

Each top-level folder represents a business capability, not one database table or one page. Management and customer-facing commerce share UI primitives but have separate layouts and data-access needs.

## Current features

| Folder | Responsibility / entry routes |
| --- | --- |
| `auth/` | Clerk-backed session and farm context, farm switcher, authenticated request hook |
| `dashboard/` | Static operational overview at `/dashboard` |
| `catalog/` | Module definition used by the `/catalog` placeholder |
| `materials/` | Material management at `/materials` |
| `warehouses/` | Warehouse list/detail and warehouse API functions at `/warehouses` |
| `inventory/` | Balances, ledger, lots, and adjustments at `/inventory` |
| `receipts/` | Receipt drafts and receipt management at `/receipts` |
| `issues/` | Issue drafts and issue management at `/issues` |
| `counts/` | Stock-count screen at `/counts`; form currently selects `QUANTITY` items |
| `transfers/` | Stock-transfer screen at `/transfers`; form currently selects `QUANTITY` items |
| `assets/` | API functions, asset screens/detail, forms, types, and pure asset logic at `/assets` and `/assets/[id]` |
| `maintenance/` | Maintenance screen and API calls at `/maintenance` |
| `qr/` | QR camera scanner, scan parsing, and asset lookup at `/scan` and `/scan/[assetCode]` |
| `commerce/` | Storefront, products, categories, browser cart; checkout and orders remain placeholders |

## Folder conventions

Add subfolders only when the feature needs them:

- `api/` for feature-specific endpoint functions.
- `components/` for feature UI.
- `hooks/` for client-side orchestration.
- `schemas/` for form and API validation.
- `types/` for types owned by the feature.

Routes in `app/` should remain thin and compose exports from these feature folders. Generic UI, API transport, configuration, and cross-feature types belong in `shared/`.

Management features reuse `auth/hooks/use-authenticated-request.ts` and `shared/api/client.ts`; farm-scoped calls pass the selected `farmId`. Commerce product/category functions use native `fetch` for public endpoints. Feature-owned types remain local; share types only when multiple capabilities need the same contract. Pure logic checks use the existing `*.test.mjs` convention and run with `pnpm test` from `web/`.

See [web architecture and routes](../README.md) and [commerce details](commerce/README.md).
