import Link from 'next/link';

const summaryCards = [
  { label: 'Tổng item', value: '—', hint: 'Thiết bị, dụng cụ, vật tư' },
  { label: 'Phiếu chờ xử lý', value: '—', hint: 'Phiếu nhập và phiếu xuất' },
  { label: 'Tồn kho thấp', value: '—', hint: 'Theo mức tồn tối thiểu' },
  { label: 'Sắp đến hạn bảo trì', value: '—', hint: 'Trong chu kỳ cảnh báo' },
] as const;

const coreFlows = [
  {
    href: '/receipts',
    title: 'Nhập kho',
    description: 'DRAFT → xác nhận → cập nhật tồn, LOT hoặc asset.',
  },
  {
    href: '/issues',
    title: 'Xuất kho',
    description: 'Kiểm tra tồn khả dụng trước khi ghi nhận giao dịch giảm.',
  },
  {
    href: '/maintenance',
    title: 'Bảo trì',
    description: 'Lập lịch, thực hiện, ghi chi phí và trả asset về sử dụng.',
  },
] as const;

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      <section>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">V1 Core</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Tổng quan vận hành</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Điểm vào chung cho nghiệp vụ danh mục, kho, tài sản và bảo trì của trang trại.
        </p>
      </section>

      <section aria-label="Chỉ số tổng quan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Luồng nghiệp vụ cốt lõi</h2>
            <p className="mt-1 text-sm text-muted-foreground">Các use case ưu tiên kết nối API trong V1.</p>
          </div>
          <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            Chờ backend API
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {coreFlows.map((flow, index) => (
            <Link
              key={flow.href}
              href={flow.href}
              className="group rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-secondary/50"
            >
              <span className="text-xs font-bold text-primary">0{index + 1}</span>
              <h3 className="mt-3 font-semibold group-hover:text-primary">{flow.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{flow.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
