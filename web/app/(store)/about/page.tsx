import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Droplets,
  MapPin,
  PackageCheck,
  QrCode,
  ShieldCheck,
  Sprout,
  Truck,
  Wrench,
} from 'lucide-react';
import { STOREFRONT_CONFIG } from '@/features/commerce/storefront/config/storefront-config';

export const metadata: Metadata = {
  title: 'Về Mộc Ong — Câu chuyện từ trang trại đến hệ sinh thái nuôi ong Việt',
  description:
    'Câu chuyện Mộc Ong: chuẩn hóa vật tư, thiết bị định danh và mật ong truy xuất theo lô FEFO, đồng hành cùng người nuôi ong trên cả 3 miền.',
};

const KEY_STATS = [
  {
    value: '3 Miền',
    label: 'Mạng lưới kho & trại cung ứng',
    detail: 'Điều phối trực tiếp Bắc · Trung · Nam với tồn kho thời gian thực',
  },
  {
    value: 'Chuẩn FEFO',
    label: 'Kiểm soát lô mật & vật tư',
    detail: '100% lô xuất kho còn hạn sử dụng và đồng nhất chất lượng',
  },
  {
    value: 'Định danh Serial',
    label: 'Quản lý máy móc & thùng ong',
    detail: 'Mỗi thiết bị bàn giao đều có mã tài sản & bảo hành điện tử',
  },
  {
    value: '7 Ngày',
    label: 'Cam kết đổi trả minh bạch',
    detail: 'Hỗ trợ kỹ thuật xuyên suốt mùa mật và bảo hành chính hãng',
  },
] as const;

const CORE_PILLARS = [
  {
    icon: Sprout,
    badge: 'Vật tư & Dinh dưỡng đàn ong',
    title: 'Chọn lọc kỹ lưỡng cho đàn ong khỏe',
    description:
      'Từ phấn hoa, bột đậu tương, chân tầng sáp đến chế phẩm sinh học — mọi lô vật tư tiêu hao đều được kiểm định hạn dùng và điều kiện bảo quản trước khi xuất kho.',
    highlights: [
      'Quản lý tồn kho theo Lô (LOT) và hạn sử dụng rõ ràng',
      'Quy tắc xuất kho FEFO ưu tiên lô chuẩn hạn, không giao hàng cận/quá hạn',
      'Đơn vị tính và quy cách đóng gói minh bạch cho từng quy mô trại',
    ],
  },
  {
    icon: Wrench,
    badge: 'Thiết bị & Thùng ong định danh',
    title: 'Bền bỉ qua nhiều mùa quay mật',
    description:
      'Máy quay mật inox, thùng nuôi ong gỗ tự nhiên và dụng cụ khai thác được chế tác chuẩn kích thước kỹ thuật, giúp người nuôi ong thao tác nhẹ nhàng và bảo vệ cầu ong.',
    highlights: [
      'Gắn Mã tài sản & Số Serial riêng cho từng máy móc, thiết bị xuất bán',
      'Tự động kích hoạt bảo hành điện tử ngay khi giao hàng thành công',
      'Tra cứu lịch sử bảo hành, sửa chữa và đổi mới trực tuyến dễ dàng',
    ],
  },
  {
    icon: Droplets,
    badge: 'Mật ong & Sản vật từ tổ',
    title: 'Thuần khiết hương hoa đất Việt',
    description:
      'Mật hoa cà phê Tây Nguyên, mật hoa nhãn, mật rừng tự nhiên được thu hoạch đúng độ chín Thủy phần, giữ trọn hương vị nguyên bản và enzyme tự nhiên từ đàn ong.',
    highlights: [
      'Truy xuất rõ nguồn gốc trại thu hoạch và lô đóng gói',
      'Kiểm soát độ ẩm và độ tinh khiết trước khi nhập kho thương mại',
      'Đóng gói chống sốc tiêu chuẩn, giao hàng nhanh trên toàn quốc',
    ],
  },
] as const;

