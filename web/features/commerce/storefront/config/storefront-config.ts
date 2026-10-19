export type StorefrontNavItem = {
  label: string;
  href: string;
  isImplemented: boolean;
};

export type StorefrontFooterLink = {
  label: string;
  href?: string;
  isImplemented: boolean;
};

export type StorefrontFooterGroup = {
  title: string;
  links: readonly StorefrontFooterLink[];
};

export type StorefrontSocialLink = {
  platform: 'facebook' | 'zalo' | 'youtube';
  label: string;
  href: string;
};

export type StorefrontHeroConfig = {
  eyebrow: string;
  heading: {
    prefix: string;
    highlight: string;
    suffix: string;
  };
  supportingCopy: string;
  primaryAction: {
    label: string;
    href: string;
    isImplemented: boolean;
  };
  secondaryAction: {
    label: string;
    href: string;
    isImplemented: boolean;
  };
  trustLine: string;
  image: {
    src: string;
    alt: string;
  };
};

export type StorefrontBenefitItem = {
  id: string;
  title: string;
  description: string;
  icon: 'shipping' | 'quality' | 'support' | 'returns';
};

export type StorefrontCategoryPresentation = {
  subtitle: string;
  icon: 'sprout' | 'package' | 'wrench' | 'droplets';
};

export type StorefrontCategorySectionConfig = {
  heading: string;
  description: string;
  presentationBySlug: Record<string, StorefrontCategoryPresentation>;
};

export type StorefrontFeaturedSectionConfig = {
  heading: string;
  description: string;
  viewAll: {
    label: string;
    href: string;
    isImplemented: boolean;
  };
};

