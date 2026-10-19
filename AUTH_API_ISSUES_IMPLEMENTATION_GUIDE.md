# Hướng dẫn triển khai Issue #13 và #16

Tài liệu này hướng dẫn triển khai hai nhiệm vụ đang được thực hiện trên nhánh `feature/auth-api-client`:

- Issue #13: Chuẩn hóa API prefix và auth/farm context.
- Issue #16: Hoàn thiện API client và Clerk token forwarding.

Mục tiêu nghiệp vụ cuối cùng là: người dùng đăng nhập bằng Clerk, backend xác định đúng user và các trại mà user đang tham gia, frontend chọn một trại hợp lệ, sau đó module vật tư và kho gọi API được bảo vệ mà không tự xử lý token hoặc hard-code `farmId`.

## 1. Flow nghiệp vụ cần đạt

```text
Người dùng đăng nhập Clerk
  → Next.js nhận Clerk session
  → GET /api/v1/auth/me kèm Bearer session token
  → NestJS xác minh token
  → Tạo hoặc lấy user local
  → Lấy farm membership và role đang hoạt động
  → Trả auth context cho web
  → Web chọn defaultFarmId hoặc farm đã lưu còn hợp lệ
  → Module vật tư/kho gọi API với token + selectedFarmId
```

Các nguyên tắc bắt buộc:

- Backend là nơi quyết định user có quyền truy cập farm hay không.
- Frontend ẩn action theo role chỉ để cải thiện UX, không thay thế authorization ở backend.
- Không nhận `farmId` tùy ý rồi tin tưởng ở frontend.
- Không lưu Clerk token trong `localStorage` hoặc cookie tự tạo.
- Không tạo migration DB mới cho hai issue này; schema hiện tại đã có đủ `users`, `farms`, `farm_members`, `roles` và `farm_member_roles`.

## 2. Trạng thái hiện tại

### Đã có

- `api/src/main.ts` đã dùng `app.setGlobalPrefix('api/v1')`.
- Các controller đang được chuyển về route không chứa `api/v1`.
- `ClerkAuthGuard` xác minh `session_token` và gắn `clerkUserId` vào request.
- `GET /api/v1/auth/me` tạo hoặc lấy user local.
- `web/shared/api/client.ts` đã có Axios và `apiRequest<T>()` trả trực tiếp `response.data`.
- `AuthBootstrap` đã lấy Clerk token cho request `/auth/me`.
- Lỗi `401` đã phát event để Client Component điều hướng về `/sign-in`.

### Còn thiếu

- `/auth/me` chưa trả farm membership và role.
- Chưa có `defaultFarmId` hoặc selected farm context.
- Mỗi feature vẫn có nguy cơ phải tự gọi `getToken()` và tự truyền `accessToken`.
- Chưa có UI/context chung để phân biệt loading, không có farm và `403`.
- Ba unit test auth đang bị xóa trong worktree và cần khôi phục/cập nhật.

## 3. Contract auth/farm context

### Quyết định contract

Giữ endpoint `GET /api/v1/auth/me` và mở rộng response để tương thích với flow hiện tại. Backend trả `defaultFarmId`, không lưu “farm đang chọn” vào DB. Frontend quản lý `selectedFarmId` và phải kiểm tra nó còn nằm trong membership hiện tại.

Tạo file `web/features/auth/types/auth-context.ts`:

```ts
export type FarmRoleCode =
  | 'ADMIN'
  | 'FARM_OWNER'
  | 'EMPLOYEE'
  | 'GUEST';

export type FarmMembership = {
  memberId: string;
  farm: {
    id: string;
    code: string;
    name: string;
  };
  roles: FarmRoleCode[];
};

export type AuthContextResponse = {
  user: {
    id: string;
    clerkUserId: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  memberships: FarmMembership[];
  defaultFarmId: string | null;
};
```

Quy tắc response:

- Chỉ trả user có trạng thái `ACTIVE`.
- Chỉ trả membership `ACTIVE` thuộc farm `ACTIVE`.
- Một membership có thể có nhiều role; role phải được gộp thành mảng không trùng.
- `defaultFarmId` là farm đầu tiên theo thứ tự ổn định, hoặc `null` nếu user chưa thuộc farm nào.
- Không trả Clerk secret, session token, database credential hoặc thông tin nội bộ không cần cho UI.

