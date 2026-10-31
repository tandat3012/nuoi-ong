# Nuôi Ong Web

Next.js 16 / React 19 frontend for farm management and the public Mộc Ong storefront. Styling uses Tailwind CSS 4; authentication uses Clerk.

## Architecture

- `app/` owns routes, layouts, loading states, and error boundaries.
- `features/` owns business-capability UI and feature-specific code.
- `shared/` owns generic API transport, layout components, configuration, and cross-feature types.
- `public/` contains static assets; `proxy.ts` applies Clerk protection to management routes.

`app/(dashboard)/layout.tsx` wraps management pages with `AuthContextProvider` and `AppShell`. Business requests use `useAuthenticatedRequest()` → `shared/api/client.ts` (Axios), with a Clerk token and the selected `farmId` where required. `app/(store)/layout.tsx` owns the store header/footer, `CartProvider`, and cart drawer. Store product/category reads use native `fetch` against the public API.

Feature folders follow business capabilities rather than database tables. See [`features/README.md`](features/README.md) for the local convention.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Configure Clerk keys in `.env.local` using `.env.example`. The API defaults to `http://localhost:5050`; set `NEXT_PUBLIC_API_URL` for other environments. Server-side storefront reads prefer `API_INTERNAL_URL` when set, then use `NEXT_PUBLIC_API_URL` or the default. API paths append `/api/v1`. Bank-transfer details and the order VietQR come from the API (`STORE_BANK_*` in `api/.env`).

## Routes

Route groups in parentheses organize layouts and do not appear in URLs.

| Group | Current routes |
| --- | --- |
| `(auth)` | `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]`, `/auth/continue`, `/account/change-password` |
| `(dashboard)` stock | `/dashboard`, `/inventory`, `/receipts`, `/issues`, `/issues/[id]`, `/transfers`, `/counts` |
| `(dashboard)` assets | `/assets`, `/assets/[id]`, `/maintenance`, `/requests`, `/scan`, `/scan/[assetCode]`, `/scan/item/[itemId]`, `/scan/inventory/[balanceId]` |
| `(dashboard)` setup | `/materials`, `/warehouses`, `/catalog`, `/personnel`, `/personnel/[memberId]`, `/history` |
| `(dashboard)` store | `/store-products`, `/store-products/[id]`, `/store-orders`, `/store-orders/[id]`, `/store-orders/customers/[userId]`, `/store-reports` |
| `(store)` | `/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/orders`, `/orders/[id]` |

Navigation visibility is declared in `shared/config/navigation.ts`: `adminOnly` (ADMIN/FARM_OWNER), `staffOnly`, and `storeOnly` (shown only when the selected farm owns the store's sales warehouse).

## Stock documents and requests

Receipts, issues, transfers and counts follow the API approval flow (see `api/README.md`): employees create, edit and submit their own drafts; ADMIN/FARM_OWNER confirm drafts directly or confirm/reject pending documents with a reason. Lists show PENDING_APPROVAL and REJECTED labels and can filter pending documents. On transfers and counts only one document action runs at a time, including line edits. Receipt LOT lines can pick an existing lot.

`/requests` lists maintenance and asset transfer requests: approvers review all of them, employees see their own and the outcome. `/history` shows audit logs with server pagination in the API's permission scope. The notification bell reloads when the tab regains focus and after actions, and links to the target screen.

`/scan` reads asset, item and inventory QR labels with the camera or by code; label URLs follow the API QR convention, so a phone camera opens the same page. Item labels print from the material detail.

See [feature ownership](features/README.md), [commerce implementation](features/commerce/README.md), and [store routes](<app/(store)/README.md>).

## Authentication redirects

Sign-in and sign-up force a redirect through the protected `/auth/continue` page, which calls `/auth/me`. Any farm role (including `GUEST`) counts as staff: staff return to the requested back-office page or `/dashboard`; customers return to the requested store page or `/`. Store sign-in buttons preserve the current URL. Only same-origin destinations are accepted, and authentication pages are excluded to prevent loops. Signing out returns to `/`. Staff with an initial password still pass through the existing password-change gate. Accounts without farm access can use “Về cửa hàng” in the dashboard access message.

Validate with real Clerk sessions for customer sign-in/sign-up from a product page, staff sign-in from the cart, protected QR links for both roles, initial-password changes, Google OAuth, multi-step authentication, and sign-out. Unit tests cover destination safety and role-based routing; they do not verify Clerk session behavior.

## Checks

```bash
pnpm lint
pnpm test
pnpm build
```

## Personnel

`features/personnel/` follows the existing feature API/types/components pattern. `/personnel` provides search, role/status/workplace filters and pagination; the detail route provides work profile editing, role replacement, warehouse assignments, membership status, assets held and audit history. The navigation entry appears only for managers in the selected farm. Employee operational write permissions remain unchanged.

The create dialog distinguishes new accounts from existing account holders. New accounts receive an initial password handed over privately by the owner. The form pins a requestId and non-password payload for retry, keeps credentials only in memory, and never renders raw transport errors. An uncertain request keeps its password fixed; a rejected credential may be corrected before retry. Closing the dialog clears the password; retain the displayed requestId for operator assistance if completion is uncertain.

Farm changes remount the personnel view, close dialogs and ignore old responses. Auth context exposes `refresh()`, refreshes on tab focus and permission errors, and redirects flagged accounts to `/account/change-password`. That page is protected by Clerk but lives outside the dashboard/no-farm gate. A successful password change signs the employee out and requires sign-in with the new password.

Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm exec eslint features/personnel features/auth` and `pnpm build`. Browser acceptance must cover desktop/mobile, keyboard dialog use, farm switches while a creation request is pending, retries with the same requestId, and the first-password page with no farm. Mocked UI/API checks do not verify real Clerk configuration or sessions.
