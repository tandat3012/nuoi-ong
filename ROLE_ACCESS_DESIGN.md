# Farm Role and Access Design

Status: Implemented for API and web on `feature/role-access`. Mobile is deferred. See the addendum below.

## Objective

Introduce dedicated warehouse and store management roles so each employee can access the pages, actions, and data needed for their responsibilities. Keep `FARM_OWNER` responsible for the whole farm without requiring additional operational roles.

Start with two new roles:

- `WAREHOUSE_MANAGER`: manages warehouse operations.
- `STORE_MANAGER`: manages storefront products and orders.

Map each role to explicit permissions. Apply those permissions consistently to navigation, pages, actions, and backend APIs.

## Current Implementation

Graphify was used to locate relevant files, followed by direct source inspection. The following observations describe the inspected implementation, not the proposed behavior.

| Area | Current behavior | Relevant source |
| --- | --- | --- |
| Frontend access | Access is largely grouped into `canManageFarm` and `canManageOrders`. `EMPLOYEE` can manage orders. | [use-farm-membership.ts](web/features/auth/hooks/use-farm-membership.ts) |
| Navigation | Some items use `adminOnly`, `staffOnly`, and `storeOnly`. Warehouse navigation does not yet distinguish operational roles. | [navigation.ts](web/shared/config/navigation.ts) |
| API role guard | Checks active farm membership and any required role declared through `FarmRoles`. | [farm-access.guard.ts](api/src/modules/auth/farm-access/farm-access.guard.ts) |
| Warehouse authorization | Employees can create and submit their own stock documents; `ADMIN` and `FARM_OWNER` can approve. Shared access checks also serve assets and maintenance. | [warehouses.service.ts](api/src/modules/warehouses/warehouses.service.ts) |
| Membership model | A member can hold multiple roles within a farm. | [schema.ts](api/src/db/schema/schema.ts) |
| Personnel safeguards | Protects the last active farm owner. Assigning `FARM_OWNER` currently requires `ADMIN`. | [personnel.service.ts](api/src/modules/personnel/personnel.service.ts) |
| Order integration | Confirming a store order creates a related stock issue. | [store-orders.service.ts](api/src/modules/store-orders/store-orders.service.ts) |
| Mobile | Role types and several action checks explicitly reference the existing roles. | [auth/types.ts](mobile/src/features/auth/types.ts), [mobile README](mobile/README.md) |

Adding role codes and hiding menu items alone would not provide the required separation.

## Proposed Role Matrix

This matrix is a discussion baseline. Approval authority, warehouse scope, and asset responsibilities remain open decisions.

| Capability | Warehouse manager | Store manager | Farm owner |
| --- | --- | --- | --- |
| Inventory, receipts, issues, transfers, stock counts | Manage within assigned scope | No module access | Full farm access |
| Approve stock documents | If approval authority is delegated | No | Yes |
| Materials, lots, storage locations | Manage within warehouse responsibilities | Limited lookup for sales workflows | Full farm access |
| Store products, variants, images, selling prices | No | Manage | Full farm access |
| Store orders | No order management module access | Process | Full farm access |
| Sales reports | No | View, subject to confirmation | View |
| Personnel and operational role assignment | No | No | Manage within the farm |
| Sensitive configuration | No | No | Manage within existing authority |
| Audit history | Authorized warehouse activity | Authorized store activity | All farm activity |

Assets and maintenance should not automatically become warehouse manager responsibilities. Confirm whether the same person actually owns those workflows before granting access.

Potential future roles, only when needed:

- `WAREHOUSE_STAFF`: creates and submits stock documents without approval authority.
- `STORE_STAFF`: processes orders without managing prices or accessing full sales reports.
- A dedicated assets or maintenance role when those responsibilities belong to separate staff.

Initially add only the two requested management roles. Define an explicit migration policy for existing `EMPLOYEE` memberships, since that role currently spans warehouse and order workflows.

## Farm Owner Responsibilities

Keep `FARM_OWNER` able to access all operational modules within their own farm, including:

- Managing personnel and granting or revoking operational roles.
- Viewing farm reports and audit history.
- Approving warehouse operations and handling exceptions.
- Managing important configuration, such as document numbering rules.
- Covering warehouse and store work when staff are unavailable.

An owner should not need additional `WAREHOUSE_MANAGER` or `STORE_MANAGER` assignments to perform these duties. Having approval authority does not mean every document must wait for the owner; approval may be delegated to warehouse managers if agreed.

Preserve existing safeguards:

- Do not remove or deactivate the last active farm owner.
- Preserve the existing restriction that assigning `FARM_OWNER` requires `ADMIN`.
- Do not extend farm owner privileges to system-wide administration or other farms.

## Permission Model

