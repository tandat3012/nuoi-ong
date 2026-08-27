import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Không tìm thấy trang</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Đường dẫn không tồn tại hoặc module chưa được đưa vào phạm vi V1.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Về tổng quan
        </Link>
      </section>
    </main>
  );
}