## 4. Backend: mở rộng `/auth/me`

### 4.1. File cần sửa

- `api/src/modules/auth/auth.service.ts`
- `api/src/modules/auth/auth.controller.ts`
- `api/src/modules/auth/auth.service.spec.ts`
- `api/src/modules/auth/auth.controller.spec.ts`

Không cần sửa schema hoặc tạo migration.

### 4.2. Thêm truy vấn membership

Trong `auth.service.ts`, import thêm:

```ts
import { ForbiddenException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import {
  farmMemberRoles,
  farmMembers,
  farms,
  roles,
  users,
} from '../../db/schema';
```

Giữ nguyên `getOrCreateUser()` và thêm method `getAuthContext()`:

```ts
async getAuthContext(clerkUserId: string) {
  const user = await this.getOrCreateUser(clerkUserId);

  if (user.status !== 'ACTIVE') {
    throw new ForbiddenException('User account is inactive');
  }

  const rows = await this.databaseService.db
    .select({
      memberId: farmMembers.id,
      farmId: farms.id,
      farmCode: farms.code,
      farmName: farms.name,
      roleCode: roles.code,
    })
    .from(farmMembers)
    .innerJoin(farms, eq(farms.id, farmMembers.farmId))
    .leftJoin(
      farmMemberRoles,
      eq(farmMemberRoles.farmMemberId, farmMembers.id),
    )
    .leftJoin(roles, eq(roles.id, farmMemberRoles.roleId))
    .where(
      and(
        eq(farmMembers.userId, user.id),
        eq(farmMembers.status, 'ACTIVE'),
        eq(farms.status, 'ACTIVE'),
      ),
    )
    .orderBy(asc(farms.name), asc(farms.id));

  const membershipMap = new Map<
    string,
    {
      memberId: string;
      farm: { id: string; code: string; name: string };
      roles: string[];
    }
  >();

  for (const row of rows) {
    const membership = membershipMap.get(row.memberId) ?? {
      memberId: row.memberId,
      farm: {
        id: row.farmId,
        code: row.farmCode,
        name: row.farmName,
      },
      roles: [],
    };

    if (row.roleCode && !membership.roles.includes(row.roleCode)) {
      membership.roles.push(row.roleCode);
    }

    membershipMap.set(row.memberId, membership);
  }

  const memberships = [...membershipMap.values()];

  return {
    user: {
      id: user.id,
      clerkUserId: user.authProviderUserId,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    },
    memberships,
    defaultFarmId: memberships[0]?.farm.id ?? null,
  };
}
```

Khi code thật, nên tạo type backend cho response thay vì để TypeScript suy ra toàn bộ. `roles` nên được giới hạn thành các role code mà hệ thống hỗ trợ.

### 4.3. Cập nhật controller

Trong `auth.controller.ts`, thay phần tự map user bằng:

```ts
@Get('me')
getMe(@CurrentAuth() auth: { clerkUserId: string }) {
  return this.authService.getAuthContext(auth.clerkUserId);
}
```

Không thêm `api/v1` vào `@Controller('auth')`; global prefix đã xử lý phần đó.

### 4.4. Trường hợp nghiệp vụ cần xử lý

- Clerk user mới: tạo user local, trả `memberships: []`, `defaultFarmId: null`.
- User local đã tồn tại: không gọi Clerk API lại.
- User local inactive: trả `403`; không tự kích hoạt lại user.
- User không có primary email: giữ lỗi hiện tại, không tạo bản ghi thiếu email.
- Membership hoặc farm inactive: không xuất hiện trong context.
- Một membership có nhiều role: chỉ tạo một membership và gộp role.
- User không có farm không phải lỗi `403` ở `/auth/me`; web phải hiển thị trạng thái “chưa được cấp quyền vào trại”.

## 5. Frontend: API request tự lấy Clerk token

### 5.1. Vấn đề cần giải quyết

`apiRequest<T>()` hiện nhận `accessToken`, nhưng nếu mỗi module tự gọi `getToken()` thì issue #16 chưa đạt mục tiêu. Tạo một hook dùng chung để feature chỉ cung cấp path, method, params và body.

### 5.2. Tạo hook authenticated request

