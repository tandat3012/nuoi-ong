import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import { AuthBootstrap } from '@/features/auth/components/auth-bootstrap';

import { SidebarNavigation } from './sidebar-navigation';

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AuthBootstrap />
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Đi tới nội dung chính
      </a>

      <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
        <aside className="border-b bg-card px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="mb-4 flex items-center justify-between lg:mb-8 lg:block">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-xl bg-primary text-lg text-primary-foreground shadow-sm"
              >
                ◈
              </div>
              <div>
                <p className="font-semibold tracking-tight">Nuôi Ong</p>
                <p className="text-xs text-muted-foreground">Quản lý nguồn lực V1</p>
              </div>
            </div>
            <div className="flex items-center lg:hidden">
              <Show when="signed-out">
                <SignInButton>
                  <button className="min-h-11 rounded-xl border bg-card px-3 text-sm font-semibold">
                    Đăng nhập
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </div>

          <SidebarNavigation />

          <div className="mt-8 hidden rounded-xl border bg-muted/60 p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Phạm vi hiện tại
            </p>
            <p className="mt-2 text-sm leading-6 text-secondary-foreground">
              Danh mục, kho, phiếu nhập/xuất, tài sản và bảo trì.
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="hidden h-20 items-center justify-between border-b bg-card/90 px-6 lg:flex xl:px-10">
            <div>
              <p className="text-sm font-medium">Hệ thống quản lý nội bộ</p>
              <p className="text-xs text-muted-foreground">CNTT-KLCN289 · Phiên bản V1</p>
            </div>
            <div className="flex items-center gap-3">
              <Show when="signed-out">
                <SignInButton>
                  <button className="min-h-11 rounded-xl border bg-card px-4 text-sm font-semibold transition-colors hover:bg-muted">
                    Đăng nhập
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>

          <main id="main-content" className="mx-auto w-full max-w-[96rem] p-4 sm:p-6 xl:p-10">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
