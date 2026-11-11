# Environment Pre-check Log (`feature/warehouse`) — 2026-11-11

- **Captured At:** `2026-11-11T19:49:17+07:00` → `2026-11-11T20:04:57+07:00`
- **Workspace:** `d:/Dai Hoc/Nam 4/Khoá Luận/nuoi-ong-clone/nuoi-ong`
- **Scope:** Kiểm tra hạ tầng thực tế trước khi chạy `UIUX-MOB-006` và `UIUX-MOB-009` (đã che toàn bộ token, mật khẩu, Clerk key và connection string).

## 1. Git & Working Tree

- **Current branch:** `feature/warehouse`
- **HEAD SHA:** `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` (`Merge remote-tracking branch 'origin/dev' into feature/warehouse`)
- **Remote `origin/dev`:** `fbdd89c0157eed704d1b3cc91f26ce10a1103426`
- **Working tree (`git status --short`):** `284` entries (bao gồm thay đổi chưa commit ở `mobile/src/`, `api/src/`, `web/features/`, `.gitignore`, `171` file đã stage xóa dưới `assets/product-images/`, và các file tài liệu/script untracked).

## 2. Database & Docker Containers

- `docker ps -a`:
  - `nuoi-ong-db-local`: `Up` (`0.0.0.0:5436->5432/tcp`)
  - `nuoi-ong_postgres`: `Exited`
- `api/.env` (sanitized):
  - `NODE_ENV=development`
  - `DATABASE_URL`: host `localhost`, port `5436`, database `nuoi_ong_local` (credentials redacted)
  - `WEB_ORIGIN=http://localhost:3000`
  - Clerk keys: `[REDACTED]`
- `web/.env.local` (sanitized):
  - `NEXT_PUBLIC_API_URL=http://localhost:5050`
  - Clerk keys: `[REDACTED]`

## 3. TCP Reachability Probes

| Target | Port | Result | Notes |
|---|---:|---|---|
| `127.0.0.1` | `5050` | `True` | Local API running |
| `192.168.2.14` | `5050` | `True` | LAN API reachable for Mobile |
| `172.31.98.42` | `5050` | `False` | Stale fallback IP in `mobile/.env` (`EXPO_PUBLIC_API_BASE_URL`) |
| `127.0.0.1` | `5436` | `True` | Local PostgreSQL container `nuoi-ong-db-local` |
| `127.0.0.1` | `55432` | `False` | Isolated QA DB `nuoi_ong_test_utf8` not present on this host |
| `127.0.0.1` | `3000` | `True` | Local Web running |
| `127.0.0.1` | `8081` | `True` (at 19:57) | Expo CLI `PID 35492` observed earlier from `mobile/` |
| `192.168.2.14` | `8081` | `False` (at 20:04:57) | LAN Metro endpoint not accepting connections at latest probe |

## 4. Mobile App & Android ADB Check

- `mobile/.env` (sanitized):
  - `EXPO_PUBLIC_API_PORT=5050`
  - `EXPO_PUBLIC_API_BASE_URL=http://172.31.98.42:5050/api/v1` (trong `__DEV__` LAN mode, `mobile/src/shared/api/client.ts` tự lấy `hostUri` từ Metro nên ưu tiên `http://192.168.2.14:5050/api/v1`).
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=[REDACTED]`
- `D:\DevTools\Android\Sdk\platform-tools\adb.exe devices -l` (at `2026-11-11T20:04:57+07:00`):
  - Output: `List of devices attached` (rỗng — `0` thiết bị).
- `D:\DevTools\Android\Sdk\emulator\emulator.exe -list-avds`:
  - Output: rỗng (`0` AVD được cấu hình; SDK có sẵn `system-images\android-33\google_apis_playstore\x86_64`).
- `.apk` / `.aab` files under `mobile/`: không có; chỉ có JS/Hermes bundle trong `mobile/.expo-export/metadata.json`.
