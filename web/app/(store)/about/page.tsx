import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Về Mộc Ong — Câu chuyện từ trang trại',
  description: 'Câu chuyện Mộc Ong: từ tình yêu với đàn ong đến sự đồng hành cùng người nuôi ong Việt.',
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <nav aria-label="Đường dẫn" className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Trang chủ</Link> <span aria-hidden="true">/</span> Về Mộc Ong
      </nav>
      <h1 className="font-serif text-3xl font-bold text-foreground sm:text-5xl">Từ tâm, từ thiên nhiên.</h1>
      <p className="mt-4 text-lg text-muted-foreground">Một câu chuyện bắt đầu từ những đàn ong nhỏ và tình yêu với đất Việt.</p>
      <div className="relative mt-9 aspect-[15/8] overflow-hidden rounded-2xl">
        <Image src="/assets/bee-farm-hero.jpg" alt="Trang trại ong Mộc Ong giữa thiên nhiên" fill sizes="(max-width: 1024px) 100vw, 960px" className="object-cover" />
      </div>
      <div className="mx-auto mt-10 max-w-3xl space-y-5 text-base leading-8 text-foreground/85">
        <h2 className="font-serif text-2xl font-bold text-foreground">Gieo tin tưởng, gặt ngọt lành.</h2>
        <p>Mộc Ong được hình thành từ một niềm tin giản dị: người nuôi ong xứng đáng có những sản phẩm tốt và một người bạn đồng hành đáng tin cậy.</p>
        <p>Từ những thùng ong gỗ đến thiết bị thu hoạch, chúng tôi lựa chọn từng sản phẩm bằng sự cẩn trọng và hiểu biết thực tế. Mỗi giọt mật là công sức của đàn ong, thiên nhiên và người chăm sóc.</p>
        <h3 className="font-serif text-xl font-bold text-foreground">Đồng hành trong từng mùa mật</h3>
        <p>Chúng tôi không chỉ cung cấp vật tư. Mộc Ong lắng nghe, chia sẻ kinh nghiệm và cùng nhà ong tìm giải pháp phù hợp — để đàn ong khỏe hơn, mùa mật ngọt hơn.</p>
      </div>
    </main>
  );
}