Use a fixed role-to-permission mapping in code initially. A custom role editor or configurable permission management interface is not required for this scope.

Illustrative permission names:

```text
WAREHOUSE_MANAGER -> inventory.read, stock.write, stock.approve
STORE_MANAGER     -> store.products.manage, store.orders.manage, store.reports.read
FARM_OWNER        -> all operational permissions within the farm
```

These examples are not an exhaustive permission catalog. Final names and approval grants must follow the agreed matrix.

For members with multiple roles, combine permissions within the selected farm. Preserve active account, membership, and farm checks. Evaluate resource scope separately from functional permissions.

### Enforcement Layers

1. **Navigation:** hide unauthorized entries and sections with no visible entries.
2. **Pages and actions:** block direct URL access and check permissions for create, edit, approve, and other actions.
3. **Backend APIs:** enforce permissions and resource scope on every relevant operation, including reads, searches, reports, and downloads.

Backend authorization is authoritative. Frontend visibility is a usability layer, not an access control boundary.

Dashboard responses must also respect permissions. Warehouse staff should receive warehouse metrics and store staff should receive sales metrics. Hiding widgets while returning unauthorized data from the API is insufficient.

## Cross-Module Boundaries

### Store and Warehouse Data

Store staff may need to select materials linked to products or inspect sellable availability. Provide narrowly scoped lookup data for these workflows without granting access to the entire warehouse module or exposing unrelated fields such as cost prices.

The current order confirmation flow creates a stock issue. Preserve this authorized business operation when separating roles:

- Store staff may confirm an order through the order workflow.
- This must not grant unrestricted permission to create arbitrary warehouse issues.
- Warehouse staff may access the related stock issue needed for fulfillment without accessing the order management module.

The permission split applies to internal management functionality. Existing public storefront endpoints are a separate access boundary.

### Warehouse Scope

A role answers **what a member may do**. Warehouse assignments answer **where they may do it**.

If access is limited to assigned warehouses, the backend must enforce both conditions. Transfers need explicit rules for source and destination warehouse access. Do not assume that storing warehouse assignments already enforces them across all operations.

### Shared Authorization Helpers

Warehouse authorization helpers are also used by assets and maintenance. Review all callers before changing these helpers so granting warehouse access does not unintentionally grant asset or maintenance privileges.

## Implementation Sequence

1. Agree on the permission matrix, approval authority, warehouse scope, and treatment of existing `EMPLOYEE` memberships.
2. Add role records through the appropriate migration or seed mechanism; update personnel assignment validation and role types.
3. Introduce the fixed permission mapping and update backend guards and service checks. Review shared helpers and all affected callers.
4. Align navigation, direct page access, action controls, dashboards, and mobile behavior with the same permission definitions.
5. Verify denied access and allowed workflows, including the order-to-stock-issue integration.

Affected areas include authentication and membership responses, personnel management, warehouse operations, inventory, store administration, orders, reports, audit history, shared lookups, frontend navigation, and mobile role checks. Assets and maintenance require caller review even if their intended permissions remain unchanged.

## Acceptance Criteria

- A warehouse-only manager sees authorized warehouse functions and cannot access internal store management pages or APIs.
- A store-only manager sees authorized store functions and cannot access general warehouse pages or APIs.
- Necessary cross-module lookups expose only approved data.
- A member with both roles can use both sets of functions within the correct farm and resource scope.
- `FARM_OWNER` retains agreed farm-wide access and existing owner safeguards.
- Direct URL access and direct API requests cannot bypass authorization.
- Changing `farmId` or resource identifiers cannot expose another farm or unauthorized warehouse.
- Dashboard, reports, history, and downloads enforce the same data boundaries.
- Order confirmation still creates the appropriate stock issue without granting broad warehouse write access.
- Existing employee memberships are migrated according to an explicit policy, without accidental privilege expansion.
- Web and mobile expose only permitted actions; the API rejects unauthorized operations from either client.

## Decisions (agreed 2026-10-31)

1. Warehouse managers create and approve stock documents and inventory adjustments, and manage materials, warehouses, suppliers and locations.
2. Warehouse managers cover every warehouse in the farm for now. Limiting them to assigned warehouses (`farm_member_warehouses`) is planned later.
3. Warehouse managers also manage assets and maintenance, and approve maintenance and asset transfer requests (see the addendum).
4. Store managers manage products, prices, images, orders and sales reports. They have no access to warehouse, asset or maintenance modules, including reads. No `STORE_STAFF` role yet.
5. `EMPLOYEE` loses order management and keeps its warehouse and request permissions. No data migration: owners assign the new roles explicitly.

Role groups live in `api/src/modules/auth/farm-access/farm-role-groups.ts` (mirrored in `web/features/auth/farm-roles.ts`).

