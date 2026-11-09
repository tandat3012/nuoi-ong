import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CreditCard,
  Lock,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { STOREFRONT_CONFIG } from "@/features/commerce/storefront/config/storefront-config";

type PolicySlug = "shipping" | "returns" | "privacy" | "payment";

interface PolicySection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

interface PolicyDocument {
  slug: PolicySlug;
  title: string;
  subtitle: string;
  sections: PolicySection[];
}

const POLICIES: Record<PolicySlug, PolicyDocument> = {
  shipping: {
    slug: "shipping",
    title: "Chính sách giao hàng theo 3 miền",
    subtitle:
      "Điều phối trực tiếp từ hệ thống kho bán hàng Mộc Ong tại Miền Bắc, Miền Trung và Miền Nam.",
    sections: [
      {
        heading: "1. Phạm vi phục vụ & Phân bổ kho bán theo miền",
        paragraphs: [
          "Mộc Ong vận hành mạng lưới kho bán hàng phục vụ 3 khu vực: Miền Bắc, Miền Trung và Miền Nam. Khi bạn chọn miền giao hàng trên thanh đầu trang, hệ thống tự động đối chiếu tồn kho khả dụng thực tế tại các kho đang mở bán cho khu vực đó.",
        ],
        bullets: [
          "Mỗi đơn hàng được xuất nguyên vẹn từ một kho bán hàng duy nhất đủ tồn kho nhằm đảm bảo tốc độ đóng gói và đồng nhất kiện hàng.",
          "Trường hợp giỏ hàng gồm nhiều sản phẩm nằm ở các kho khác nhau, hệ thống tự động gợi ý tách giỏ 1 chạm để bạn đặt đơn thuận tiện.",
          "Phí vận chuyển được niêm yết cố định theo từng miền và hiển thị minh bạch trên trang Chi tiết sản phẩm cũng như trang Đặt hàng.",
        ],
      },
      {
        heading: "2. Nguyên tắc giữ hàng & Xuất kho chuẩn FEFO / Định danh",
        paragraphs: [
          "Để đảm bảo số liệu tồn kho chính xác giữa Cửa hàng trực tuyến và Hệ thống Quản lý Kho (WMS), đơn hàng ở trạng thái Chờ xác nhận chưa khóa tồn kho cứng cho tới khi nhân viên trang trại xác nhận đơn.",
        ],
        bullets: [
          "Ngay khi đơn được Xác nhận, hệ thống tự động lập Phiếu xuất kho giữ hàng cho đúng số lượng khách đặt.",
          "Đối với mật ong, thức ăn và thuốc thú y quản lý theo Lô (LOT): kho áp dụng nguyên tắc FEFO (First Expired, First Out) — chỉ xuất các lô còn hạn sử dụng và ưu tiên lô có ngày hết hạn gần nhất còn hạn.",
          "Đối với máy móc, thiết bị nuôi ong quản lý theo Tài sản (ASSET): từng thiết bị được gắn Mã tài sản và Số Serial định danh riêng trên phiếu xuất kho và biên bản bàn giao.",
        ],
      },
      {
        heading: "3. Xử lý giao hàng không thành công (Hoàn kho kiểm định)",
        paragraphs: [
          "Nếu đơn hàng giao không thành công do không liên hệ được người nhận hoặc phát sinh sự cố vận chuyển, đơn chuyển sang trạng thái Đang hoàn trả và chỉ kết thúc khi kho bán lập Phiếu nhập hoàn kiểm tra lại tình trạng thực tế của từng lô hàng hoặc thiết bị.",
        ],
      },
    ],
  },
  returns: {
    slug: "returns",
    title: "Chính sách bảo hành & Đổi trả sau bán",
    subtitle:
      "Bảo hành thiết bị chính hãng theo mã định danh Serial và hỗ trợ đổi trả minh bạch trong 7 ngày.",
    sections: [
      {
        heading: "1. Chính sách bảo hành thiết bị & dụng cụ nuôi ong",
        paragraphs: [
          "Các dòng Thiết bị (EQUIPMENT) và Dụng cụ (TOOL) có áp dụng bảo hành sẽ hiển thị rõ số tháng bảo hành ngay trên trang Chi tiết sản phẩm và được ghi nhận cố định vào từng dòng đơn hàng khi đặt mua.",
        ],
        bullets: [
          "Thời hạn bảo hành được tính tự động từ thời điểm đơn hàng chuyển sang trạng thái Giao thành công (COMPLETED).",
          "Mỗi thiết bị định danh (ASSET) được tra cứu bảo hành chính xác theo Mã tài sản và Số Serial đã bàn giao trên đơn hàng.",
          "Các mặt hàng Vật tư tiêu hao và Mật ong (MATERIAL) được cam kết chất lượng theo lô và hạn sử dụng khi nhận hàng, không áp dụng bảo hành sửa chữa thiết bị.",
        ],
      },
      {
        heading: "2. Quy trình bảo hành miễn phí & Sửa chữa có phí",
        paragraphs: [
          "Khi thiết bị phát sinh sự cố kỹ thuật, quý khách liên hệ Hotline hoặc gửi yêu cầu kèm mã đơn hàng để trại ong tiếp nhận hồ sơ bảo hành:",
        ],
        bullets: [
          "Bảo hành trong hạn (WARRANTY): Miễn phí kiểm tra, sửa chữa tại đối tác kỹ thuật hoặc xuất kho đổi mới thiết bị tương đương nếu không thể khắc phục.",
          "Sửa chữa có phí ngoài hạn (PAID_REPAIR): Khi thiết bị đã hết hạn bảo hành hoặc hư hỏng do tác động ngoại lực, trại ong sẽ thông báo mức báo giá trước. Kỹ thuật viên chỉ bắt đầu sửa chữa sau khi quý khách xác nhận đồng ý mức phí.",
          "Mọi phiếu xuất đổi thiết bị mới đều được liên kết trực tiếp với hồ sơ bảo hành để theo dõi xuyên suốt.",
        ],
      },
      {
        heading: "3. Chính sách đổi trả trong 7 ngày đầu",
        paragraphs: [
          "Mộc Ong hỗ trợ đổi trả trong vòng 7 ngày kể từ ngày nhận hàng đối với sản phẩm giao sai quy cách, lỗi kỹ thuật từ nhà sản xuất hoặc hư hỏng bao bì trong quá trình vận chuyển.",
        ],
      },
    ],
  },
  payment: {
    slug: "payment",
    title: "Hướng dẫn thanh toán",
    subtitle:
      "Hỗ trợ linh hoạt Thanh toán tiền mặt khi nhận hàng (COD) và Chuyển khoản VietQR đối soát tự động.",
    sections: [
      {
        heading: "1. Thanh toán khi nhận hàng (COD)",
        paragraphs: [
          "Với hình thức COD, quý khách kiểm tra kiện hàng khi nhận và thanh toán trực tiếp bằng tiền mặt cho nhân viên giao hàng đúng bằng Tổng thanh toán trên đơn.",
        ],
        bullets: [
          "Đơn hàng COD được giữ trạng thái Chưa thanh toán trong suốt quá trình chuẩn bị và vận chuyển.",
          "Sau khi giao hàng thành công, nhân viên giao nhận bàn giao tiền thu hộ về quỹ trang trại để hoàn tất đối soát.",
        ],
      },
      {
        heading: "2. Chuyển khoản ngân hàng qua mã VietQR động",
        paragraphs: [
          "Ngay sau khi đặt đơn với phương thức Chuyển khoản ngân hàng, hệ thống sinh mã VietQR chứa sẵn Số tài khoản, Số tiền chính xác và Nội dung chuyển khoản chứa Mã đơn hàng (ví dụ: DH000012).",
        ],
        bullets: [
          "Quý khách chỉ cần mở ứng dụng ngân hàng quét mã VietQR mà không cần nhập tay số tiền hay nội dung.",
          "Trang chi tiết đơn hàng tự động kiểm tra và cập nhật trạng thái Đã thanh toán ngay khi hệ thống ghi nhận giao dịch khớp lệnh.",
          "Lưu ý: Đơn hàng chuyển khoản cần được ghi nhận thanh toán đầy đủ trước khi kho xuất giao vận chuyển.",
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Chính sách bảo mật thông tin",
    subtitle:
      "Bảo vệ an toàn dữ liệu tài khoản, thông tin người nhận và lịch sử giao dịch của khách hàng.",
    sections: [
      {
        heading: "1. Phạm vi thu thập & Sử dụng thông tin",
        paragraphs: [
          "Mộc Ong chỉ thu thập các thông tin cần thiết để xử lý đơn hàng và hỗ trợ kỹ thuật sau bán, bao gồm: Họ tên người nhận, Số điện thoại liên hệ, Khu vực/Địa chỉ giao hàng và lịch sử đơn hàng.",
        ],
        bullets: [
          "Sử dụng để điều phối kho bán gần nhất, liên hệ giao nhận và tra cứu thời hạn bảo hành thiết bị.",
          "Tuyệt đối không chia sẻ, mua bán thông tin khách hàng cho bên thứ ba ngoài đơn vị vận chuyển thực hiện giao đơn hàng đó.",
        ],
      },
      {
        heading: "2. Bảo mật xác thực & Chống tạo đơn trùng lặp",
        paragraphs: [
          "Hệ thống xác thực người dùng qua nền tảng định danh bảo mật Clerk và áp dụng khóa chống trùng lặp (Idempotency Key) cho mỗi lần gửi đơn, giúp bảo vệ khách hàng khỏi việc bị tạo trùng đơn hàng khi mạng chập chờn.",
        ],
      },
    ],
  },
};

const POLICY_NAV: { slug: PolicySlug; label: string; icon: typeof Truck }[] = [
  { slug: "shipping", label: "Chính sách giao hàng", icon: Truck },
  { slug: "returns", label: "Bảo hành & Đổi trả", icon: RotateCcw },
  { slug: "payment", label: "Hướng dẫn thanh toán", icon: CreditCard },
  { slug: "privacy", label: "Bảo mật thông tin", icon: Lock },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = POLICIES[slug as PolicySlug];
  if (!doc) return { title: "Chính sách cửa hàng" };
  return {
    title: doc.title,
    description: doc.subtitle,
  };
}

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!Object.hasOwn(POLICIES, slug)) {
    notFound();
  }
  const doc = POLICIES[slug as PolicySlug];
  const { contact } = STOREFRONT_CONFIG.footer;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 space-y-8">
      <nav
        aria-label="Đường dẫn trang"
        className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
      >
        <Link href="/" className="hover:text-primary transition-colors">
          Trang chủ
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-foreground">{doc.title}</span>
      </nav>

      {/* Thanh chuyển đổi nhanh giữa 4 chính sách */}
      <div className="flex flex-wrap gap-2">
        {POLICY_NAV.map((item) => {
          const Icon = item.icon;
          const active = item.slug === doc.slug;
          return (
            <Link
              key={item.slug}
              href={`/policy/${item.slug}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Nội dung chính sách */}
      <article className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-2xs space-y-8">
        <header className="space-y-2 border-b border-border pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span>Chính sách & Cam kết Mộc Ong</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
            {doc.title}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {doc.subtitle}
          </p>
        </header>

        <div className="space-y-6">
          {doc.sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-foreground">
                {section.heading}
              </h2>
              {section.paragraphs.map((p, idx) => (
                <p
                  key={idx}
                  className="text-sm sm:text-base text-muted-foreground leading-relaxed"
                >
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-foreground/90">
                  {section.bullets.map((bullet, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-muted/30 p-5 text-xs sm:text-sm">
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">
              Cần hỗ trợ thêm về đơn hàng hoặc bảo hành thiết bị?
            </p>
            <p className="text-muted-foreground">
              Hotline hỗ trợ kỹ thuật & đơn hàng:{" "}
              <strong className="text-foreground">{contact.hotline}</strong> (
              {contact.workingHours})
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/track-order"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <span>Tra cứu đơn & Bảo hành</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Liên hệ tư vấn
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
