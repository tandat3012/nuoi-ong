import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

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
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">
        Cẩm nang kỹ thuật thực tế từ đội ngũ kỹ sư và chủ trại Mộc Ong qua từng mùa hoa cà phê, hoa nhãn và mật rừng Tây Nguyên.
      </p>
      <div className="relative mt-8 aspect-[15/8] overflow-hidden rounded-2xl border border-border">
        <Image src="/assets/bee-farm-hero.jpg" alt="Người nuôi ong kiểm tra cầu ong" fill sizes="(max-width: 1024px) 100vw, 960px" className="object-cover" />
      </div>
      <div className="mx-auto mt-10 max-w-3xl space-y-10 text-base leading-8 text-foreground/85">
        <article id="chuan-bi-truoc-mua-mat-moi" className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Chăm sóc đàn ong</span>
          <h2 className="font-serif text-2xl font-bold text-foreground">5 điều cần chuẩn bị trước mùa mật mới</h2>
          <p>Kiểm tra đàn ong định kỳ, theo dõi nguồn hoa và chuẩn bị dụng cụ sạch sẽ giúp đàn ong đạt thế đàn mạnh nhất trước khi hoa nở rộ.</p>
          <ol className="list-decimal space-y-1.5 pl-6 text-sm sm:text-base">
            <li>Kiểm tra sức đẻ của ong chúa và bổ sung phấn hoa/đường kích thích khi thời tiết lạnh.</li>
            <li>Vệ sinh, khử trùng thùng ong, cầu ong và thay chân tầng sáp mới để ong xây tổ đều.</li>
            <li>Khảo sát bán kính nguồn hoa 1,5 – 2km quanh điểm đặt trại và nguồn nước sạch.</li>
            <li>Bảo dưỡng máy quay mật inox, lưới lọc mật và kiểm tra đồ bảo hộ trước ngày thu hoạch.</li>
            <li>Chỉ sử dụng vật tư, thức ăn còn hạn sử dụng rõ ràng theo nguyên tắc FEFO.</li>
          </ol>
          <div className="pt-2">
            <Link
              href="/products?category=vat-tu"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <span>Xem danh mục Vật tư chăm sóc đàn ong</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </article>

        <article id="chon-thung-ong-phu-hop" className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Kinh nghiệm nuôi ong</span>
          <h2 className="font-serif text-2xl font-bold text-foreground">Cách chọn thùng ong và máy quay mật phù hợp</h2>
          <p>
            Ưu tiên thùng gỗ thông hoặc gỗ sao đã sấy khô đạt độ ẩm tiêu chuẩn, ván dày giữ nhiệt tốt vào mùa đông và thoáng mát vào mùa hè. Đối với trại từ 20 đàn trở lên, đầu tư máy quay mật inox 3 cầu đến 6 cầu có bảo hành chính hãng giúp quay kiệt mật mà không làm vỡ bánh tổ hay tổn hại ấu trùng.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              href="/products?category=tai-san"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <span>Tham khảo Thùng nuôi ong</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/products?category=thiet-bi"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <span>Tham khảo Thiết bị & Máy quay mật</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </article>

        <article id="mat-ong-nguyen-chat-nhan-biet-va-bao-quan" className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Câu chuyện mật ong</span>
          <h2 className="font-serif text-2xl font-bold text-foreground">Mật ong nguyên chất: Nhận biết và bảo quản chuẩn kỹ thuật</h2>
          <p>
            Mật ong thu hoạch đúng độ chín có hàm lượng thủy phần dưới 20%, hương thơm đặc trưng của mùa hoa và vị ngọt thanh. Nên đựng mật trong chai thủy tinh hoặc can thực phẩm kín khí, đặt nơi thoáng mát (20–27°C), tránh ánh nắng trực tiếp. Hiện tượng kết tinh hạt mịn ở đáy chai khi nhiệt độ xuống thấp là đặc tính vật lý tự nhiên của đường glucose trong mật ong nguyên chất.
          </p>
          <div className="pt-2">
            <Link
              href="/products?category=mat-ong"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <span>Khám phá Mật ong tự nhiên Mộc Ong</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
