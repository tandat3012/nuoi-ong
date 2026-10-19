// shortcut: dữ liệu mẫu để dựng API, thay bằng truy vấn DB khi có schema bán hàng.
const categories = {
  materials: { id: 'vat-tu', name: 'Vật tư', slug: 'vat-tu' },
  assets: { id: 'tai-san', name: 'Tài sản', slug: 'tai-san' },
  equipment: { id: 'thiet-bi', name: 'Thiết bị', slug: 'thiet-bi' },
  honey: { id: 'mat-ong', name: 'Mật ong', slug: 'mat-ong' },
};

export const STORE_CATEGORIES = Object.values(categories);

export const STORE_PRODUCTS = [
  {
    id: 'prod-mat-ong-hoa-ca-phe',
    slug: 'mat-ong-hoa-ca-phe-nguyen-chat',
    name: 'Mật ong hoa cà phê nguyên chất',
    description: 'Sản phẩm mẫu: mật ong hoa cà phê đóng chai.',
    category: categories.honey,
    price: 185000,
    inStock: true,
  },
  {
    id: 'prod-thung-nuoi-ong-go-thong',
    slug: 'thung-nuoi-ong-go-thong-10-cau',
    name: 'Thùng nuôi ong gỗ thông 10 cầu',
    description: 'Sản phẩm mẫu: thùng nuôi ong gỗ thông loại 10 cầu.',
    category: categories.assets,
    price: 450000,
    inStock: true,
  },
  {
    id: 'prod-may-quay-mat-inox',
    slug: 'may-quay-mat-inox-3-cau',
    name: 'Máy quay mật inox 3 cầu',
    description: 'Sản phẩm mẫu: máy quay mật inox loại 3 cầu.',
    category: categories.equipment,
    price: 2850000,
    inStock: true,
  },
  {
    id: 'prod-duong-ong-tinh-luyen',
    slug: 'duong-ong-tinh-luyen-cao-cap',
    name: 'Đường ong tinh luyện cao cấp',
    description: 'Sản phẩm mẫu: đường tinh luyện dùng làm thức ăn cho ong.',
    category: categories.materials,
    price: 325000,
    inStock: false,
  },
];
