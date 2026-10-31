# Mobile: Warehouse and Store Manager Roles

Status: API and web are implemented on `feature/role-access`. Mobile has not been started; this guide covers it.

Source of truth: the role groups in `api/src/modules/auth/farm-access/farm-role-groups.ts` and the API guards. If this guide and the API disagree, follow the API.

## What changed

Two farm roles were added: `WAREHOUSE_MANAGER` and `STORE_MANAGER`. The API is already authoritative. Mobile only needs to show the right actions and stop store-only members from entering screens that will fail.

| Role | Mobile-relevant scope |
| --- | --- |
| `ADMIN`, `FARM_OWNER` | Unchanged: full farm access. |
| `WAREHOUSE_MANAGER` | All warehouses in the farm. Creates and approves stock documents, adjusts inventory, manages materials, assets and maintenance, approves maintenance and asset transfer requests. Receives approval notifications. |
| `STORE_MANAGER` | Store only (products, orders, revenue). Mobile has no store features, and every warehouse, asset and maintenance API returns **403** for a store-only member. |
| `EMPLOYEE` | Unchanged on mobile: creates and submits own stock documents, requests maintenance and asset transfers, sees own activity. It lost order management, which mobile never had. |
| `GUEST` | Unchanged: read-only. |

A member can hold several roles in one farm. Permissions are the union, so `STORE_MANAGER + EMPLOYEE` keeps the employee mobile workflows.

## Backend behavior to expect

- **Store-only member:** 403 on `/warehouses`, `/stock-*`, `/inventory*`, `/items`, `/assets`, `/maintenance-*`, `/asset-transfer-requests`, supplier and location lookups.
- **Still allowed for store-only:** `/auth/me`, `/notifications*` and `/audit-logs` (own activity only).
- **Approval notifications:** stock documents, maintenance requests and asset transfer requests now also go to `WAREHOUSE_MANAGER`, both in-app and push.
- **`/dashboard/summary`:** fields outside the caller's area are `null`. Mobile does not call this endpoint today.
- **Possible upcoming change:** a pending review finding may put `GET /units` and `GET /categories` behind `FarmAccessGuard`. Mobile would then have to send `farmId`; see `src/features/inventory/presentation/InventoryActionScreen.tsx:90`. Check the API before shipping.

## Tasks

### 1. Role groups (new file)

Create `src/features/auth/farm-roles.ts` with the same groups as `api/src/modules/auth/farm-access/farm-role-groups.ts` and `web/features/auth/farm-roles.ts`:

```ts
// Mirrors api/src/modules/auth/farm-access/farm-role-groups.ts; the API stays authoritative.
export const FARM_ADMIN_ROLES = ['ADMIN', 'FARM_OWNER'];
export const WAREHOUSE_MANAGE_ROLES = [...FARM_ADMIN_ROLES, 'WAREHOUSE_MANAGER'];
export const STOCK_WRITE_ROLES = [...WAREHOUSE_MANAGE_ROLES, 'EMPLOYEE'];
export const FARM_AREA_ROLES = [...STOCK_WRITE_ROLES, 'GUEST'];

export const hasAnyRole = (roles: readonly string[], allowed: readonly string[]) =>
  roles.some((role) => allowed.includes(role));
```

`STORE_MANAGE_ROLES` is not needed on mobile.

### 2. Role types and labels

- `src/features/auth/types.ts`: add `'WAREHOUSE_MANAGER' | 'STORE_MANAGER'` to `FarmRoleCode`.
- `src/features/account/presentation/AccountLayout.tsx` (`roleLabels`): add `WAREHOUSE_MANAGER: 'Quản lý kho'` and `STORE_MANAGER: 'Quản lý cửa hàng'`. The type change makes this a compile error until it is done.

### 3. Management checks: allow warehouse managers

Replace `role === 'ADMIN' || role === 'FARM_OWNER'` with `hasAnyRole(roles, WAREHOUSE_MANAGE_ROLES)` in:

| File | Check |
| --- | --- |
| `src/features/assets/presentation/AssetDetailScreen.tsx:112` | `canManageMaintenance` |
| `src/features/assets/presentation/AssetDetailScreen.tsx:121` | `canReturnAsset` |
| `src/features/assets/presentation/MaintenanceRequestDetailScreen.tsx:62` | `canApprove` |
| `src/features/inventory/presentation/InventoryActionScreen.tsx:46` | `canScheduleMaintenance` |

Keep `canRequestMaintenance` (`AssetDetailScreen.tsx:115`) as `roles.includes('EMPLOYEE')`. The API still requires `EMPLOYEE` to submit maintenance and asset transfer requests.

Before closing this task, grep again for `'ADMIN'` and `'FARM_OWNER'` under `src/`. Do not touch owner-only controls such as document numbering options; they stay `FARM_OWNER` only.

### 4. Block store-only members

A member is store-only for the selected farm when `!hasAnyRole(membership.roles, FARM_AREA_ROLES)`.

1. **Routes** (`app/_layout.tsx`, `AppNavigator`): read the current membership from `useAuthContext()`. Wrap every warehouse, asset and maintenance screen in a nested `<Stack.Protected guard={!storeOnly}>`, so deep links and notification taps cannot open them.
   - Keep these outside the nested guard: `dashboard`, `notifications`, `account/*`, and `activity` / `activity/[id]` (own audit history is allowed). Check that the activity detail screen does not load warehouse data.
   - Covered by the guard: `inventory`, `inventory-detail`, `low-stock`, `activity/record`, `assets/*`, `counts/*`, `lots/*`, `maintenance/*`, `materials/new`, `receipts/*`, `scan/*`, `transfers/*`.
2. **Dashboard** (`src/features/home/presentation/DashboardScreen.tsx`): the farm switcher sheet lives only on this screen, so do not block the screen itself.
   - When `storeOnly`, skip the summary effect that loads warehouses, balances and stock documents (around line 70), and add `storeOnly` to its dependencies.
   - Render the header, farm card, profile card and farm sheet as usual. Replace the operational sections with one card, for example: "Ứng dụng di động dành cho kho, tài sản và bảo trì. Dùng bản web để quản lý cửa hàng."
   - The activity section can stay, because `/audit-logs` allows store managers to see their own activity.
3. **Bottom navigation** (`src/shared/ui/MobileShell.tsx`, `AppShell`): hide or disable tabs that lead to guarded routes when `storeOnly`.
4. **Notifications:** a store-only member should not receive warehouse notifications. If one arrives (for example, after a role change), tapping it must not open a guarded screen. Check where notification taps route (`/transfers/${entityId}` and similar).

### 5. Approve buttons on stock documents

Mobile currently creates and submits stock documents but does not approve them. If approval is added later, gate it with `WAREHOUSE_MANAGE_ROLES`, matching `canApproveStockDocuments` in `web/features/stock-documents/stock-document.logic.ts`.

## Verification

Use real Clerk development accounts. Seed users cannot sign in. Assign roles in web: **Nhân sự** → member → **Thay đổi quyền trong trại**.

| Account roles | Expected on mobile |
| --- | --- |
| `WAREHOUSE_MANAGER` | All warehouse screens work. Can schedule and record maintenance, return assets, and approve maintenance requests. Receives approval pushes. Account shows "Quản lý kho". |
| `STORE_MANAGER` only | Dashboard shows the notice card. No warehouse requests appear in the network log. Deep links such as `/receipts/new` and `/scan` do not open. Farm switching still works. |
| `STORE_MANAGER + EMPLOYEE` | Same as `EMPLOYEE`. |
| `EMPLOYEE` | Unchanged: create and submit documents, request maintenance; no approve buttons. |
| `FARM_OWNER`, `GUEST` | Unchanged. |

Also run `npx tsc --noEmit` in `mobile/`, plus the existing mobile tests.

## Out of scope

Store features on mobile, restricting managers to assigned warehouses, and new staff roles. All are deferred.