## Validation Status and Risks

This proposal is based on Graphify discovery and focused source inspection. No application code was changed and no runtime tests were executed for this analysis.

The main implementation risks are overlooked legacy `EMPLOYEE` permissions, shared authorization helpers that affect multiple modules, and breaking the order-to-stock-issue workflow while separating access.

## Final Decisions and Implementation Review Addendum

Status: Implemented for API and web on `feature/role-access`. Mobile (correction 8) is deferred by request.

This addendum supersedes conflicting proposals, open questions, and acceptance criteria above. There are no outstanding business decisions for the current scope.

### Agreed Role Responsibilities

| Role | Agreed scope |
| --- | --- |
| `WAREHOUSE_MANAGER` | Manages all warehouses in the farm, materials, equipment, assets, and maintenance. Can manage and approve all stock documents, adjust inventory, maintain warehouse master data, assign/return/transfer assets, manage asset lifecycle operations, schedule and record maintenance including costs/results, and approve maintenance and asset transfer requests, subject to existing business validations. Has no internal store management access unless another assigned role grants it. |
| `STORE_MANAGER` | Fully manages store products, prices, images, orders, and sales/revenue reports. Cannot access warehouse, asset, or maintenance modules or their general read APIs unless another role grants access. A restricted store-owned material lookup is allowed as described below. |
| `EMPLOYEE` | Loses order management access. Retains existing employee workflows: creating/submitting their own stock documents, requesting maintenance and asset transfers, viewing the warehouse portion of the dashboard, and viewing their own audit activity. Existing employee ownership and approval restrictions remain in place. |
| `FARM_OWNER` | Retains full operational access within the farm and can assign the two new operational roles without requiring `ADMIN`. Existing personnel and owner safeguards remain unchanged. |

Warehouse managers may process stock documents containing `ASSET` lines, including the resulting creation or update of asset records. This is explicitly within their responsibility.

Warehouse managers may receive approval notifications for stock documents, asset transfer requests, and maintenance requests. Separate approver groups for these workflows are not needed in this scope.

Access is farm-wide for warehouse managers. Assigned-warehouse restrictions are deferred. Members holding multiple roles receive the union of their allowed access within the relevant farm.

Do not migrate or automatically reassign existing `EMPLOYEE` memberships. Farm owners will manually assign the new roles to the people who need them.

### Implementation Approach: Fixed Role Groups

Keep the existing role-list model (`@FarmRoles`, role arrays, and `some` checks). Do not introduce a permission engine, permission catalog, or custom role editor.

Add backend constants in `api/src/modules/auth/farm-access/farm-role-groups.ts`:

```ts
FARM_ADMIN_ROLES = ['ADMIN', 'FARM_OWNER'];
WAREHOUSE_MANAGE_ROLES = [...FARM_ADMIN_ROLES, 'WAREHOUSE_MANAGER'];
STOCK_WRITE_ROLES = [...WAREHOUSE_MANAGE_ROLES, 'EMPLOYEE'];
STORE_MANAGE_ROLES = [...FARM_ADMIN_ROLES, 'STORE_MANAGER'];
FARM_AREA_ROLES = [...STOCK_WRITE_ROLES, 'GUEST'];
```

These are the agreed group definitions; apply the project's TypeScript conventions when implementing them.

- `FARM_ADMIN_ROLES`: personnel administration and existing owner/admin-only controls.
- `WAREHOUSE_MANAGE_ROLES`: warehouse, inventory, asset, and maintenance management and approval.
- `STOCK_WRITE_ROLES`: stock document creation/submission, preserving restrictions on employees' own drafts.
- `STORE_MANAGE_ROLES`: store administration, orders, and sales reports; excludes employee-only memberships.
- `FARM_AREA_ROLES`: access to the warehouse/asset/maintenance area. This is an entry check, not authorization for every action. Preserve existing action-level restrictions for employees and guests.

No separate asset-area group is required to exclude warehouse managers. Assets and maintenance are now explicitly included in their role.

### Approved Store Material Lookup

Store managers may select materials when linking store products through a restricted lookup under `store-admin`.

- Return only required identifiers and display fields, such as item ID, code, name, and unit.
- Do not expose cost prices, warehouse locations, asset records, or stock movement history.
- Enforce store management authorization and the appropriate farm/store boundary.
- Update the store product caller currently using `/items` to use this lookup.
- Do not grant store-only members general access to `/items` or warehouse APIs.

The existing order confirmation flow must continue to create its related stock issue through the authorized order workflow. This does not grant store managers permission to create arbitrary stock issues.

### Required Corrections to the Implementation Plan

