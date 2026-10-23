import type { ReactNode } from 'react';

export function StoreLoadError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground"
    >
      <p>{children}</p>
      <a
        href=""
        className="mt-2 inline-block font-medium text-foreground underline underline-offset-4"
      >
        Tải lại trang
      </a>
    </div>
  );
}
