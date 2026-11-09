import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { STOREFRONT_CONFIG } from '@/features/commerce/storefront/config/storefront-config';
import { ContactPreviewForm } from '@/features/commerce/storefront/components/contact-preview-form';

export const metadata: Metadata = {
  title: 'Liên hệ & tư vấn nuôi ong',
  description: 'Kết nối với Mộc Ong để được tư vấn vật tư, thiết bị và kỹ thuật nuôi ong.',
};

export default function ContactPage() {
  const { contact } = STOREFRONT_CONFIG.footer;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <nav aria-label="Đường dẫn" className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Trang chủ</Link> <span aria-hidden="true">/</span> Liên hệ
      </nav>
      <h1 className="font-serif text-3xl font-bold text-foreground sm:text-5xl">Mộc Ong luôn lắng nghe.</h1>
      <p className="mt-4 text-lg text-muted-foreground">Một câu hỏi nhỏ, một mùa mật tốt hơn. Kết nối với đội ngũ kỹ thuật của chúng tôi.</p>
      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <section className="flex flex-col justify-between space-y-6 rounded-2xl border border-border bg-card p-6 shadow-2xs">
          <div className="space-y-5">
            <h2 className="font-serif text-2xl font-bold">Kết nối với nhà ong</h2>
            <p className="flex items-start gap-3">
              <Phone className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Hotline tư vấn & bảo hành: <strong className="text-foreground">{contact.hotline}</strong>
              </span>
            </p>
            <p className="flex items-start gap-3">
              <Mail className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>{contact.email}</span>
            </p>
            <p className="flex items-start gap-3">
              <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>{contact.address}</span>
            </p>
            <p className="flex items-start gap-3">
              <Clock className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>{contact.workingHours}</span>
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              <span>Tra cứu đơn hàng & Tiến độ bảo hành</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nếu bạn cần kiểm tra lộ trình vận chuyển hoặc thời hạn bảo hành theo mã Serial thiết bị, hãy sử dụng trang tra cứu trực tuyến.
            </p>
            <Link
              href="/track-order"
              className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>Đi tới trang Tra cứu đơn & Bảo hành</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>
        <ContactPreviewForm />
      </div>
    </main>
  );
}