1. **Run the role guard, not just the decorator.** Add `@UseGuards(FarmAccessGuard)` to relevant controllers that do not currently execute it. `@FarmRoles` only records metadata. Review catalog endpoints individually: categories and units currently do not run this guard, and adding it requires callers to supply the expected `farmId`. Preserve intentional method-level role overrides.

2. **Extend asset and maintenance management explicitly.** Update backend, web, and mobile management/approval checks to use the warehouse management group where appropriate. Review all callers of shared authorization helpers. Keep `assertFarmAccess`'s optional write-role default restricted to `FARM_ADMIN_ROLES`, and pass `WAREHOUSE_MANAGE_ROLES` explicitly for warehouse, inventory, asset, and maintenance management callers. Do not mechanically replace every owner/admin check.

3. **Preserve privileged safeguards.** Personnel administration remains restricted to farm administrators/owners. Preserve protection of the last active owner, existing self-change restrictions, and the existing requirement for `ADMIN` to assign `FARM_OWNER`. Keep `isOwner` and owner-only document numbering options unchanged. Neither new operational role may assign roles or acquire system administration privileges.

4. **Update all approval notification paths.** Include warehouse managers in both approval notification recipient selection and push eligibility for stock documents, maintenance requests, and asset transfer requests. They should not receive store-only privileges as a side effect.

5. **Make dashboard filtering authoritative.** Obtain role codes from backend-validated membership, not client input. Return warehouse/asset/maintenance metrics only to eligible farm-area staff and order metrics only to `STORE_MANAGE_ROLES`; return `null` for unauthorized fields. Guests remain excluded from staff metrics. Update response types, Swagger, frontend types, and rendering for nullable fields. Do not gate the entire dashboard on `canManageStore`, because employees and warehouse managers still need it.

6. **Separate history access from store access.** Add a dedicated `canViewHistory` check/navigation requirement. Admins and farm owners retain full farm history; warehouse managers, store managers, and employees see only their own activity. Guests remain denied. Module-based audit filtering is deferred.

7. **Align navigation, direct routes, and actions.** Keep `canManageFarm`, add `canManageWarehouse`, `canManageStore`, and `canAccessFarmArea`, and replace the old order-management flag with store management checks. Use farm-area access for warehouse/assets/maintenance navigation and store management access for all store management entries. Preserve store-farm eligibility checks. Hide empty sections and block unauthorized direct page access. Update warehouse, asset, and maintenance action controls as well as menu visibility.

8. **Cover mobile entry points.** Add role types and labels, update operational management/approval checks, and block unauthorized screens/deep links. Store-only users must not continue entering warehouse/asset/maintenance screens or triggering their data requests. Preserve employee request workflows and owner-only controls.

9. **Add roles without changing existing assignments.** Generate a custom migration using the current migration journal's next sequence; do not assume `0025` is still available. Insert both roles with `scope = 'FARM'` and `ON CONFLICT (code) DO NOTHING`. Update seed data, personnel role validation, Swagger enums, and role selection labels. The schema already supports multiple roles per farm membership.

10. **Use real development authentication for browser checks.** Existing seed users use `auth_provider = 'SEED'` and synthetic provider IDs; adding similar users does not create Clerk logins. Use real Clerk development accounts with the appropriate farm memberships for browser verification. Seed fixtures remain useful for database tests.

### Verification Requirements

- Exercise guarded routes through controller/HTTP tests; guard unit tests alone cannot detect a missing `@UseGuards` attachment.
- Verify warehouse managers can approve stock documents, adjust inventory, manage assets and maintenance, and receive the corresponding approval notifications.
- Verify employees cannot approve stock documents or access order management, while retaining their existing permitted draft/request workflows.
- Verify store managers can manage products using the restricted lookup and confirm orders that create stock issues, while general warehouse/asset/maintenance reads and writes return forbidden responses.
- Verify dashboard unauthorized fields are `null`, and history is restricted to the member's own activity for both new roles and employees.
- Verify combined roles use union semantics and changing `farmId` or resource IDs cannot cross farm boundaries.
- Verify owner role assignment safeguards and owner-only numbering controls remain intact.
- Check web navigation, direct URLs, action buttons, mobile screens, and mobile deep links for each role.
- Run appropriate API tests, relevant separate database suites, frontend tests, lint, and typecheck/build checks for API, web, and mobile. Default API Jest does not replace separately configured database suites.
- Apply the migration and seed only against the intended development database, and perform browser checks with authenticated Clerk development users.

### Deferred Scope and Current Status

Deferred: assigned-warehouse restrictions (`farmMemberWarehouses`), audit filtering by module, additional `STORE_STAFF`/`WAREHOUSE_STAFF` roles, and configurable permission management.

Mobile role types, management checks and store-only screen blocking are deferred; the API already rejects store-only members on warehouse, asset and maintenance routes. Browser checks with real Clerk development users are still pending.
