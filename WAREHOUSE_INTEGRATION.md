# Warehouse integration and local rollout

This integration combines `feature/warehouse-module`, the saved storefront workspace, and the current `dev`/`main` history. It preserves the existing receipt/issue/inventory pages, adds navigation to count/transfer pages, and connects warehouse detail URLs to the detail screen.

## Database

- Apply the existing migrations through `0012`, followed by `0013_maintenance-issue-draft-validation`.
- `0013` permits maintenance drafts against closed records while retaining same-farm validation and restricting confirmation to active maintenance records. The API reports conflicts before stock changes, and the trigger remains a database safeguard.
- Registered migration files `0000`–`0012` are unchanged. The obsolete, unregistered `0006_maintenance_issue_trigger.sql` duplicate is removed; the registered trigger migration is `0008`.
- Migration `0011` changes minimum stock levels only for active materials with an existing value of zero and a recognized unit symbol.
- Application schema definitions now include approval/rejection fields, enum values, and the notifications table. This release does not introduce approval actions or notification delivery.

## Configuration

- `NEXT_PUBLIC_API_URL` is the browser API origin and must be set when building for a non-local backend. Existing `API_URL` configuration remains supported as a build-time fallback.
- Server storefront requests use `API_INTERNAL_URL`, then `API_URL`, then the public origin. Docker Compose supplies `http://api:5050` as the internal origin.
- API paths passed to the shared client omit `/api/v1`, which the client already supplies.

## Backup and rollout

1. Keep the private `.local-backups/warehouse-integration-*` directory. It contains the source archive (including local environment files), Git bundles, the workspace snapshot commit, database dump, hashes, and validation evidence. It is excluded from Git and Docker contexts.
2. Verify the dump with `pg_restore --list <backup>/nuoi_ong.dump`. Restore into a separate database and test migrations there before modifying the working database.
3. With `api/.env` pointing to the intended local Docker database, run `pnpm --dir api db:migrate`. Verify the migration journal contains fourteen entries (`0000`–`0013`). Do not reset or reseed the database.
4. Merge the reviewed integration PR into `dev`, verify the local application, then merge the `dev` to `main` release PR.
5. Synchronize the storefront and warehouse branches by fast-forward only after the release; retain the workspace backup and stash.

For recovery, stop application writers, restore the dump into a **new** database using `createdb` and `pg_restore --no-owner --dbname <new-db> <backup>/nuoi_ong.dump`, verify it, then point the application to the restored database and previous code revision. Do not restore over a database containing newer writes without reconciling them first.

## Validation

- API build, TypeScript, lint, and 83 unit tests.
- 207 API integration tests: HTTP/DTO/PostgreSQL paths, schema/enum agreement, inventory QR, receipt/issue behavior, maintenance draft and confirmation rules, count/transfer rollback, stale snapshots, exact decimal differences, and concurrent confirmation of the same document.
- Web build, TypeScript, lint, and five test files, including browser API URL precedence, legacy configuration, and Clerk protection of warehouse routes.
- Fresh-database migration and upgrade from a restored `0007` database through `0013`; repeat migration does not add journal entries.
- Chromium UI checks exercise the actual count/transfer components with fixture authentication/API responses: create, confirm, refresh, farm switch, reader permissions, and desktop/mobile layouts. Images are in `web/test-artifacts/warehouse/`.
- New count/transfer forms support QUANTITY items only; LOT/ASSET selectors are deferred. Existing receipt/issue pages retain their tracking-mode support.
- Drizzle generation against an independent copy of the migration metadata reports no schema changes.

Live Clerk sign-in and any future Supabase deployment require their own environment verification. Tests use supplied identities or fixtures where authentication would otherwise require an interactive account.
