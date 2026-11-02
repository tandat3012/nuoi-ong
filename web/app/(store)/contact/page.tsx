import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
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
      <p className="mt-4 text-lg text-muted-foreground">Một câu hỏi nhỏ, một mùa mật tốt hơn. Kết nối với chúng tôi.</p>
      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-2xl font-bold">Kết nối với nhà ong</h2>
          <p className="flex items-start gap-3"><Phone className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />{contact.hotline}</p>
          <p className="flex items-start gap-3"><Mail className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />{contact.email}</p>
          <p className="flex items-start gap-3"><MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />{contact.address}</p>
          {contact.isFixture && <p className="text-sm text-muted-foreground">Thông tin liên hệ đang được cập nhật.</p>}
        </section>
        <ContactPreviewForm />
      </div>
    </main>
  );
}