const QUALITY_WORKFLOW = [
  {
    step: '01',
    icon: PackageCheck,
    title: 'Kiểm định & Nhập kho theo chuẩn ERP/WMS',
    description:
      'Vật tư được phân loại theo Lô (LOT) kèm ngày hết hạn; thiết bị được cấp Mã tài sản (ASSET) và tem QR/Serial định danh từng cá thể ngay tại kho trại.',
  },
  {
    step: '02',
    icon: MapPin,
    title: 'Đối chiếu tồn kho thực tế theo 3 miền',
    description:
      'Khi bạn chọn khu vực Bắc, Trung hoặc Nam, cửa hàng tự động kiểm tra tồn kho khả dụng tại các kho phục vụ miền đó và gợi ý tách đơn thông minh nếu cần.',
  },
  {
    step: '03',
    icon: QrCode,
    title: 'Đóng gói chuẩn xác & Bàn giao mã Serial',
    description:
      'Phiếu xuất kho ghi nhận chính xác lô hàng hoặc mã Serial thiết bị bàn giao cho khách. Bạn có thể xem và in phiếu bàn giao ngay trên trang Chi tiết đơn hàng.',
  },
  {
    step: '04',
    icon: ShieldCheck,
    title: 'Đồng hành kỹ thuật & Bảo hành hậu mãi',
    description:
      'Hỗ trợ tra cứu tiến độ đơn hàng, hạn bảo hành trực tuyến và tiếp nhận yêu cầu bảo hành miễn phí hoặc sửa chữa kỹ thuật minh bạch.',
  },
] as const;

