import type { ModuleDefinition } from '@/shared/types/module';

const statusLabel = {
  foundation: 'Đã dựng khung',
  'ready-for-api': 'Sẵn sàng nối API',
} as const;

export function ModuleOverview({ module }: { module: ModuleDefinition }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                V1 Core
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {statusLabel[module.status]}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{module.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {module.description}
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Sẽ được kích hoạt khi API tương ứng hoàn tất"
            className="min-h-11 shrink-0 cursor-not-allowed rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground opacity-55"
          >
            {module.primaryAction}
          </button>
        </div>
      </section>

      <section aria-labelledby="module-scope" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <h2 id="module-scope" className="text-base font-semibold">
          Phạm vi nghiệp vụ
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {module.capabilities.map((capability) => (
            <div key={capability} className="flex gap-3 rounded-xl border bg-background p-4">
              <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
              <p className="text-sm leading-6">{capability}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed bg-muted/40 p-8 text-center">
        <p className="font-medium">Chưa có dữ liệu hiển thị</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Route và ranh giới feature đã sẵn sàng để kết nối NestJS API.
        </p>
      </section>
    </div>
  );
}