Tạo `web/features/auth/hooks/use-authenticated-api.ts`:

```ts
'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

import {
  API_UNAUTHORIZED_EVENT,
  ApiError,
  apiRequest,
  type ApiRequestOptions,
} from '@/shared/api/client';

type AuthenticatedRequestOptions = Omit<ApiRequestOptions, 'accessToken'>;

export function useAuthenticatedApi() {
  const { getToken } = useAuth();

  return useCallback(
    async <T,>(
      path: string,
      options: AuthenticatedRequestOptions = {},
    ): Promise<T> => {
      const accessToken = await getToken();

      if (!accessToken) {
        window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT));
        throw new ApiError('Authentication is required', 401);
      }

      return apiRequest<T>(path, {
        ...options,
        accessToken,
      });
    },
    [getToken],
  );
}
```

Export hook qua `web/features/auth/index.ts`.

Quy tắc sử dụng:

- Protected browser request: dùng `useAuthenticatedApi()`.
- Public browser request như health check: có thể dùng `apiRequest<T>()` trực tiếp.
- Server Component/Server Action: không dùng hook này; dùng một server-only wrapper riêng khi thật sự cần.

## 6. Frontend: tạo application auth/farm context

### 6.1. File cần tạo hoặc sửa

- Tạo `web/features/auth/context/auth-context.tsx`.
- Tạo `web/features/auth/types/auth-context.ts`.
- Sửa `web/features/auth/index.ts` để export public API của feature.
- Sửa `web/shared/components/layout/app-shell.tsx` để bọc dashboard bằng provider.
- Xóa hoặc chuyển trách nhiệm của `auth-bootstrap.tsx`; không được để cả bootstrap và provider cùng gọi `/auth/me`.

### 6.2. Trách nhiệm của provider

`AuthContextProvider` phải:

1. Gọi `/auth/me` đúng một lần sau khi Clerk đã load và user đã sign in.
2. Lưu `AuthContextResponse`, loading và error state.
3. Chọn farm đã lưu nếu farm đó vẫn thuộc membership hiện tại.
4. Nếu farm đã lưu không còn hợp lệ, dùng `defaultFarmId`.
5. Lưu lựa chọn bằng key gắn với local user ID, ví dụ `nuoi-ong:selected-farm:<userId>`.
6. Nghe event `API_UNAUTHORIZED_EVENT` và dùng `router.replace('/sign-in')`.
7. Không redirect khi gặp `403`; hiển thị trạng thái không có quyền.

Khung implementation:

```tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

import { API_UNAUTHORIZED_EVENT, ApiError } from '@/shared/api/client';
import { useAuthenticatedApi } from '../hooks/use-authenticated-api';
import type { AuthContextResponse } from '../types/auth-context';

type AuthContextValue = {
  data: AuthContextResponse;
  selectedFarmId: string | null;
  selectFarm: (farmId: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const request = useAuthenticatedApi();
  const router = useRouter();
  const [data, setData] = useState<AuthContextResponse | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const onUnauthorized = () => router.replace('/sign-in');
    window.addEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    void request<AuthContextResponse>('/auth/me')
      .then((response) => {
        const storageKey = `nuoi-ong:selected-farm:${response.user.id}`;
        const savedFarmId = window.localStorage.getItem(storageKey);
        const savedFarmIsValid = response.memberships.some(
          ({ farm }) => farm.id === savedFarmId,
        );

        setData(response);
        setSelectedFarmId(
          savedFarmIsValid ? savedFarmId : response.defaultFarmId,
        );
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof ApiError
            ? cause
            : new ApiError('Unable to load auth context', 0, cause),
        );
      });
  }, [isLoaded, isSignedIn, request]);

  const value = useMemo(() => {
    if (!data) return null;

    return {
      data,
      selectedFarmId,
      selectFarm(farmId: string) {
        const isAllowed = data.memberships.some(
          ({ farm }) => farm.id === farmId,
        );
        if (!isAllowed) throw new Error('Farm is not available to this user');

        window.localStorage.setItem(
          `nuoi-ong:selected-farm:${data.user.id}`,
          farmId,
        );
        setSelectedFarmId(farmId);
      },
    };
  }, [data, selectedFarmId]);

  if (!isLoaded || (isSignedIn && !data && !error)) return <p>Đang tải...</p>;
  if (!isSignedIn) return null;
  if (error?.status === 403) return <p>Bạn không có quyền truy cập.</p>;
  if (error) return <p>Không thể tải thông tin người dùng.</p>;
  if (!value) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used inside AuthContextProvider');
  }
  return context;
}
```