export default function AboutPage() {
  const { contact } = STOREFRONT_CONFIG.footer;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Đường dẫn" className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary transition-colors">
          Trang chủ
        </Link>{' '}
        <span aria-hidden="true">/</span>{' '}
        <span className="text-foreground font-medium">Về Mộc Ong</span>
      </nav>

      {/* Hero Section */}
      <section className="grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6 space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold tracking-wider text-primary uppercase">
            <Award className="size-3.5" aria-hidden="true" />
            <span>Câu chuyện từ trang trại Mộc Ong</span>
          </p>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-5xl sm:leading-[1.15]">
            Từ tâm người nuôi ong, từ thiên nhiên đất Việt.
          </h1>
          <p className="text-base sm:text-lg leading-relaxed text-muted-foreground">
            Khởi đầu từ những đàn ong nhỏ giữa mùa hoa rừng, <strong className="text-foreground font-semibold">Mộc Ong</strong> ra đời với mong muốn xây dựng một hệ sinh thái vật tư, thiết bị và sản vật ngành ong minh bạch — nơi mỗi chiếc thùng ong, mỗi chiếc máy quay mật và từng giọt mật đều được quản trị chất lượng rõ ràng từ trang trại tới tay bạn.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-2xs transition hover:bg-primary/90"
            >
              <span>Khám phá cửa hàng</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/track-order"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              <span>Tra cứu đơn & Bảo hành</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative aspect-[15/10] overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <Image
              src="/assets/bee-farm-hero.jpg"
              alt="Người nuôi ong kiểm tra cầu ong tại trang trại Mộc Ong trong ánh bình minh"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5 text-white">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-200">
                Đồng hành trong từng mùa mật
              </p>
              <p className="mt-1 font-serif text-base sm:text-lg font-medium">
                “Chăm đàn ong khỏe từ vật tư chuẩn, thu mùa mật ngọt bằng sự tận tâm.”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Metrics */}
      <section
        aria-label="Những con số và cam kết vận hành"
        className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {KEY_STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-2xs transition hover:border-primary/30"
          >
            <p className="font-serif text-2xl sm:text-3xl font-bold text-primary">
              {stat.value}
            </p>
            <h2 className="mt-1.5 text-sm font-semibold text-foreground">
              {stat.label}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {stat.detail}
            </p>
          </div>
        ))}
      </section>

      {/* Story & Philosophy */}
      <section className="mt-16 rounded-3xl border border-border bg-card/60 p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Triết lý của chúng tôi
            </span>
            <h2 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">
              Gieo tin tưởng, gặt ngọt lành.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Người nuôi ong luôn phải đối mặt với thời tiết thất thường, nguồn hoa theo mùa và rủi ro dịch bệnh trên đàn ong. Một lô thức ăn kém chất lượng hay một chiếc máy quay mật thiếu ổn định đều có thể ảnh hưởng đến cả vụ thu hoạch.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-4 text-sm sm:text-base leading-relaxed text-foreground/85">
            <p>
              Chính vì thấu hiểu nỗi vất vả đó từ thực tế trang trại, <strong>Mộc Ong</strong> không chỉ dừng lại ở một cửa hàng bán lẻ thông thường. Chúng tôi kết hợp kinh nghiệm nuôi ong truyền thống với hệ thống quản trị kho vận hiện đại (ERP &amp; WMS) để kiểm soát chặt chẽ từng sản phẩm trước khi giao đến nhà nông.
            </p>
            <p>
              Từ khâu chọn gỗ đóng thùng, kiểm tra mối hàn lồng quay inox cho đến việc theo dõi hạn sử dụng của từng lô phấn hoa và thuốc thú y — tất cả đều được số hóa minh bạch. Khi đặt hàng tại Mộc Ong, bạn biết rõ sản phẩm được xuất từ khu vực kho nào, thuộc lô sản xuất nào hoặc mang mã định danh tài sản nào.
            </p>
          </div>
        </div>
      </section>

      {/* 3 Core Product Pillars */}
      <section className="mt-16">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Hệ sinh thái sản phẩm
          </span>
          <h2 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">
            Ba trụ cột phục vụ nhà ong Việt
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Đáp ứng trọn vẹn nhu cầu từ lúc nhân giống, chăm dưỡng đàn ong đến kỳ thu hoạch và thưởng thức mật ong thiên nhiên.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {CORE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-2xs"
              >
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                    <span>{pillar.badge}</span>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-border/70 pt-4 text-xs sm:text-sm text-foreground/90">
                  {pillar.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4-Step Quality & Traceability Workflow */}
      <section className="mt-16">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Quy trình vận hành chuẩn hóa
          </span>
          <h2 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">
            Minh bạch từ kho trại đến tận tay khách hàng
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Mỗi đơn hàng tại Mộc Ong đều đi qua quy trình đối soát 4 bước giữa Cửa hàng trực tuyến và Hệ thống Quản lý Kho (WMS).
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {QUALITY_WORKFLOW.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative rounded-2xl border border-border bg-card p-5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-serif text-2xl font-bold text-muted-foreground/35">
                    {item.step}
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-base font-bold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA & Support Banner */}
      <section className="mt-16 rounded-3xl border border-primary/25 bg-primary/5 p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">
              Sẵn sàng cho mùa mật mới cùng Mộc Ong?
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
              Dù bạn đang bắt đầu với vài thùng ong gia đình hay vận hành trang trại hàng trăm đàn ong, đội ngũ kỹ thuật của chúng tôi luôn sẵn sàng tư vấn giải pháp phù hợp nhất cho khu vực của bạn.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs sm:text-sm text-foreground/85">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="size-4 text-primary" aria-hidden="true" />
                Giao hàng 3 miền Bắc · Trung · Nam
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                Hotline kỹ thuật: <strong>{contact.hotline}</strong>
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-wrap gap-3 lg:justify-end">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-2xs transition hover:bg-primary/90"
            >
              <span>Mua sắm vật tư & thiết bị</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <BookOpen className="size-4 text-primary" aria-hidden="true" />
              <span>Góc chia sẻ kỹ thuật</span>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <span>Liên hệ tư vấn</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