export const STOREFRONT_CONFIG = {
  brand: {
    name: 'Mộc Ong',
    tagline: 'TỪ TÂM · TỪ THIÊN NHIÊN',
    description: 'Chăm đàn ong khỏe, đón mùa mật ngọt.\nMộc Ong đồng hành cùng nhà nông Việt.',
  },
  announcement: {
    companionMessage: 'Đồng hành cùng người nuôi ong Việt',
    shippingMessage: 'Miễn phí vận chuyển đơn từ 1.000.000₫',
  },
  hero: {
    eyebrow: 'ĐỒNG HÀNH CÙNG NGƯỜI NUÔI ONG VIỆT',
    heading: {
      prefix: 'Chăm đàn ong khỏe, đón ',
      highlight: 'mùa mật ngọt',
      suffix: '.',
    },
    supportingCopy:
      'Vật tư chất lượng, thiết bị bền bỉ và mật ong thuần khiết.\nTừ trang trại đến tay bạn — trọn vẹn sự an tâm.',
    primaryAction: {
      label: 'Khám phá sản phẩm',
      href: '/products',
      isImplemented: true,
    },
    secondaryAction: {
      label: 'Câu chuyện Mộc Ong',
      href: '/about',
      isImplemented: false,
    },
    trustLine: 'Chất lượng từ tâm · Tư vấn tận tình · Giao hàng toàn quốc',
    image: {
      src: '/assets/bee-farm-hero.jpg',
      alt: 'Người nuôi ong kiểm tra cầu ong tại trang trại Mộc Ong trong ánh bình minh',
    },
  } satisfies StorefrontHeroConfig,
  benefits: [
    {
      id: 'shipping',
      title: 'Giao hàng toàn quốc',
      description: 'Nhanh chóng, tận nơi',
      icon: 'shipping',
    },
    {
      id: 'quality',
      title: 'Hàng chính hãng',
      description: 'Chất lượng được kiểm chứng',
      icon: 'quality',
    },
    {
      id: 'support',
      title: 'Tư vấn kỹ thuật nuôi ong',
      description: 'Đồng hành trong từng mùa mật',
      icon: 'support',
    },
    {
      id: 'returns',
      title: 'Đổi trả 7 ngày',
      description: 'An tâm khi mua sắm',
      icon: 'returns',
    },
  ] as const satisfies readonly StorefrontBenefitItem[],
  categories: {
    heading: 'Mọi điều cho mùa ong bội thu',
    description: 'Từ chăm sóc đàn ong đến thu hoạch những giọt mật đầu tiên.',
    presentationBySlug: {
      'vat-tu': {
        subtitle: 'Đường ong · Thuốc ong · Thức ăn ong',
        icon: 'sprout',
      },
      'tai-san': {
        subtitle: 'Nhà gỗ ong · Thùng nuôi ong',
        icon: 'package',
      },
      'thiet-bi': {
        subtitle: 'Máy pha mật · Máy quay mật · Dụng cụ',
        icon: 'wrench',
      },
      'mat-ong': {
        subtitle: 'Mật hoa cà phê · Mật hoa rừng',
        icon: 'droplets',
      },
    },
  } satisfies StorefrontCategorySectionConfig,
  featuredProducts: {
    heading: 'Được nhà ong tin chọn',
    description: 'Những sản phẩm bán chạy, đã được kiểm chứng qua từng mùa mật.',
    viewAll: {
      label: 'Xem tất cả',
      href: '/products',
      isImplemented: true,
    },
  } satisfies StorefrontFeaturedSectionConfig,
  navigation: [
    { label: 'Trang chủ', href: '/', isImplemented: true },
    { label: 'Tất cả sản phẩm', href: '/products', isImplemented: true },
    { label: 'Vật tư', href: '/products?category=vat-tu', isImplemented: true },
    { label: 'Tài sản', href: '/products?category=tai-san', isImplemented: true },
    { label: 'Thiết bị', href: '/products?category=thiet-bi', isImplemented: true },
    { label: 'Mật ong', href: '/products?category=mat-ong', isImplemented: true },
    { label: 'Kinh nghiệm nuôi ong', href: '/blog', isImplemented: false },
    { label: 'Về Mộc Ong', href: '/about', isImplemented: false },
    { label: 'Liên hệ', href: '/contact', isImplemented: false },
  ] as const satisfies readonly StorefrontNavItem[],
  footer: {
    groups: [
      {
        title: 'Khám phá Mộc Ong',
        links: [
          { label: 'Về chúng tôi', href: '/about', isImplemented: false },
          { label: 'Sản phẩm', href: '/products', isImplemented: true },
          { label: 'Kinh nghiệm nuôi ong', href: '/blog', isImplemented: false },
          { label: 'Liên hệ', href: '/contact', isImplemented: false },
        ],
      },
      {
        title: 'Chăm sóc khách hàng',
        links: [
          { label: 'Chính sách giao hàng', href: '/policy/shipping', isImplemented: false },
          { label: 'Chính sách đổi trả', href: '/policy/returns', isImplemented: false },
          { label: 'Bảo mật thông tin', href: '/policy/privacy', isImplemented: false },
          { label: 'Hướng dẫn thanh toán', href: '/policy/payment', isImplemented: false },
        ],
      },
    ] as const satisfies readonly StorefrontFooterGroup[],
    contact: {
      title: 'Kết nối với chúng tôi',
      // Thông tin liên hệ dạng fixture phục vụ phát triển hiển thị, sẽ thay bằng dữ liệu thực tế
      isFixture: true,
      hotline: '1900 8888',
      email: 'hotro@mocong.vn',
      address: 'Xã Ea Ktur, Huyện Cư Kuin, Tỉnh Đắk Lắk',
      workingHours: 'Thứ 2 - Thứ 7: 8:00 - 17:30',
    },
    socialLinks: [
      {
        platform: 'facebook',
        label: 'Theo dõi Mộc Ong trên Facebook',
        href: 'https://facebook.com/mocong.vn',
      },
      {
        platform: 'zalo',
        label: 'Nhắn tin Zalo với Mộc Ong',
        href: 'https://zalo.me/mocong',
      },
      {
        platform: 'youtube',
        label: 'Kênh YouTube Mộc Ong',
        href: 'https://youtube.com/@mocong',
      },
    ] as const satisfies readonly StorefrontSocialLink[],
    paymentMethods: [
      'COD (Tiền mặt)',
      'Chuyển khoản ngân hàng',
      'Ví điện tử',
    ] as const,
    copyright: '© 2026 Mộc Ong. Bản quyền thuộc về Trại Ong Mộc Ong. Tất cả các quyền được bảo lưu.',
  },
} as const;