Đây là khung triển khai. Khi code thật, tách loading/no-farm/forbidden thành component có nội dung và action phù hợp thay vì chỉ dùng `<p>`.

### 6.3. Gắn provider vào dashboard

Trong `app-shell.tsx`, bọc nội dung dashboard:

```tsx
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthContextProvider>
      {/* sidebar, header và main hiện có */}
      {children}
    </AuthContextProvider>
  );
}
```

Không để `AuthBootstrap` gọi `/auth/me` thêm lần nữa. Có thể xóa component đó hoặc đổi nó thành component trình bày không thực hiện request.

## 7. Cách module vật tư và kho sử dụng

Feature không gọi `useAuth().getToken()` và không hard-code farm ID.

### GET

```tsx
const request = useAuthenticatedApi();
const { selectedFarmId } = useAuthContext();

const response = await request<MaterialsResponse>('/materials', {
  method: 'GET',
  params: {
    farmId: selectedFarmId,
    page: 1,
    pageSize: 20,
    search,
  },
});
```

### POST

```tsx
await request<MaterialResponse>('/materials', {
  method: 'POST',
  params: { farmId: selectedFarmId },
  data: formValues,
});
```

### PATCH

```tsx
await request<WarehouseResponse>(`/warehouses/${warehouseId}`, {
  method: 'PATCH',
  params: { farmId: selectedFarmId },
  data: formValues,
});
```

Trước khi gọi API nghiệp vụ, nếu `selectedFarmId === null`, hiển thị trạng thái chưa có trại và không gửi request.

## 8. Xử lý lỗi theo nghiệp vụ

| Trạng thái | Ý nghĩa | Hành vi frontend |
| --- | --- | --- |
| `400` | Input hoặc `farmId` không hợp lệ | Hiển thị validation gần form/filter. |
| `401` | Thiếu hoặc hết hạn Clerk token | Phát unauthorized event và `router.replace('/sign-in')`. |
| `403` | User không thuộc farm hoặc không đủ role | Giữ session, hiển thị “không có quyền”; không logout. |
| `404` | Không tìm thấy tài nguyên trong farm | Hiển thị not-found của module. |
| `409` | Xung đột nghiệp vụ, ví dụ code trùng | Hiển thị message cụ thể từ API. |
| `0` | Không kết nối được API | Hiển thị retry; không coi là lỗi đăng nhập. |

Không log Clerk token, authorization header hoặc response chứa dữ liệu nhạy cảm.

## 9. Kiểm thử backend

Khôi phục và cập nhật ba file test auth đang bị xóa:

- `api/src/modules/auth/auth.controller.spec.ts`
- `api/src/modules/auth/auth.service.spec.ts`
- `api/src/modules/auth/clerk-auth.guard.spec.ts`

Test tối thiểu cho `AuthService`:

1. User đã tồn tại thì không gọi Clerk.
2. User chưa tồn tại được upsert đúng một lần.
3. User inactive bị từ chối bằng `403`.
4. Context chỉ trả membership/farm active.
5. Nhiều role của cùng membership được gộp, không nhân đôi farm.
6. User không có farm trả mảng rỗng và `defaultFarmId: null`.
7. Thứ tự membership/default farm ổn định.

Test tối thiểu cho controller:

- Truyền đúng `clerkUserId` vào `getAuthContext()`.
- Trả nguyên contract an toàn, không thêm token hoặc secret.

Test guard phải tiếp tục bao phủ:

- Public route bỏ qua Clerk verification.
- Session token hợp lệ được gắn vào request.
- Token sai/thiếu trả `401`.
- Thiếu `CLERK_AUTHORIZED_PARTIES` trả lỗi cấu hình an toàn.

## 10. Kiểm thử frontend và thủ công

### Automated checks

```bash
pnpm --dir api lint
pnpm --dir api test
pnpm --dir api build
pnpm --dir web lint
pnpm --dir web exec tsc --noEmit
pnpm --dir web build
```

