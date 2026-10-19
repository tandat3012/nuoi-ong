# Stock Issue acceptance (Task 8)

Date: 2026-10-05  
Branch: `feature/27-stock-issue-acceptance`  
Issue scope: #27, related to #25. No issue was closed and no PR was opened.

## What was accepted

- `stock-issue-acceptance.e2e-spec.ts` starts the real `AppModule`, global `ClerkAuthGuard`, `WarehousesService`, and PostgreSQL. Only the external Clerk `authenticateRequest` call is replaced with fixed test identities. Existing `ADMIN`, `FARM_OWNER`, and `GUEST` role rows are read and reused; tests create unique farms/users/memberships and remove those fixtures on teardown.
- The real Issues page and `AuthContextProvider` run in Brave. The real Axios client calls a local Nest HTTP server backed by the same PostgreSQL fixture. The Clerk frontend hook and server-side Clerk verifier are test-boundary shims; no hosted Clerk login or personal browser session is used.
- The QUANTITY flow creates a quantity-2 draft, edits it to 3, confirms it, and verifies balance `10.000 → 10.000 → 10.000 → 7.000` plus one ledger transaction. A second draft is cancelled and leaves the balance at 7.
- API permissions cover FARM_OWNER and ADMIN writes, GUEST reads with all writes denied, inactive user, inactive membership, no membership, invalid/missing tokens, and an issue ID requested through the wrong farm. Denied requests leave issue state, balance, and ledger unchanged.
- Browser checks cover keyboard activation, loading feedback, refreshed list/detail navigation, read-only controls, farm switching, and dropping a delayed response from the prior farm. The existing Stock Issue suite remains responsible for LOT/ASSET, DAMAGE/DISPOSAL, concurrency, insufficient inventory, rollback, and Stock Receipt regressions.

## Validation

| Command/check | Result |
| --- | --- |
| `pnpm exec jest --config test/jest-e2e.json --runInBand stock-issue-acceptance stock-issues.integration stock-receipts.integration` (api) | PASS, 90/90 tests across 3 suites; final acceptance-only rerun PASS, 5/5 |
| Nested full IssuesPage → Nest API → PostgreSQL browser run | PASS, 18/18 checks |
| Existing `/tmp/issue-draft-task3-harness/verify.mjs` browser regression | PASS, 87/87 checks |
| `node features/issues/components/issue-draft.logic.test.mjs` (web) | PASS, 10/10 |
| `node features/issues/api/issues.api.test.mjs` (web) | PASS, 16/16 |
| `pnpm lint` and `pnpm exec tsc --noEmit` (web) | PASS |
| `pnpm exec next build --webpack` (web) | PASS; `/issues` included |
| `pnpm build` (api) | PASS |
| `pnpm exec eslint test/stock-issue-acceptance.e2e-spec.ts` and `node --check test/stock-issue-acceptance.browser.mjs` (api) | PASS |
| `pnpm exec tsc --noEmit` (api) | FAILS on 4 existing unrelated errors: `auth/farm-access.guard.spec.ts:119` missing `farmId`; `materials.service.spec.ts:99,129,186` recursive `tx` annotations (TS2502). No acceptance-test type errors remain. |

The UI screenshot is [stock-issue-acceptance.png](artifacts/stock-issue-acceptance.png). The full Jest/browser output was captured in the task run; no separate persistent log file was created. The commands above reproduce the checks.

## Limits

Hosted Clerk sign-in/token verification was not exercised. The production Clerk guard, farm membership queries, issue service, and database were exercised with an injected test verifier. API `tsc --noEmit` still has the four baseline spec errors listed above. The plan document under `docs/` remains ignored by the pre-existing `.gitignore` rule; it was updated locally without changing that rule. Attach the screenshot when a PR is opened.
