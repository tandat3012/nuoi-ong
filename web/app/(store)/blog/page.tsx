import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Kinh nghiệm nuôi ong',
  description: 'Chia sẻ kiến thức chăm sóc đàn ong, chọn thùng nuôi và bảo quản mật ong từ Mộc Ong.',
};

export default function BlogPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <nav aria-label="Đường dẫn" className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Trang chủ</Link> <span aria-hidden="true">/</span> Kinh nghiệm nuôi ong
      </nav>
      <h1 className="font-serif text-3xl font-bold text-foreground sm:text-5xl">Cùng nhau nuôi ong tốt hơn</h1>
      <div className="relative mt-9 aspect-[15/8] overflow-hidden rounded-2xl">
        <Image src="/assets/bee-farm-hero.jpg" alt="Người nuôi ong kiểm tra cầu ong" fill sizes="(max-width: 1024px) 100vw, 960px" className="object-cover" />
      </div>
      <div className="mx-auto mt-10 max-w-3xl space-y-10 text-base leading-8 text-foreground/85">
        <article id="chuan-bi-truoc-mua-mat-moi" className="scroll-mt-8 space-y-4">
          <h2 className="font-serif text-2xl font-bold text-foreground">5 điều cần chuẩn bị trước mùa mật mới</h2>
          <p>Kiểm tra đàn ong định kỳ, theo dõi nguồn hoa và chuẩn bị dụng cụ sạch sẽ giúp mùa thu hoạch diễn ra thuận lợi.</p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>Kiểm tra tình trạng đàn và ong chúa.</li>
            <li>Vệ sinh, sửa chữa thùng ong và cầu ong.</li>
            <li>Theo dõi nguồn hoa tại địa phương.</li>
            <li>Chuẩn bị máy quay mật và đồ bảo hộ.</li>
            <li>Ghi chép hoạt động của đàn ong mỗi tuần.</li>
          </ol>
        </article>
        <article id="chon-thung-ong-phu-hop" className="scroll-mt-8 space-y-4 border-t border-border pt-8">
          <h2 className="font-serif text-2xl font-bold text-foreground">Cách chọn thùng ong phù hợp</h2>
          <p>Ưu tiên gỗ khô, kết cấu chắc chắn, nắp kín và thông thoáng. Chọn kích thước thùng phù hợp với sức đàn, khí hậu và phương pháp nuôi.</p>
        </article>
        <article id="mat-ong-nguyen-chat-nhan-biet-va-bao-quan" className="scroll-mt-8 space-y-4 border-t border-border pt-8">
          <h2 className="font-serif text-2xl font-bold text-foreground">Bảo quản mật ong nguyên chất</h2>
          <p>Đựng mật trong lọ sạch, kín. Bảo quản nơi khô ráo, tránh ánh nắng và nhiệt độ cao. Kết tinh có thể là hiện tượng tự nhiên của mật ong, không nhất thiết là dấu hiệu chất lượng kém.</p>
        </article>
      </div>
    </main>
  );
}
