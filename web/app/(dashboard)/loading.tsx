export default function DashboardLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Đang tải nội dung">
      <div className="h-24 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
      <span className="sr-only">Đang tải...</span>
    </div>
  );
}