Nếu `next/font` không tải được Google Fonts trong môi trường giới hạn mạng, ghi rõ đây là lỗi môi trường và chạy lại build ở máy có mạng hoặc CI. Không bỏ qua lint/type-check.

### Manual flow

1. Chạy PostgreSQL và migrate/seed database local.
2. Đăng nhập Clerk bằng user development.
3. Kiểm tra Network tab: `/api/v1/auth/me` có Bearer token.
4. Kiểm tra response có user, memberships, roles và default farm hợp lệ.
5. Chọn farm khác, reload và xác nhận lựa chọn được giữ nếu vẫn hợp lệ.
6. Sửa local membership thành inactive, reload và xác nhận farm đó bị loại.
7. Gọi materials/warehouses với farm không thuộc user và xác nhận `403`.
8. Làm token hết hạn hoặc đăng xuất và xác nhận chuyển về `/sign-in`.

### Chuẩn bị Clerk user local

Seed hiện dùng provider ID giả như `seed_farm_owner`. Để test user Clerk thật với membership seed, có thể đổi provider ID của user seed trong database local trước lần đăng nhập:

```sql
UPDATE users
SET auth_provider = 'CLERK',
    auth_provider_user_id = '<Clerk user ID>'
WHERE email = 'owner@nuoi-ong.local';
```

Chỉ chạy trên database local. Không đưa Clerk user ID thật vào migration, seed đã commit hoặc production data.

## 11. Thứ tự triển khai và commit đề xuất

### Phase 1 — API route

- Giữ `app.setGlobalPrefix('api/v1')`.
- Bỏ prefix cứng khỏi tất cả controller.
- Kiểm tra không có `/api/v1/api/v1`.

Commit đề xuất:

```text
refactor(api): centralize API version prefix
```

### Phase 2 — Auth context backend

- Mở rộng `/auth/me`.
- Thêm membership/role aggregation.
- Khôi phục và cập nhật auth tests.

Commit đề xuất:

```text
feat(auth): expose user and farm context
```

### Phase 3 — Authenticated frontend API

- Hoàn thiện Axios wrapper.
- Tạo `useAuthenticatedApi()`.
- Chuẩn hóa `401` và giữ `403` là expected error.

Commit đề xuất:

```text
feat(web): add authenticated API request flow
```

### Phase 4 — Farm context frontend

- Tạo contract và provider.
- Chọn/validate farm.
- Gắn provider vào dashboard.
- Thêm hướng dẫn GET/POST/PATCH.

Commit đề xuất:

```text
feat(web): provide authenticated farm context
```

## 12. Definition of Done theo issue

### Issue #13

- [ ] `/api/v1` chỉ xuất hiện một lần trong URL.
- [ ] `/auth/me` trả user, active memberships, role và default farm.
- [ ] Frontend có selected farm hợp lệ, không hard-code ID.
- [ ] Có TypeScript contract dùng chung.
- [ ] Ba test auth được khôi phục/cập nhật.
- [ ] API lint, test và build pass.

### Issue #16

- [ ] `apiRequest<T>()` trả đúng body type.
- [ ] Feature protected không tự gọi `getToken()`.
- [ ] Mọi protected request có Clerk Bearer token.
- [ ] `401` chuyển về sign-in.
- [ ] `403` hiển thị không có quyền và không logout.
- [ ] Có ví dụ GET/POST/PATCH cho vật tư và kho.
- [ ] Web lint, type-check và build pass.

## 13. Không làm trong hai issue này

- Không xây UI vật tư hoặc kho hoàn chỉnh; đó là issue của thành viên phụ trách module.
- Không thêm bảng DB hoặc sửa migration cũ.
- Không triển khai Clerk webhook update/delete trong PR này.
- Không đưa token vào global state, localStorage hoặc log.
- Không tạo Axios instance riêng cho từng feature.
- Không gộp thêm thay đổi `.docx` hoặc tài liệu cá nhân vào PR code.

Khi tất cả checkbox hoàn thành, cập nhật issue, mở một PR từ `feature/auth-api-client` vào `dev`, liên kết cả `#13` và `#16`, đồng thời ghi rõ test evidence và thay đổi API contract trong PR description.
