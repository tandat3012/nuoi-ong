'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="rounded-2xl border bg-card p-8 text-center shadow-sm">
      <p className="text-lg font-semibold">Không thể tải nội dung</p>
      <p className="mt-2 text-sm text-muted-foreground">Vui lòng thử lại hoặc quay lại sau.</p>
      <button
        type="button"
        onClick={retry}
        className="mt-5 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        Thử lại
      </button>
    </section>
  );
}
