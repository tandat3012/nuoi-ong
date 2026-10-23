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

export type StorefrontPromotionItem = {
  id: string;
  eyebrow: string;
  heading: string;
  description: string;
  action: {
    label: string;
    href: string;
    isImplemented: boolean;
    type: 'category' | 'product';
  };
  visual: {
    subject: 'supplies' | 'equipment';
    badge?: string;
  };
  isFixture: boolean;
};

export type StorefrontPromotionsSectionConfig = {
  srHeading: string;
  items: readonly StorefrontPromotionItem[];
};

export type StorefrontTestimonialItem = {
  id: string;
  rating: number;
  quote: string;
  author: {
    name: string;
    role: string;
    initials: string;
  };
  isFixture: boolean;
};

export type StorefrontTestimonialsSectionConfig = {
  heading: string;
  description: string;
  items: readonly StorefrontTestimonialItem[];
};

export type StorefrontArticlePreviewItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  icon: 'sprout' | 'package' | 'droplets' | 'book';
  href: string;
  isImplemented: boolean;
  isFixture: boolean;
};

export type StorefrontArticlesSectionConfig = {
  heading: string;
  description: string;
  viewAll: {
    label: string;
    href: string;
    isImplemented: boolean;
  };
  items: readonly StorefrontArticlePreviewItem[];
};

export type StorefrontNewsletterSectionConfig = {
  heading: string;
  description: string;
  emailPlaceholder: string;
  submitLabel: string;
  availabilityMessage: string;
  isImplemented: boolean;
};

const categoryPresentationBySlug: Record<
  string,
  StorefrontCategoryPresentation
> = {
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
    presentationBySlug: categoryPresentationBySlug,
  } satisfies StorefrontCategorySectionConfig,
  featuredProducts: {
    heading: 'Được nhà ong tin chọn',
    description: 'Khám phá vật tư và thiết bị đang có tại cửa hàng Mộc Ong.',
    viewAll: {
      label: 'Xem tất cả',
      href: '/products',
      isImplemented: true,
    },
  } satisfies StorefrontFeaturedSectionConfig,
  promotions: {
    srHeading: 'Chương trình ưu đãi và khuyến mãi Mộc Ong',
    items: [
      {
        id: 'promo-supplies-combo',
        eyebrow: 'SẴN SÀNG CHO MÙA MẬT MỚI',
        heading: 'Đàn ong khỏe mạnh. Mùa mật an tâm.',
        description: 'Combo vật tư chăm sóc đàn ong, tiết kiệm đến 15%.',
        action: {
          label: 'Khám phá combo',
          href: '/products?category=vat-tu',
          isImplemented: true,
          type: 'category',
        },
        visual: {
          subject: 'supplies',
          badge: 'Tiết kiệm 15%',
        },
        isFixture: true,
      },
      {
        id: 'promo-equipment-upgrade',
        eyebrow: 'NÂNG CẤP THIẾT BỊ · NÂNG TẦM NĂNG SUẤT',
        heading: 'Quay mật nhẹ nhàng, thu hoạch vẹn nguyên.',
        description: 'Máy quay mật inox — ưu đãi đến 350.000₫.',
        action: {
          label: 'Xem chi tiết',
          href: '/products/may-quay-mat-inox-3-cau',
          isImplemented: true,
          type: 'product',
        },
        visual: {
          subject: 'equipment',
          badge: 'Ưu đãi 350K',
        },
        isFixture: true,
      },
    ],
  } satisfies StorefrontPromotionsSectionConfig,
  testimonials: {
    heading: 'Niềm tin từ những người giữ ong',
    description: 'Hơn cả sản phẩm, là sự đồng hành qua từng mùa mật.',
    items: [
      {
        id: 'testimonial-1',
        rating: 5,
        quote:
          'Từ khi dùng thùng gỗ thông và đường ong của Mộc Ong, đàn ong phát triển rất đều, không bị hao hụt qua mùa đông. Tư vấn kỹ thuật rất tận tình.',
        author: {
          name: 'Bác Nguyễn Văn Hùng',
          role: 'Trại ong 120 đàn · Đắk Lắk',
          initials: 'NH',
        },
        isFixture: true,
      },
      {
        id: 'testimonial-2',
        rating: 5,
        quote:
          'Máy quay mật inox 3 cầu quay rất êm, bánh răng nhẹ và bền, mật chảy trong vắt không bị lẫn cặn bọt. Đầu tư rất xứng đáng.',
        author: {
          name: 'Anh Trần Đình Quân',
          role: 'Nuôi ong hoa cà phê · Gia Lai',
          initials: 'TQ',
        },
        isFixture: true,
      },
      {
        id: 'testimonial-3',
        rating: 5,
        quote:
          'Giao hàng về tận vườn nhanh chóng, đóng gói cẩn thận. Vật tư chuẩn chất lượng, giá cả lại rất hợp lý cho nhà nông nuôi quy mô vừa.',
        author: {
          name: 'Chú Lê Hoàng Nam',
          role: 'Trại ong mật rừng · Lâm Đồng',
          initials: 'LN',
        },
        isFixture: true,
      },
    ],
  } satisfies StorefrontTestimonialsSectionConfig,
  articles: {
    heading: 'Cùng nhau nuôi ong tốt hơn',
    description: 'Kinh nghiệm thực tế, kiến thức hữu ích cho nhà ong.',
    viewAll: {
      label: 'Xem bài viết',
      href: '/blog',
      isImplemented: false,
    },
    items: [
      {
        id: 'article-chuan-bi-truoc-mua-mat-moi',
        category: 'CHĂM SÓC ĐÀN ONG',
        title: '5 điều cần chuẩn bị trước mùa mật mới',
        description: 'Một đàn ong khỏe mạnh là khởi đầu cho mùa mật bội thu.',
        icon: 'sprout',
        href: '/blog/chuan-bi-truoc-mua-mat-moi',
        isImplemented: false,
        isFixture: true,
      },
      {
        id: 'article-chon-thung-ong-phu-hop',
        category: 'KINH NGHIỆM NUÔI ONG',
        title: 'Cách chọn thùng ong phù hợp với đàn của bạn',
        description: 'Từ chất liệu đến kích thước, chọn đúng ngôi nhà cho đàn ong.',
        icon: 'package',
        href: '/blog/chon-thung-ong-phu-hop',
        isImplemented: false,
        isFixture: true,
      },
      {
        id: 'article-mat-ong-nguyen-chat-nhan-biet-va-bao-quan',
        category: 'CÂU CHUYỆN MẬT ONG',
        title: 'Mật ong nguyên chất: nhận biết và bảo quản',
        description: 'Giữ trọn hương vị và dưỡng chất của món quà thiên nhiên.',
        icon: 'droplets',
        href: '/blog/mat-ong-nguyen-chat-nhan-biet-va-bao-quan',
        isImplemented: false,
        isFixture: true,
      },
    ],
  } satisfies StorefrontArticlesSectionConfig,
  newsletter: {
    heading: 'Mùa mật mới, tin vui mới.',
    description: 'Nhận kinh nghiệm nuôi ong và những ưu đãi dành riêng cho bạn.',
    emailPlaceholder: 'Địa chỉ email của bạn',
    submitLabel: 'Đăng ký',
    availabilityMessage: 'Tính năng đăng ký nhận bản tin đang được hoàn thiện.',
    isImplemented: false,
  } satisfies StorefrontNewsletterSectionConfig,
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
