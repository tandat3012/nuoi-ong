import 'dotenv/config';

import { createHash } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const NAMESPACE = 'nuoi-ong-local-seed-v1';
const SEEDED_AT = '2026-08-15T08:00:00.000Z';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

const surveyCatalogSource = 
[
  {
    "rowNo": 1,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Bộ thùng ong Langstroth",
    "purpose": "Bộ cấu kiện tiêu chuẩn để hình thành một tổ ong nuôi.",
    "management": "Cá thể hoặc bộ",
    "unitLabel": "bộ",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 2,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Thân thùng ong sâu / thùng nuôi ấu trùng",
    "purpose": "Chứa cầu ong khu vực sinh sản và dự trữ của đàn.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 3,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Tầng mật cỡ trung",
    "purpose": "Đặt phía trên vùng brood để ong tích trữ mật khai thác.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 4,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Tầng mật cạn",
    "purpose": "Tầng chứa mật nhẹ hơn, thuận tiện thu hoạch.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 5,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Thân thùng ong 8 cầu",
    "purpose": "Thùng Langstroth cấu hình 8 cầu.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 6,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Thân thùng ong 10 cầu",
    "purpose": "Thùng Langstroth cấu hình 10 cầu.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 9,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Thùng nuc bằng gỗ",
    "purpose": "Nuôi đàn ong nhỏ, nhân đàn hoặc vận chuyển đàn nucleus.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 10,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Thùng nuc bằng nhựa",
    "purpose": "Nuôi/vận chuyển đàn nucleus bằng thùng nhẹ, bền.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 11,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Thùng nuc Pro",
    "purpose": "Thùng nuc thương mại dùng chứa/vận chuyển đàn ong nhỏ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 13,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Đáy thùng ong kín",
    "purpose": "Làm đáy và cửa vào của thùng ong.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 14,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Đáy thùng ong dạng lưới",
    "purpose": "Tăng thông thoáng và hỗ trợ theo dõi rơi ve Varroa.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 15,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Giá thanh thoáng đáy tổ",
    "purpose": "Tạo không gian và thông thoáng phía dưới vùng cầu.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 16,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Nắp trong thùng ong",
    "purpose": "Lớp nắp trong giữa thùng và nắp ngoài.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 17,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Nắp chụp ngoài telescoping",
    "purpose": "Che mưa nắng cho thùng ong.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 18,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Nắp thùng ong di chuyển",
    "purpose": "Nắp phẳng phù hợp vận chuyển/xếp nhiều thùng.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 19,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Nắp ngoài bằng nhựa",
    "purpose": "Che bảo vệ thùng ong, chống thời tiết.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 20,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Thanh thu hẹp cửa tổ",
    "purpose": "Điều chỉnh kích thước cửa ra vào của đàn ong.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 21,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Lưới/chắn cửa tổ giữ ong chúa",
    "purpose": "Giữ ong chúa và ong đực trong tổ trong một số tình huống quản lý.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Swarm Capture",
    "sourceUrl": "https://www.dadant.com/catalog/tools/swarm-capture"
  },
  {
    "rowNo": 22,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Lưới/chắn chuột cửa tổ",
    "purpose": "Ngăn chuột xâm nhập thùng ong.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 23,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Lưới chống cướp mật",
    "purpose": "Giúp giảm hiện tượng đàn ong khác cướp mật.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 24,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Lưới chắn ong chúa bằng nhựa",
    "purpose": "Ngăn ong chúa đi lên tầng mật.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 25,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Lưới chắn ong chúa bằng kim loại",
    "purpose": "Ngăn ong chúa vào tầng mật, loại bền lâu.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 26,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Giá kê thùng ong",
    "purpose": "Nâng thùng khỏi mặt đất, giảm ẩm và thuận tiện thao tác.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hive Stands",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/hive-accessories/hive-stands/"
  },
  {
    "rowNo": 27,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Dây đai cố định thùng ong",
    "purpose": "Cố định thùng khi vận chuyển hoặc trong gió lớn.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 28,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Kẹp pallet thùng ong",
    "purpose": "Cố định các bộ phận/thùng trên pallet khi di chuyển.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 29,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Lưới bao thùng ong",
    "purpose": "Bao che đàn ong khi vận chuyển hoặc hạn chế ong thoát ra.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 31,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Hộp cách nhiệt/hút ẩm mùa đông",
    "purpose": "Giúp quản lý ẩm và cách nhiệt phía trên tổ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 33,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Khung chêm thùng ong",
    "purpose": "Tạo khoảng trống thêm cho cho ăn/xử lý/quản lý đàn.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 34,
    "categoryName": "Thùng ong & cấu kiện",
    "itemKind": "Dụng cụ",
    "name": "Tầng thông gió",
    "purpose": "Tăng lưu thông không khí trong cụm thùng.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 35,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Khung cầu gỗ cỡ sâu",
    "purpose": "Giữ bánh tổ/nền cầu trong brood box sâu.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 36,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Khung cầu gỗ cỡ trung",
    "purpose": "Khung dùng cho tầng mật cỡ trung.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 37,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Khung cầu cỡ cạn",
    "purpose": "Khung dùng cho tầng mật cạn.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 38,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Khung cầu bằng nhựa",
    "purpose": "Khung ong đúc bằng nhựa dùng nhiều lần.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 39,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Khung cầu lắp sẵn",
    "purpose": "Khung cầu đã hoàn thiện để lắp foundation.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 40,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Khung cầu chưa lắp",
    "purpose": "Bộ thanh khung để người nuôi tự lắp ráp.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 41,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Tấm nền cầu bằng sáp ong",
    "purpose": "Tạo nền ô tổ để ong xây bánh tổ.",
    "management": "Tồn kho",
    "unitLabel": "tấm",
    "lotExpiry": "Tùy",
    "sourceName": "Mann Lake - Hives & Components",
    "sourceUrl": "https://www.mannlakeltd.com/hives-components/"
  },
  {
    "rowNo": 42,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Tấm nền cầu bằng nhựa",
    "purpose": "Tạo nền ô tổ bền, thường phủ sáp.",
    "management": "Tồn kho",
    "unitLabel": "tấm",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 43,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Tấm nền Rite-Cell",
    "purpose": "Dòng foundation nhựa dùng trong khung cầu.",
    "management": "Tồn kho",
    "unitLabel": "tấm",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 44,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Tấm nền Perma-Dent",
    "purpose": "Dòng foundation nhựa thương mại.",
    "management": "Tồn kho",
    "unitLabel": "tấm",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 45,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Tấm nền ô nhỏ",
    "purpose": "Foundation có kích thước ô nhỏ.",
    "management": "Tồn kho",
    "unitLabel": "tấm",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 48,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Dây căng foundation",
    "purpose": "Gia cường tấm foundation trong khung gỗ.",
    "management": "Tồn kho",
    "unitLabel": "cuộn",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools"
  },
  {
    "rowNo": 49,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Khoen đồng khung cầu",
    "purpose": "Bảo vệ lỗ luồn dây trên thanh bên khung.",
    "management": "Tồn kho",
    "unitLabel": "gói",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools"
  },
  {
    "rowNo": 50,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Chốt đỡ foundation",
    "purpose": "Giữ nền cầu ổn định trong khung.",
    "management": "Tồn kho",
    "unitLabel": "gói",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 51,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Đinh lắp thùng/khung ong",
    "purpose": "Lắp ráp cấu kiện gỗ của thùng và khung.",
    "management": "Tồn kho",
    "unitLabel": "hộp",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 52,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Vật tư",
    "name": "Ghim/đinh ghim lắp thùng ong",
    "purpose": "Cố định cấu kiện khung/thùng.",
    "management": "Tồn kho",
    "unitLabel": "hộp",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 53,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Kìm tạo gợn dây khung",
    "purpose": "Làm căng/gợn dây để foundation bám tốt.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 54,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Bánh xe ép dây vào sáp",
    "purpose": "Ép dây khung vào foundation sáp.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 57,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Bẫy/khay thu phấn hoa",
    "purpose": "Thu phấn hoa từ chân ong khi ong vào tổ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 58,
    "categoryName": "Khung cầu & foundation",
    "itemKind": "Dụng cụ",
    "name": "Lưới/bẫy thu keo ong",
    "purpose": "Thu propolis từ đàn ong.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 59,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Dụng cụ nạy thùng ong",
    "purpose": "Nạy nắp, tách cầu và cạo propolis/sáp khi kiểm tra đàn.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Hand Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools/hand-tools"
  },
  {
    "rowNo": 60,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Dụng cụ nạy cầu dạng móc J",
    "purpose": "Móc và nâng khung cầu ra khỏi thùng.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 61,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Dụng cụ nâng và cạo",
    "purpose": "Nâng cấu kiện và cạo sáp/propolis.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 62,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Chổi quét ong",
    "purpose": "Nhẹ nhàng gạt ong khỏi cầu hoặc thiết bị.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Hand Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools/hand-tools"
  },
  {
    "rowNo": 63,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Kẹp gắp khung cầu",
    "purpose": "Kẹp và nâng khung ra khỏi tổ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools"
  },
  {
    "rowNo": 64,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Dụng cụ căn khoảng cách khung",
    "purpose": "Căn đều khoảng cách giữa các cầu.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Hand Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools/hand-tools"
  },
  {
    "rowNo": 65,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Giá treo khung cầu",
    "purpose": "Tạm treo/đỡ cầu khi kiểm tra đàn.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 66,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Bình phun đa dụng",
    "purpose": "Phun nước/siro hoặc dung dịch dùng trong thao tác phù hợp.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 67,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Bình hun khói ong",
    "purpose": "Tạo khói giúp ong dịu hơn khi kiểm tra và thao tác.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools"
  },
  {
    "rowNo": 68,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Bình hun khói Pro-Bellow",
    "purpose": "Bình hun khói có bầu thổi tích hợp.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 69,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Vật tư",
    "name": "Nhiên liệu hun khói bằng cotton",
    "purpose": "Nhiên liệu tiêu hao để tạo khói.",
    "management": "Tồn kho",
    "unitLabel": "gói/kg",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools"
  },
  {
    "rowNo": 70,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Vật tư",
    "name": "Vải bố làm nhiên liệu hun khói",
    "purpose": "Vật liệu cháy tạo khói mát cho smoker.",
    "management": "Tồn kho",
    "unitLabel": "gói/kg",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools"
  },
  {
    "rowNo": 71,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Vật tư",
    "name": "Viên gỗ làm nhiên liệu hun khói",
    "purpose": "Nhiên liệu dạng pellet cho bình hun khói.",
    "management": "Tồn kho",
    "unitLabel": "gói/kg",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 73,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Hộp dụng cụ trại ong",
    "purpose": "Chứa và vận chuyển dụng cụ kiểm tra/chăm sóc ong.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 74,
    "categoryName": "Dụng cụ thao tác & kiểm tra đàn",
    "itemKind": "Dụng cụ",
    "name": "Biển cảnh báo khu vực nuôi ong",
    "purpose": "Cảnh báo người xung quanh về khu vực có ong.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 75,
    "categoryName": "Vận chuyển & di chuyển",
    "itemKind": "Thiết bị",
    "name": "Xe đẩy thùng ong",
    "purpose": "Di chuyển thùng ong nặng trong trại.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Tools",
    "sourceUrl": "https://www.dadant.com/catalog/tools"
  },
  {
    "rowNo": 76,
    "categoryName": "Vận chuyển & di chuyển",
    "itemKind": "Thiết bị",
    "name": "Xe đẩy tầng mật",
    "purpose": "Vận chuyển các honey super/cầu mật.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 78,
    "categoryName": "Vận chuyển & di chuyển",
    "itemKind": "Dụng cụ",
    "name": "Túi lưới vận chuyển nuc",
    "purpose": "Bao nuc khi vận chuyển, tăng thông thoáng và an toàn.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 79,
    "categoryName": "Vận chuyển & di chuyển",
    "itemKind": "Dụng cụ",
    "name": "Lưới vận chuyển ong",
    "purpose": "Che phủ thùng/nuc/package bees khi vận chuyển.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 80,
    "categoryName": "Vận chuyển & di chuyển",
    "itemKind": "Dụng cụ",
    "name": "Thùng/giá mang khung cầu",
    "purpose": "Chứa và vận chuyển các khung cầu.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 81,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Bộ quần áo bảo hộ nuôi ong",
    "purpose": "Bảo vệ toàn thân khi làm việc với đàn ong.",
    "management": "Cá thể",
    "unitLabel": "bộ",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 82,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Bộ bảo hộ thông thoáng",
    "purpose": "Bảo vệ toàn thân với vật liệu thoáng khí.",
    "management": "Cá thể",
    "unitLabel": "bộ",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 83,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Áo bảo hộ kèm lưới che mặt",
    "purpose": "Bảo vệ phần thân trên và đầu.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 84,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Quần bảo hộ nuôi ong",
    "purpose": "Bảo vệ chân khi thao tác trong trại.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 85,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Găng tay da nuôi ong",
    "purpose": "Bảo vệ bàn tay khỏi ong đốt và va quệt.",
    "management": "Cá thể",
    "unitLabel": "đôi",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 87,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Lưới che mặt dạng tròn",
    "purpose": "Bảo vệ mặt/cổ khỏi ong đốt.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 88,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Lưới che mặt kiểu fencing",
    "purpose": "Lưới gắn gần mặt trước, tầm nhìn rộng.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 89,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Lưới che mặt gọn nhẹ",
    "purpose": "Bảo hộ đầu/mặt dạng gấp gọn.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 90,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Mũ nuôi ong",
    "purpose": "Đỡ veil và bảo vệ đầu.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 91,
    "categoryName": "Trang bị bảo hộ",
    "itemKind": "Dụng cụ",
    "name": "Ống tay bảo hộ",
    "purpose": "Bảo vệ cẳng tay khi không mặc suit đầy đủ.",
    "management": "Cá thể",
    "unitLabel": "đôi",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 96,
    "categoryName": "Dụng cụ cho ăn & nước",
    "itemKind": "Dụng cụ",
    "name": "Bình cho ăn Boardman tại cửa tổ",
    "purpose": "Cấp siro từ lọ/bình ở cửa thùng ong.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 97,
    "categoryName": "Dụng cụ cho ăn & nước",
    "itemKind": "Dụng cụ",
    "name": "Máng cho ăn đặt trên thùng",
    "purpose": "Cấp lượng siro lớn phía trên cầu ong.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 98,
    "categoryName": "Dụng cụ cho ăn & nước",
    "itemKind": "Dụng cụ",
    "name": "Máng cho ăn dạng khung",
    "purpose": "Đặt trong thùng ong ở vị trí một khung cầu.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 99,
    "categoryName": "Dụng cụ cho ăn & nước",
    "itemKind": "Dụng cụ",
    "name": "Xô/bình cho ong ăn",
    "purpose": "Cấp siro từ xô có lỗ/van phía trên tổ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 100,
    "categoryName": "Dụng cụ cho ăn & nước",
    "itemKind": "Dụng cụ",
    "name": "Máng cho ăn Pro Feeder",
    "purpose": "Dòng feeder thương mại đặt trong thùng.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 101,
    "categoryName": "Dụng cụ cho ăn & nước",
    "itemKind": "Dụng cụ",
    "name": "Máng cho thức ăn thay thế phấn hoa",
    "purpose": "Cấp thức ăn protein khô/patty tùy thiết kế.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 103,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Đường sucrose",
    "purpose": "Nguyên liệu pha siro bổ sung carbohydrate.",
    "management": "Tồn kho theo lô",
    "unitLabel": "kg",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 104,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Siro đường cho ong",
    "purpose": "Nguồn carbohydrate bổ sung cho đàn.",
    "management": "Tồn kho theo lô",
    "unitLabel": "lít/kg",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 105,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Thức ăn lỏng Pro-Sweet",
    "purpose": "Thức ăn carbohydrate thương mại dạng lỏng.",
    "management": "Tồn kho theo lô",
    "unitLabel": "can/lít",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 106,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Thức ăn mùa đông cho ong",
    "purpose": "Bổ sung năng lượng trong mùa lạnh/thiếu nguồn hoa.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói/kg",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 107,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Kẹo/fondant cho ong",
    "purpose": "Thức ăn rắn carbohydrate dùng khi không phù hợp cấp siro.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói/kg",
    "lotExpiry": "Có",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 108,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Bột thay thế phấn hoa",
    "purpose": "Bổ sung protein khi nguồn phấn tự nhiên hạn chế.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói/kg",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 109,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Bánh thức ăn protein",
    "purpose": "Bổ sung protein đặt trực tiếp trong tổ.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói/kg",
    "lotExpiry": "Có",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 110,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Thức ăn protein Ultra Bee",
    "purpose": "Sản phẩm thay thế phấn hoa thương mại.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói/kg",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 111,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Thức ăn protein Bee-Pro",
    "purpose": "Sản phẩm thay thế phấn hoa thương mại.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói/kg",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 112,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Bánh thức ăn mùa đông",
    "purpose": "Bánh carbohydrate/protein cho thời kỳ lạnh.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 113,
    "categoryName": "Thức ăn & dinh dưỡng",
    "itemKind": "Vật tư",
    "name": "Chất bổ sung dinh dưỡng cho ong",
    "purpose": "Bổ sung dưỡng chất vào khẩu phần ăn.",
    "management": "Tồn kho theo lô",
    "unitLabel": "chai/gói",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 115,
    "categoryName": "Theo dõi sức khỏe & Varroa",
    "itemKind": "Dụng cụ",
    "name": "Bộ kiểm tra ve Varroa",
    "purpose": "Đo/ước tính mức nhiễm Varroa để hỗ trợ quyết định quản lý.",
    "management": "Cá thể hoặc bộ",
    "unitLabel": "bộ",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 116,
    "categoryName": "Theo dõi sức khỏe & Varroa",
    "itemKind": "Dụng cụ",
    "name": "Dụng cụ kiểm tra Varroa EasyCheck",
    "purpose": "Thiết bị cốc/lưới hỗ trợ alcohol wash hoặc kiểm tra ve.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 117,
    "categoryName": "Theo dõi sức khỏe & Varroa",
    "itemKind": "Vật tư",
    "name": "Tấm dính theo dõi ve",
    "purpose": "Đặt dưới đáy lưới để đếm ve rơi.",
    "management": "Tồn kho",
    "unitLabel": "tấm",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 118,
    "categoryName": "Theo dõi sức khỏe & Varroa",
    "itemKind": "Dụng cụ",
    "name": "Khay đếm ve",
    "purpose": "Hỗ trợ theo dõi ve rơi dưới tổ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 122,
    "categoryName": "Theo dõi sức khỏe & Varroa",
    "itemKind": "Vật tư",
    "name": "Dải xử lý Varroa",
    "purpose": "Vật tư điều trị/kiểm soát Varroa theo nhãn và quy định địa phương.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 123,
    "categoryName": "Theo dõi sức khỏe & Varroa",
    "itemKind": "Vật tư",
    "name": "Chế phẩm Varroa nền thymol",
    "purpose": "Chế phẩm kiểm soát Varroa theo hướng dẫn sản phẩm.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 125,
    "categoryName": "Sâu bệnh & sinh vật gây hại",
    "itemKind": "Dụng cụ",
    "name": "Bẫy bọ tổ ong nhỏ",
    "purpose": "Bẫy/giảm số lượng small hive beetle trong tổ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 126,
    "categoryName": "Sâu bệnh & sinh vật gây hại",
    "itemKind": "Dụng cụ",
    "name": "Tấm chắn bọ tổ ong",
    "purpose": "Hạn chế small hive beetle di chuyển/xâm nhập vùng tổ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 127,
    "categoryName": "Sâu bệnh & sinh vật gây hại",
    "itemKind": "Vật tư",
    "name": "Chế phẩm xử lý bọ tổ ong nhỏ",
    "purpose": "Vật tư kiểm soát sinh vật gây hại theo nhãn sản phẩm.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói/chai",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 128,
    "categoryName": "Sâu bệnh & sinh vật gây hại",
    "itemKind": "Vật tư",
    "name": "Chế phẩm kiểm soát bướm sáp",
    "purpose": "Bảo vệ cầu/sáp lưu kho khỏi wax moth theo quy trình phù hợp.",
    "management": "Tồn kho theo lô",
    "unitLabel": "gói/chai",
    "lotExpiry": "Có",
    "sourceName": "Mann Lake - Feeding & Medications",
    "sourceUrl": "https://www.mannlakeltd.com/feeding-medications/"
  },
  {
    "rowNo": 135,
    "categoryName": "Bảo vệ khu nuôi",
    "itemKind": "Dụng cụ",
    "name": "Cuộn dây hàng rào điện",
    "purpose": "Thu/nhả dây hàng rào khi thiết lập khu nuôi.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 138,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Dụng cụ di ấu trùng",
    "purpose": "Chuyển ấu trùng non vào cell cup để gây chúa.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Queen Rearing",
    "sourceUrl": "https://www.dadant.com/catalog/tools/queen-rearing"
  },
  {
    "rowNo": 140,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Thanh gắn chén mũ chúa",
    "purpose": "Giữ các cell cup trong khung gây chúa.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 143,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Lồng ong chúa",
    "purpose": "Giữ/vận chuyển/giới thiệu ong chúa vào đàn.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 145,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Hộp vận chuyển mũ/ong chúa",
    "purpose": "Bảo vệ queen cells/queen cages trong vận chuyển.",
    "management": "Số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 146,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Dụng cụ bắt ong chúa",
    "purpose": "Bắt/giữ ong chúa trong thao tác kiểm tra/đánh dấu.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 147,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Ống bắt ong chúa",
    "purpose": "Bắt và giữ ong chúa bằng ống chuyên dụng.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 149,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Lồng đánh dấu ong chúa",
    "purpose": "Giữ ong chúa an toàn trong lúc đánh dấu.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 150,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Ván Cloake",
    "purpose": "Hỗ trợ quy trình tạo đàn gây chúa/cell builder.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Queen Rearing",
    "sourceUrl": "https://www.dadant.com/catalog/tools/queen-rearing"
  },
  {
    "rowNo": 151,
    "categoryName": "Nuôi ong chúa & nhân giống",
    "itemKind": "Dụng cụ",
    "name": "Ván hai lưới",
    "purpose": "Tách/ghép đàn, hỗ trợ kiểm soát queen rearing và quản lý colony.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Queen Rearing",
    "sourceUrl": "https://www.dadant.com/catalog/tools/queen-rearing"
  },
  {
    "rowNo": 153,
    "categoryName": "Quản lý đàn bay & bắt đàn",
    "itemKind": "Dụng cụ",
    "name": "Bẫy đàn ong bay",
    "purpose": "Tạo vị trí hấp dẫn để bắt đàn ong tách đàn.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 159,
    "categoryName": "Thu hoạch & loại ong khỏi tầng mật",
    "itemKind": "Dụng cụ",
    "name": "Cửa thoát ong một chiều",
    "purpose": "Cho ong rời honey super nhưng hạn chế quay lại.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Honey Processing",
    "sourceUrl": "https://www.dadant.com/catalog/honey-harvesting/honey-processing"
  },
  {
    "rowNo": 160,
    "categoryName": "Thu hoạch & loại ong khỏi tầng mật",
    "itemKind": "Dụng cụ",
    "name": "Tấm đuổi ong khỏi tầng mật",
    "purpose": "Dùng cùng sản phẩm phù hợp để hỗ trợ đưa ong khỏi honey super.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 161,
    "categoryName": "Thu hoạch & loại ong khỏi tầng mật",
    "itemKind": "Dụng cụ",
    "name": "Tấm đuổi ong Turbo",
    "purpose": "Phiên bản fume board hỗ trợ thu hoạch mật.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 163,
    "categoryName": "Thu hoạch & loại ong khỏi tầng mật",
    "itemKind": "Dụng cụ",
    "name": "Dụng cụ mang tầng mật",
    "purpose": "Hỗ trợ vận chuyển honey super sau thu hoạch.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 164,
    "categoryName": "Mở nắp mật",
    "itemKind": "Dụng cụ",
    "name": "Dao mở nắp mật",
    "purpose": "Cắt lớp sáp vít nắp trên bánh mật.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 165,
    "categoryName": "Mở nắp mật",
    "itemKind": "Thiết bị",
    "name": "Dao mở nắp mật chạy điện",
    "purpose": "Gia nhiệt lưỡi dao để cắt nắp sáp nhanh.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Honey Processing",
    "sourceUrl": "https://www.dadant.com/catalog/honey-harvesting/honey-processing"
  },
  {
    "rowNo": 166,
    "categoryName": "Mở nắp mật",
    "itemKind": "Dụng cụ",
    "name": "Nĩa/cào mở nắp mật",
    "purpose": "Mở các vùng ô mật khó cắt bằng dao.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 167,
    "categoryName": "Mở nắp mật",
    "itemKind": "Dụng cụ",
    "name": "Nĩa mở nắp mật",
    "purpose": "Chọc/nâng lớp sáp vít nắp trên cầu mật.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 168,
    "categoryName": "Mở nắp mật",
    "itemKind": "Thiết bị",
    "name": "Bồn/khay mở nắp mật",
    "purpose": "Đỡ cầu khi mở nắp và thu mật/sáp chảy xuống.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 173,
    "categoryName": "Mở nắp mật",
    "itemKind": "Dụng cụ",
    "name": "Giá giữ cầu khi mở nắp",
    "purpose": "Giữ khung cầu ổn định trong công đoạn uncapping.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 174,
    "categoryName": "Quay/tách mật",
    "itemKind": "Thiết bị",
    "name": "Máy quay mật quay tay",
    "purpose": "Dùng lực quay để tách mật khỏi cầu ong.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Honey Extracting Equipment",
    "sourceUrl": "https://www.mannlakeltd.com/extracting-bottling/honey-extracting-equipment/"
  },
  {
    "rowNo": 175,
    "categoryName": "Quay/tách mật",
    "itemKind": "Thiết bị",
    "name": "Máy quay mật chạy điện",
    "purpose": "Tách mật bằng motor, phù hợp quy mô lớn hơn.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Honey Processing",
    "sourceUrl": "https://www.dadant.com/catalog/honey-harvesting/honey-processing"
  },
  {
    "rowNo": 176,
    "categoryName": "Quay/tách mật",
    "itemKind": "Thiết bị",
    "name": "Máy quay mật hướng tâm",
    "purpose": "Xếp cầu theo hướng tâm để tách mật hai mặt.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 177,
    "categoryName": "Quay/tách mật",
    "itemKind": "Thiết bị",
    "name": "Máy quay mật tiếp tuyến",
    "purpose": "Xếp mặt cầu theo tiếp tuyến; thường cần đảo mặt.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 181,
    "categoryName": "Quay/tách mật",
    "itemKind": "Dụng cụ",
    "name": "Chân/giá máy quay mật",
    "purpose": "Nâng và cố định extractor để xả mật thuận tiện.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 184,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Dụng cụ",
    "name": "Lưới/rây lọc mật",
    "purpose": "Loại mảnh sáp và tạp chất thô khỏi mật.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Honey Processing",
    "sourceUrl": "https://www.dadant.com/catalog/honey-harvesting/honey-processing"
  },
  {
    "rowNo": 185,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Vật tư",
    "name": "Vải lọc mật",
    "purpose": "Vật liệu lọc mật trong công đoạn sau quay.",
    "management": "Tồn kho",
    "unitLabel": "mét/tấm",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 186,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Vật tư",
    "name": "Túi lọc mật",
    "purpose": "Túi lọc dùng trong pail/tank/đường ống.",
    "management": "Tồn kho",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Honey Bottling Equipment",
    "sourceUrl": "https://www.mannlakeltd.com/extracting-bottling/honey-bottling-equipment/"
  },
  {
    "rowNo": 187,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Dụng cụ",
    "name": "Giá đỡ bộ lọc xô",
    "purpose": "Đỡ xô/bộ lọc khi lọc mật.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant 2026 Catalog",
    "sourceUrl": "https://www.dadant.com/wp-content/uploads/2026/03/2026_DADANT_CATALOG_Complete_Links.pdf"
  },
  {
    "rowNo": 188,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Thiết bị",
    "name": "Bồn lắng mật",
    "purpose": "Cho bọt/tạp nhẹ nổi lên trước khi đóng chai.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Honey Processing",
    "sourceUrl": "https://www.dadant.com/catalog/honey-harvesting/honey-processing"
  },
  {
    "rowNo": 189,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Thiết bị",
    "name": "Bồn chứa mật",
    "purpose": "Lưu trữ mật sau khai thác trước đóng gói.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Honey Processing",
    "sourceUrl": "https://www.dadant.com/catalog/honey-harvesting/honey-processing"
  },
  {
    "rowNo": 190,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Thiết bị",
    "name": "Bồn đóng chai có gia nhiệt",
    "purpose": "Giữ mật ở nhiệt độ phù hợp để lọc/chiết rót.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Honey Bottling Equipment",
    "sourceUrl": "https://www.mannlakeltd.com/extracting-bottling/honey-bottling-equipment/"
  },
  {
    "rowNo": 191,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Dụng cụ",
    "name": "Van xả mật",
    "purpose": "Van xả kiểm soát dòng mật từ xô/bồn.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Honey Bottling Equipment",
    "sourceUrl": "https://www.mannlakeltd.com/extracting-bottling/honey-bottling-equipment/"
  },
  {
    "rowNo": 192,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Thiết bị",
    "name": "Máy bơm mật",
    "purpose": "Chuyển mật giữa extractor, tank, lọc và đóng chai.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Honey Processing",
    "sourceUrl": "https://www.dadant.com/catalog/honey-harvesting/honey-processing"
  },
  {
    "rowNo": 198,
    "categoryName": "Lọc, chứa & chuyển mật",
    "itemKind": "Dụng cụ",
    "name": "Van đường mật",
    "purpose": "Đóng/mở và điều tiết dòng mật trong bồn/đường ống.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 200,
    "categoryName": "Chiết rót & đóng gói",
    "itemKind": "Thiết bị",
    "name": "Thiết bị chiết rót mật thủ công",
    "purpose": "Định lượng/chiết mật vào chai lọ bằng cơ cấu thủ công.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Dadant - Honey Processing",
    "sourceUrl": "https://www.dadant.com/catalog/honey-harvesting/honey-processing"
  },
  {
    "rowNo": 204,
    "categoryName": "Chiết rót & đóng gói",
    "itemKind": "Dụng cụ",
    "name": "Phới/thìa trộn thực phẩm",
    "purpose": "Khuấy, vét, lấy mẫu mật/sáp trong thao tác nhỏ.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 205,
    "categoryName": "Chiết rót & đóng gói",
    "itemKind": "Thiết bị",
    "name": "Cân điện tử",
    "purpose": "Cân mật, bao bì, vật tư hoặc sản phẩm đóng gói.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 206,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Hũ thủy tinh tròn đựng mật",
    "purpose": "Bao bì bán/lưu trữ mật ong.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 207,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Hũ thủy tinh vuông đựng mật",
    "purpose": "Bao bì thủy tinh hình vuông.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 208,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Hũ Muth đựng mật",
    "purpose": "Hũ thủy tinh kiểu Muth cho mật ong.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 209,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Hũ nhựa đựng mật",
    "purpose": "Bao bì nhựa cho mật ong.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Mann Lake - Honey Bottling Equipment",
    "sourceUrl": "https://www.mannlakeltd.com/extracting-bottling/honey-bottling-equipment/"
  },
  {
    "rowNo": 210,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Chai mật hình gấu",
    "purpose": "Bao bì nhựa dạng squeeze hình gấu.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 211,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Chai bóp nhựa",
    "purpose": "Bao bì tiện rót mật.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 212,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Xô đựng mật",
    "purpose": "Chứa mật khối lượng lớn trước/hoặc sau đóng gói.",
    "management": "Tồn kho hoặc tài sản",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 213,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Can/bình đựng mật",
    "purpose": "Bao bì dung tích lớn cho mật.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 214,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Nắp nhựa chai/hũ",
    "purpose": "Đóng kín bao bì mật ong.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 215,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Nắp kim loại",
    "purpose": "Đóng kín hũ thủy tinh.",
    "management": "Tồn kho theo lô",
    "unitLabel": "cái/thùng",
    "lotExpiry": "Tùy",
    "sourceName": "Betterbee 2025 Catalog",
    "sourceUrl": "https://support.betterbee.com/cat/2025betterbee.pdf"
  },
  {
    "rowNo": 217,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Màng co niêm phong",
    "purpose": "Niêm phong cổ/nắp chai để tăng an toàn sản phẩm.",
    "management": "Tồn kho",
    "unitLabel": "cái/cuộn",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 218,
    "categoryName": "Bao bì mật ong",
    "itemKind": "Vật tư",
    "name": "Tem nhãn mật ong",
    "purpose": "Dán thông tin sản phẩm, thương hiệu, lô.",
    "management": "Tồn kho",
    "unitLabel": "tờ/cuộn",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 224,
    "categoryName": "Xử lý sáp & phụ phẩm",
    "itemKind": "Dụng cụ",
    "name": "Khay/nồi chứa sáp",
    "purpose": "Chứa sáp nóng/chảy khi xử lý.",
    "management": "Cá thể hoặc số lượng",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake 2026 Catalog",
    "sourceUrl": "https://www.mannlakeltd.com/content/Mann%20Lake%20Catalog.pdf"
  },
  {
    "rowNo": 235,
    "categoryName": "Giám sát thông minh & đo lường",
    "itemKind": "Dụng cụ",
    "name": "Khúc xạ kế đo mật",
    "purpose": "Đo độ ẩm/Brix hỗ trợ đánh giá mật trước đóng gói.",
    "management": "Cá thể",
    "unitLabel": "cái",
    "lotExpiry": "Không",
    "sourceName": "Mann Lake - Refractometer",
    "sourceUrl": "https://www.mannlakeltd.com/extracting-bottling/honey-removal-aids/high-quality-metal-refractometer/"
  }
] as const;

type IdRow = QueryResultRow & { id: string };

type SurveyItemType = 'EQUIPMENT' | 'TOOL' | 'MATERIAL';
type SurveyTrackingMode = 'QUANTITY' | 'LOT' | 'ASSET';

function seededInventoryQuantity(code: string, trackingMode: SurveyTrackingMode): string {
  let hash = 0;
  for (const character of code) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  const minimum = trackingMode === 'ASSET' ? 1 : 2;
  const maximum = trackingMode === 'ASSET' ? 20 : 199;
  return String(minimum + (hash % (maximum - minimum + 1)));
}

const surveyUnitSpecs: Record<
  string,
  { code: string; name: string; symbol: string }
> = {
  bộ: { code: 'SET', name: 'Bộ', symbol: 'bộ' },
  cái: { code: 'PIECE', name: 'Cái', symbol: 'cái' },
  cuộn: { code: 'ROLL', name: 'Cuộn', symbol: 'cuộn' },
  tấm: { code: 'SHEET', name: 'Tấm', symbol: 'tấm' },
  gói: { code: 'PACKAGE', name: 'Gói', symbol: 'gói' },
  hộp: { code: 'BOX', name: 'Hộp', symbol: 'hộp' },
  đôi: { code: 'PAIR', name: 'Đôi', symbol: 'đôi' },
  kg: { code: 'KILOGRAM', name: 'Kilôgam', symbol: 'kg' },
  lít: { code: 'LITER', name: 'Lít', symbol: 'l' },
  chai: { code: 'BOTTLE', name: 'Chai', symbol: 'chai' },
  cây: { code: 'ROD', name: 'Cây', symbol: 'cây' },
  mét: { code: 'METER', name: 'Mét', symbol: 'm' },
  can: { code: 'CAN', name: 'Can', symbol: 'can' },
  ống: { code: 'TUBE', name: 'Ống', symbol: 'ống' },
  tờ: { code: 'LEAF', name: 'Tờ', symbol: 'tờ' },
};

const surveyMinStockByUnit: Record<string, string> = {
  bộ: '2',
  cái: '5',
  cuộn: '2',
  tấm: '5',
  gói: '5',
  hộp: '3',
  đôi: '5',
  kg: '5',
  l: '2',
  chai: '3',
  cây: '5',
  m: '10',
  can: '2',
  ống: '3',
  tờ: '20',
};

function surveySlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

function surveyMaterialKind(categoryName: string): string {
  if (categoryName === 'Thức ăn & dinh dưỡng') return 'FEED';
  if (
    categoryName === 'Theo dõi sức khỏe & Varroa' ||
    categoryName === 'Sâu bệnh & sinh vật gây hại'
  ) {
    return 'TREATMENT';
  }
  if (
    categoryName === 'Bao bì mật ong' ||
    categoryName === 'Chiết rót & đóng gói'
  ) {
    return 'PACKAGING';
  }
  if (
    [
      'Bảo vệ khu nuôi',
      'Xử lý sáp & phụ phẩm',
      'Mở nắp mật',
      'Quay/tách mật',
      'Lọc, chứa & chuyển mật',
    ].includes(categoryName)
  ) {
    return 'MAINTENANCE_SUPPLY';
  }
  return 'CONSUMABLE';
}

const surveyCatalog = surveyCatalogSource.map((row) => {
  let itemType: SurveyItemType;
  let trackingMode: SurveyTrackingMode;
  if (row.itemKind === 'Thiết bị') {
    itemType = 'EQUIPMENT';
    trackingMode = 'ASSET';
  } else if (row.itemKind === 'Vật tư') {
    itemType = 'MATERIAL';
    trackingMode =
      row.lotExpiry === 'Có' || row.management.toLowerCase().includes('theo lô')
        ? 'LOT'
        : 'QUANTITY';
  } else {
    itemType = 'TOOL';
    trackingMode = ['Cá thể', 'Cá thể hoặc bộ', 'Cá thể/bộ'].includes(
      row.management,
    )
      ? 'ASSET'
      : 'QUANTITY';
  }

  const unitLabel = row.unitLabel.split('/')[0].trim().toLocaleLowerCase('vi-VN');
  const unit = surveyUnitSpecs[unitLabel];
  if (!unit) {
    throw new Error(`Unsupported survey unit "${row.unitLabel}" at row ${row.rowNo}.`);
  }

  const sourceNote = row.sourceName ? ` Nguồn: ${row.sourceName}.` : '';
  return {
    rowNo: row.rowNo,
    code: `SURV-${String(row.rowNo).padStart(3, '0')}`,
    categoryCode: `SURVEY-${surveySlug(row.categoryName)}`,
    categoryName: row.categoryName,
    name: row.name,
    description: `${row.purpose} Đơn vị khảo sát: ${row.unitLabel}. Cách quản lý đề xuất: ${row.management}.${sourceNote}`,
    unitCode: unit.code,
    unitName: unit.name,
    unitSymbol: unit.symbol,
    minStockLevel:
      itemType === 'MATERIAL' ? surveyMinStockByUnit[unit.symbol] : '0',
    itemType,
    trackingMode,
    materialKind: itemType === 'MATERIAL' ? surveyMaterialKind(row.categoryName) : null,
    sourceUrl: row.sourceUrl,
  };
});

function uuid(key: string): string {
  const chars = createHash('sha256')
    .update(`${NAMESPACE}:${key}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  chars[12] = '4';
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  const value = chars.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function databaseUrl(): string {
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is required in api/.env.');
  const parsed = new URL(process.env.DATABASE_URL);
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Refusing to seed non-local database host "${parsed.hostname}".`,
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed while NODE_ENV=production.');
  }
  console.info(
    `Seeding local database "${parsed.pathname.slice(1)}" on "${parsed.hostname}"...`,
  );
  return process.env.DATABASE_URL;
}

async function id(
  client: PoolClient,
  sql: string,
  values: unknown[],
): Promise<string> {
  const result = await client.query<IdRow>(sql, values);
  if (!result.rows[0]) throw new Error('Seed UPSERT did not return an id.');
  return result.rows[0].id;
}

async function seedTransferFixture(
  client: PoolClient,
  roleIds: Record<string, string>,
  userIds: Record<string, string>,
  categoryIds: Record<string, string>,
  unitIds: Record<string, string>,
) {
  const transferFarmId = await id(
    client,
    `INSERT INTO farms (id,code,name,description,status,created_at,updated_at)
    VALUES ($1,'FARM-TRANSFER','Trại ong Điều Chuyển','Farm mẫu có hai kho và tồn kho để kiểm thử stock transfer.','ACTIVE',$2,$2)
    ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
    RETURNING id`,
    [uuid('farm:transfer'), SEEDED_AT],
  );

  const addMembership = async (key: string, userId: string, roleCode: string) => {
    const memberId = await id(
      client,
      `INSERT INTO farm_members (id,farm_id,user_id,status,joined_at,created_at,updated_at)
      VALUES ($1,$2,$3,'ACTIVE',$4,$4,$4)
      ON CONFLICT (farm_id,user_id) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
      RETURNING id`,
      [uuid(`member:transfer:${key}`), transferFarmId, userId, SEEDED_AT],
    );
    await client.query(
      `INSERT INTO farm_member_roles (farm_member_id,role_id,assigned_at)
      VALUES ($1,$2,$3) ON CONFLICT (farm_member_id,role_id) DO UPDATE SET assigned_at=EXCLUDED.assigned_at`,
      [memberId, roleIds[roleCode], SEEDED_AT],
    );
  };

  await addMembership('seed-owner', userIds.owner, 'FARM_OWNER');
  const clerkUserId = process.env.TRANSFER_TEST_CLERK_USER_ID?.trim();
  if (clerkUserId) {
    const clerkUser = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE auth_provider='CLERK' AND auth_provider_user_id=$1 LIMIT 1`,
      [clerkUserId],
    );
    if (!clerkUser.rows[0]) {
      throw new Error(
        `TRANSFER_TEST_CLERK_USER_ID "${clerkUserId}" was not found in users.`,
      );
    }
    await addMembership('clerk-owner', clerkUser.rows[0].id, 'FARM_OWNER');
  }

  const transferWarehouses: Record<string, string> = {};
  for (const [key, code, name, address] of [
    ['source', 'WH-TRANSFER-SOURCE', 'Kho nguồn điều chuyển', 'Khu tập kết trung tâm'],
    ['target', 'WH-TRANSFER-TARGET', 'Kho đích điều chuyển', 'Khu nuôi thử nghiệm'],
  ]) {
    transferWarehouses[key] = await id(
      client,
      `INSERT INTO warehouses
      (id,farm_id,code,name,address,description,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,'Kho mẫu cho luồng stock transfer.','ACTIVE',$6,$6)
      ON CONFLICT (code,farm_id) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address,
        description=EXCLUDED.description,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
      RETURNING id`,
      [uuid(`warehouse:transfer:${key}`), transferFarmId, code, name, address, SEEDED_AT],
    );
  }

  const transferItemId = await id(
    client,
    `INSERT INTO items
    (id,farm_id,category_id,unit_id,code,name,description,item_type,tracking_mode,min_stock_level,status,created_at,updated_at)
    VALUES ($1,$2,$3,$4,'TRF-MAT-001','Vật tư kiểm thử điều chuyển','Vật tư mẫu dùng riêng cho kiểm thử điều chuyển kho.','MATERIAL','QUANTITY',0,'ACTIVE',$5,$5)
    ON CONFLICT (code,farm_id) DO UPDATE SET category_id=EXCLUDED.category_id,unit_id=EXCLUDED.unit_id,
      name=EXCLUDED.name,description=EXCLUDED.description,item_type=EXCLUDED.item_type,tracking_mode=EXCLUDED.tracking_mode,
      min_stock_level=EXCLUDED.min_stock_level,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
    RETURNING id`,
    [
      uuid('item:transfer:material'),
      transferFarmId,
      categoryIds.MATERIAL,
      unitIds.PIECE,
      SEEDED_AT,
    ],
  );

  await client.query(
    `INSERT INTO inventory_balances
    (id,farm_id,warehouse_id,item_id,lot_id,quantity_on_hand,updated_at)
    VALUES ($1,$2,$3,$4,NULL,25,$5)
    ON CONFLICT (item_id,lot_id,warehouse_id) DO UPDATE SET farm_id=EXCLUDED.farm_id,
      quantity_on_hand=EXCLUDED.quantity_on_hand,updated_at=EXCLUDED.updated_at`,
    [
      uuid('balance:transfer:source:material'),
      transferFarmId,
      transferWarehouses.source,
      transferItemId,
      SEEDED_AT,
    ],
  );
}

async function seed(client: PoolClient) {
  const roleIds: Record<string, string> = {};
  for (const role of [
    ['ADMIN', 'Quản trị viên', 'Quản trị toàn bộ hệ thống.', 'SYSTEM'],
    [
      'FARM_OWNER',
      'Chủ trại',
      'Quản lý toàn bộ hoạt động trong trại ong.',
      'FARM',
    ],
    [
      'EMPLOYEE',
      'Nhân viên',
      'Thực hiện công việc vận hành được giao.',
      'FARM',
    ],
    ['GUEST', 'Khách', 'Chỉ xem dữ liệu được chia sẻ.', 'FARM'],
  ]) {
    roleIds[role[0]] = await id(
      client,
      `
      INSERT INTO roles (id, code, name, description, scope)
      VALUES ($1,$2,$3,$4,$5::role_scope)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, scope=EXCLUDED.scope
      RETURNING id`,
      [uuid(`role:${role[0]}`), ...role],
    );
  }

  const userIds: Record<string, string> = {};
  const users = [
    [
      'admin',
      'seed_admin',
      'admin@nuoi-ong.local',
      'Nguyễn Minh Quản Trị',
      roleIds.ADMIN,
    ],
    [
      'owner',
      'seed_farm_owner',
      'owner@nuoi-ong.local',
      'Trần Thị Chủ Trại',
      null,
    ],
    [
      'employee',
      'seed_employee',
      'employee@nuoi-ong.local',
      'Lê Văn Nhân Viên',
      null,
    ],
    ['guest', 'seed_guest', 'guest@nuoi-ong.local', 'Phạm Gia Khách', null],
  ];
  for (const [key, providerId, email, fullName, systemRoleId] of users) {
    userIds[key!] = await id(
      client,
      `
      INSERT INTO users (id,auth_provider,auth_provider_user_id,email,full_name,system_role_id,status,created_at,updated_at)
      VALUES ($1,'SEED',$2,$3,$4,$5,'ACTIVE',$6,$6)
      ON CONFLICT (auth_provider_user_id) DO UPDATE SET auth_provider=EXCLUDED.auth_provider,email=EXCLUDED.email,
        full_name=EXCLUDED.full_name,system_role_id=EXCLUDED.system_role_id,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
      RETURNING id`,
      [
        uuid(`user:${key}`),
        providerId,
        email,
        fullName,
        systemRoleId,
        SEEDED_AT,
      ],
    );
  }

  const farmId = await id(
    client,
    `
    INSERT INTO farms (id,code,name,description,status,created_at,updated_at)
    VALUES ($1,'FARM-DEMO','Trại ong Hướng Dương','Trại mẫu phục vụ phát triển và kiểm thử local.','ACTIVE',$2,$2)
    ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
    RETURNING id`,
    [uuid('farm:demo'), SEEDED_AT],
  );

  const memberIds: Record<string, string> = {};
  for (const [key, roleCode] of [
    ['admin', 'ADMIN'],
    ['owner', 'FARM_OWNER'],
    ['employee', 'EMPLOYEE'],
    ['guest', 'GUEST'],
  ]) {
    memberIds[key] = await id(
      client,
      `
      INSERT INTO farm_members (id,farm_id,user_id,status,joined_at,created_at,updated_at)
      VALUES ($1,$2,$3,'ACTIVE',$4,$4,$4)
      ON CONFLICT (farm_id,user_id) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
      [uuid(`member:${key}`), farmId, userIds[key], SEEDED_AT],
    );
    await client.query(
      `INSERT INTO farm_member_roles (farm_member_id,role_id,assigned_at) VALUES ($1,$2,$3)
      ON CONFLICT (farm_member_id,role_id) DO UPDATE SET assigned_at=EXCLUDED.assigned_at`,
      [memberIds[key], roleIds[roleCode], SEEDED_AT],
    );
  }

  // Additional auth-context fixtures. Keep the original demo memberships and
  // memberIds unchanged because inventory documents below reference them.
  // Fresh seed: admin/guest have one farm; owner/employee have multiple farms.
  const extraFarmIds: Record<string, string> = {};
  for (const [key, code, name, status] of [
    ['coffee', 'FARM-COFFEE', 'Trại ong Hoa Cà Phê', 'ACTIVE'],
    ['longan', 'FARM-LONGAN', 'Trại ong Nhãn Miền Tây', 'ACTIVE'],
    ['paused', 'FARM-PAUSED', 'Trại ong Tạm Nghỉ', 'INACTIVE'],
  ]) {
    extraFarmIds[key] = await id(
      client,
      `INSERT INTO farms (id,code,name,description,status,created_at,updated_at)
      VALUES ($1,$2,$3,'Trại mẫu kiểm thử chọn trại và phân quyền.',$4::record_status,$5,$5)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,
        status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
      [uuid(`farm:${key}`), code, name, status, SEEDED_AT],
    );
  }

  const extraMemberships = [
    // Different permissions for the same user across farms.
    { user: 'owner', farm: 'coffee', status: 'ACTIVE', roles: ['GUEST'] },
    {
      user: 'owner',
      farm: 'longan',
      status: 'ACTIVE',
      roles: ['FARM_OWNER', 'EMPLOYEE'],
    },
    { user: 'employee', farm: 'coffee', status: 'ACTIVE', roles: ['EMPLOYEE'] },
    // Excluded from auth context: inactive membership or inactive farm.
    {
      user: 'employee',
      farm: 'longan',
      status: 'INACTIVE',
      roles: ['EMPLOYEE'],
    },
    { user: 'owner', farm: 'paused', status: 'ACTIVE', roles: ['FARM_OWNER'] },
  ];
  for (const membership of extraMemberships) {
    const memberId = await id(
      client,
      `INSERT INTO farm_members (id,farm_id,user_id,status,joined_at,created_at,updated_at)
      VALUES ($1,$2,$3,$4::member_status,$5,$5,$5)
      ON CONFLICT (farm_id,user_id) DO UPDATE SET status=EXCLUDED.status,
        updated_at=EXCLUDED.updated_at RETURNING id`,
      [
        uuid(`member:${membership.farm}:${membership.user}`),
        extraFarmIds[membership.farm],
        userIds[membership.user],
        membership.status,
        SEEDED_AT,
      ],
    );
    for (const roleCode of membership.roles) {
      await client.query(
        `INSERT INTO farm_member_roles (farm_member_id,role_id,assigned_at)
        VALUES ($1,$2,$3) ON CONFLICT (farm_member_id,role_id)
        DO UPDATE SET assigned_at=EXCLUDED.assigned_at`,
        [memberId, roleIds[roleCode], SEEDED_AT],
      );
    }
  }

  const categoryIds: Record<string, string> = {};
  for (const row of [
    ['EQUIPMENT', 'Thiết bị'],
    ['TOOL', 'Dụng cụ'],
    ['MATERIAL', 'Vật tư'],
    ['PACKAGING', 'Bao bì'],
  ]) {
    categoryIds[row[0]] = await id(
      client,
      `INSERT INTO categories (id,code,name,description,status,created_at,updated_at)
      VALUES ($1,$2,$3,'Danh mục mẫu phục vụ local.','ACTIVE',$4,$4)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
      [uuid(`category:${row[0]}`), ...row, SEEDED_AT],
    );
  }
  const unitIds: Record<string, string> = {};
  for (const row of [
    ['PIECE', 'Cái', 'cái'],
    ['PAIR', 'Đôi', 'đôi'],
    ['KILOGRAM', 'Kilôgam', 'kg'],
    ['LITER', 'Lít', 'l'],
  ]) {
    unitIds[row[0]] = await id(
      client,
      `INSERT INTO units (id,code,name,symbol,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,'ACTIVE',$5,$5)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,symbol=EXCLUDED.symbol,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
      [uuid(`unit:${row[0]}`), ...row, SEEDED_AT],
    );
  }

  const surveyCategories = [
    ...new Map(
      surveyCatalog.map((row) => [
        row.categoryCode,
        {
          code: row.categoryCode,
          name: row.categoryName,
        },
      ]),
    ).values(),
  ];
  for (const category of surveyCategories) {
    categoryIds[category.code] = await id(
      client,
      `INSERT INTO categories (id,code,name,description,status,created_at,updated_at)
      VALUES ($1,$2,$3,'Danh mục chuẩn hóa từ data_KhaoSat.xlsx.','ACTIVE',$4,$4)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
      RETURNING id`,
      [uuid(`survey-category:${category.code}`), category.code, category.name, SEEDED_AT],
    );
  }

  const surveyUnits = [
    ...new Map(
      surveyCatalog.map((row) => [
        row.unitCode,
        {
          code: row.unitCode,
          name: row.unitName,
          symbol: row.unitSymbol,
        },
      ]),
    ).values(),
  ];
  for (const unit of surveyUnits) {
    unitIds[unit.code] = await id(
      client,
      `INSERT INTO units (id,code,name,symbol,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,'ACTIVE',$5,$5)
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,symbol=EXCLUDED.symbol,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
      RETURNING id`,
      [uuid(`survey-unit:${unit.code}`), unit.code, unit.name, unit.symbol, SEEDED_AT],
    );
  }

  const surveyItemIds = new Map<number, string>();
  for (const row of surveyCatalog) {
    const itemId = await id(
      client,
      `INSERT INTO items
      (id,farm_id,category_id,unit_id,code,name,description,item_type,tracking_mode,min_stock_level,maintenance_interval_days,barcode,source_url,surveyed_at,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::item_type,$9::tracking_mode,$10,NULL,NULL,$11,$12,'ACTIVE',$13,$13)
      ON CONFLICT (code,farm_id) DO UPDATE SET category_id=EXCLUDED.category_id,unit_id=EXCLUDED.unit_id,name=EXCLUDED.name,
        description=EXCLUDED.description,item_type=EXCLUDED.item_type,tracking_mode=EXCLUDED.tracking_mode,
        min_stock_level=CASE WHEN items.min_stock_level=0 THEN EXCLUDED.min_stock_level ELSE items.min_stock_level END,
        source_url=EXCLUDED.source_url,surveyed_at=EXCLUDED.surveyed_at,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
      RETURNING id`,
      [
        uuid(`survey-item:${row.rowNo}`),
        farmId,
        categoryIds[row.categoryCode],
        unitIds[row.unitCode],
        row.code,
        row.name,
        row.description,
        row.itemType,
        row.trackingMode,
        row.minStockLevel,
        row.sourceUrl,
        '2026-08-20T00:00:00.000Z',
        SEEDED_AT,
      ],
    );
    surveyItemIds.set(row.rowNo, itemId);

    if (row.itemType === 'MATERIAL') {
      await client.query(
        `INSERT INTO material_profiles
        (id,farm_id,item_id,kind,requires_expiry_tracking,expiry_warning_days,default_shelf_life_days,storage_instructions,safety_notes,created_at,updated_at)
        VALUES ($1,$2,$3,$4::material_kind,$5,30,NULL,'Theo hướng dẫn bảo quản của nhà cung cấp.','Tuân thủ hướng dẫn an toàn của vật tư.',$6,$6)
        ON CONFLICT (item_id) DO UPDATE SET farm_id=EXCLUDED.farm_id,kind=EXCLUDED.kind,
          requires_expiry_tracking=EXCLUDED.requires_expiry_tracking,storage_instructions=EXCLUDED.storage_instructions,
          safety_notes=EXCLUDED.safety_notes,updated_at=EXCLUDED.updated_at`,
        [
          uuid(`survey-profile:${row.rowNo}`),
          farmId,
          itemId,
          row.materialKind,
          row.trackingMode === 'LOT',
          SEEDED_AT,
        ],
      );
    }
  }

  const supplierId = await id(
    client,
    `INSERT INTO suppliers
    (id,farm_id,code,name,phone,email,address,note,status,created_at,updated_at)
    VALUES ($1,$2,'SUP-DEMO-01','Hợp tác xã Vật tư Ong Việt','0901000001','sales@vattuong.local','Lâm Đồng','Nhà cung cấp mẫu.','ACTIVE',$3,$3)
    ON CONFLICT (code,farm_id) DO UPDATE SET name=EXCLUDED.name,phone=EXCLUDED.phone,email=EXCLUDED.email,address=EXCLUDED.address,
      note=EXCLUDED.note,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
    [uuid('supplier:demo'), farmId, SEEDED_AT],
  );

  const warehouseIds: Record<string, string> = {};
  for (const [key, code, name, address] of [
    ['main', 'WH-MAIN', 'Kho trung tâm', 'Khu điều hành trại'],
    ['field', 'WH-FIELD', 'Kho điểm nuôi số 1', 'Đồi phía Đông'],
  ]) {
    warehouseIds[key] = await id(
      client,
      `INSERT INTO warehouses
      (id,farm_id,code,name,address,description,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,'Kho mẫu phục vụ local.','ACTIVE',$6,$6)
      ON CONFLICT (code,farm_id) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address,description=EXCLUDED.description,
        status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
      [uuid(`warehouse:${key}`), farmId, code, name, address, SEEDED_AT],
    );
  }

  const locationIds: Record<string, string> = {};
  const locations = [
    [
      'main',
      'LOC-MAIN-A',
      'Kệ A - kho trung tâm',
      'WAREHOUSE_ZONE',
      warehouseIds.main,
    ],
    [
      'field',
      'LOC-FIELD-A',
      'Kệ A - kho điểm nuôi',
      'WAREHOUSE_ZONE',
      warehouseIds.field,
    ],
    ['apiary', 'LOC-APIARY-01', 'Bãi ong số 1', 'APIARY', null],
    ['in-use', 'LOC-IN-USE', 'Đang được nhân viên sử dụng', 'IN_USE', null],
    ['maintenance', 'LOC-MAINT', 'Khu bảo trì thiết bị', 'MAINTENANCE', null],
  ];
  for (const [key, code, name, type, warehouseId] of locations) {
    locationIds[key!] = await id(
      client,
      `INSERT INTO locations
      (id,farm_id,warehouse_id,code,name,type,description,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6::location_type,'Vị trí mẫu phục vụ local.','ACTIVE',$7,$7)
      ON CONFLICT (code,farm_id) DO UPDATE SET warehouse_id=EXCLUDED.warehouse_id,name=EXCLUDED.name,type=EXCLUDED.type,
        description=EXCLUDED.description,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
      [
        uuid(`location:${key}`),
        farmId,
        warehouseId,
        code,
        name,
        type,
        SEEDED_AT,
      ],
    );
  }

  const itemIds: Record<string, string> = {};
  const items = [
    [
      'extractor',
      categoryIds.EQUIPMENT,
      unitIds.PIECE,
      'EQ-EXTRACTOR-01',
      'Máy quay mật ong 4 cầu',
      'EQUIPMENT',
      'ASSET',
      '1',
      180,
      '8938500000010',
    ],
    [
      'smoker',
      categoryIds.TOOL,
      unitIds.PIECE,
      'TOOL-SMOKER-01',
      'Bình tạo khói inox',
      'TOOL',
      'ASSET',
      '2',
      90,
      '8938500000027',
    ],
    [
      'feed',
      categoryIds.MATERIAL,
      unitIds.KILOGRAM,
      'MAT-FEED-SUGAR',
      'Đường tinh luyện bổ sung thức ăn',
      'MATERIAL',
      'LOT',
      '30',
      null,
      '8938500000034',
    ],
    [
      'treatment',
      categoryIds.MATERIAL,
      unitIds.LITER,
      'MAT-TREAT-01',
      'Dung dịch vệ sinh thùng ong',
      'MATERIAL',
      'LOT',
      '10',
      null,
      '8938500000041',
    ],
    [
      'gloves',
      categoryIds.MATERIAL,
      unitIds.PAIR,
      'MAT-GLOVES-01',
      'Găng tay bảo hộ',
      'MATERIAL',
      'QUANTITY',
      '50',
      null,
      '8938500000058',
    ],
    [
      'jars',
      categoryIds.PACKAGING,
      unitIds.PIECE,
      'MAT-JAR-500',
      'Hũ thủy tinh 500 ml',
      'MATERIAL',
      'QUANTITY',
      '100',
      null,
      '8938500000065',
    ],
  ];
  for (const [
    key,
    categoryId,
    unitId,
    code,
    name,
    itemType,
    trackingMode,
    minStock,
    maintenanceDays,
    barcode,
  ] of items) {
    itemIds[key as string] = await id(
      client,
      `INSERT INTO items
      (id,farm_id,category_id,unit_id,code,name,description,item_type,tracking_mode,min_stock_level,maintenance_interval_days,barcode,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,'Dữ liệu mặt hàng mẫu.',$7::item_type,$8::tracking_mode,$9,$10,$11,'ACTIVE',$12,$12)
      ON CONFLICT (code,farm_id) DO UPDATE SET category_id=EXCLUDED.category_id,unit_id=EXCLUDED.unit_id,name=EXCLUDED.name,
        description=EXCLUDED.description,min_stock_level=EXCLUDED.min_stock_level,maintenance_interval_days=EXCLUDED.maintenance_interval_days,
        barcode=EXCLUDED.barcode,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at RETURNING id`,
      [
        uuid(`item:${key}`),
        farmId,
        categoryId,
        unitId,
        code,
        name,
        itemType,
        trackingMode,
        minStock,
        maintenanceDays,
        barcode,
        SEEDED_AT,
      ],
    );
  }

  for (const [key, kind, expiry, warning, shelfLife, storage] of [
    ['feed', 'FEED', true, 30, 365, 'Bảo quản khô ráo, kê cao khỏi sàn.'],
    [
      'treatment',
      'TREATMENT',
      true,
      45,
      730,
      'Đậy kín và tránh ánh nắng trực tiếp.',
    ],
    ['gloves', 'CONSUMABLE', false, 30, null, 'Bảo quản sạch và khô.'],
    [
      'jars',
      'PACKAGING',
      false,
      30,
      null,
      'Xếp trên kệ chắc chắn, tránh va đập.',
    ],
  ]) {
    await client.query(
      `INSERT INTO material_profiles
      (id,farm_id,item_id,kind,requires_expiry_tracking,expiry_warning_days,default_shelf_life_days,storage_instructions,safety_notes,created_at,updated_at)
      VALUES ($1,$2,$3,$4::material_kind,$5,$6,$7,$8,'Tuân thủ hướng dẫn an toàn của vật tư.',$9,$9)
      ON CONFLICT (item_id) DO UPDATE SET kind=EXCLUDED.kind,expiry_warning_days=EXCLUDED.expiry_warning_days,
        default_shelf_life_days=EXCLUDED.default_shelf_life_days,storage_instructions=EXCLUDED.storage_instructions,safety_notes=EXCLUDED.safety_notes`,
      [
        uuid(`profile:${key}`),
        farmId,
        itemIds[key as string],
        kind,
        expiry,
        warning,
        shelfLife,
        storage,
        SEEDED_AT,
      ],
    );
  }

  const receiptId = await id(
    client,
    `INSERT INTO stock_receipts
    (id,farm_id,warehouse_id,supplier_id,receipt_code,receipt_date,status,note,created_by_member_id,confirmed_by_member_id,confirmed_at,created_at,updated_at)
    VALUES ($1,$2,$3,$4,'RCV-DEMO-001','2026-08-01','CONFIRMED','Phiếu nhập kho mẫu đầu kỳ.',$5,$5,'2026-08-01T03:30:00Z',$6,$6)
    ON CONFLICT (farm_id,receipt_code) DO UPDATE SET warehouse_id=EXCLUDED.warehouse_id,supplier_id=EXCLUDED.supplier_id,
      status=EXCLUDED.status,note=EXCLUDED.note,confirmed_by_member_id=EXCLUDED.confirmed_by_member_id,confirmed_at=EXCLUDED.confirmed_at,
      updated_at=EXCLUDED.updated_at RETURNING id`,
    [
      uuid('receipt:demo'),
      farmId,
      warehouseIds.main,
      supplierId,
      memberIds.owner,
      SEEDED_AT,
    ],
  );

  const receiptItemIds: Record<string, string> = {};
  for (const [key, quantity, price] of [
    ['extractor', '1', '12500000'],
    ['smoker', '2', '450000'],
    ['feed', '100', '22000'],
    ['treatment', '40', '85000'],
    ['gloves', '200', '18000'],
    ['jars', '300', '12000'],
  ]) {
    const rowId = uuid(`receipt-item:${key}`);
    receiptItemIds[key] = rowId;
    await client.query(
      `INSERT INTO stock_receipt_items (id,stock_receipt_id,item_id,quantity,unit_price,note,created_at)
      VALUES ($1,$2,$3,$4,$5,'Dòng nhập kho mẫu.',$6)
      ON CONFLICT (id) DO UPDATE SET stock_receipt_id=EXCLUDED.stock_receipt_id,item_id=EXCLUDED.item_id,
        quantity=EXCLUDED.quantity,unit_price=EXCLUDED.unit_price,note=EXCLUDED.note`,
      [rowId, receiptId, itemIds[key], quantity, price, SEEDED_AT],
    );
  }

  const lotIds: Record<string, string> = {};
  for (const [key, number, manufactured, expiry, quantity] of [
    ['feed', 'LOT-FEED-2026-08', '2026-07-15', '2027-07-15', '100'],
    ['treatment', 'LOT-TREAT-2026-01', '2026-01-10', '2028-01-10', '40'],
  ]) {
    lotIds[key] = await id(
      client,
      `INSERT INTO inventory_lots
      (id,farm_id,item_id,source_receipt_item_id,lot_number,manufactured_date,expiry_date,initial_quantity,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (farm_id,item_id,lot_number) DO UPDATE SET source_receipt_item_id=EXCLUDED.source_receipt_item_id,
        manufactured_date=EXCLUDED.manufactured_date,expiry_date=EXCLUDED.expiry_date,initial_quantity=EXCLUDED.initial_quantity RETURNING id`,
      [
        uuid(`lot:${key}`),
        farmId,
        itemIds[key],
        receiptItemIds[key],
        number,
        manufactured,
        expiry,
        quantity,
        SEEDED_AT,
      ],
    );
  }

  const assetIds: Record<string, string> = {};
  const assets = [
    [
      'extractor',
      itemIds.extractor,
      receiptItemIds.extractor,
      locationIds.main,
      'AST-EXTRACTOR-001',
      'EXT-2026-0001',
      'AVAILABLE',
      '12500000',
      '2026-08-08',
      '2027-02-04',
    ],
    [
      'smoker-active',
      itemIds.smoker,
      receiptItemIds.smoker,
      locationIds['in-use'],
      'AST-SMOKER-001',
      'SMK-2026-0001',
      'ASSIGNED',
      '450000',
      null,
      '2026-11-01',
    ],
    [
      'smoker-ready',
      itemIds.smoker,
      receiptItemIds.smoker,
      locationIds.main,
      'AST-SMOKER-002',
      'SMK-2026-0002',
      'AVAILABLE',
      '450000',
      null,
      '2026-11-01',
    ],
  ];
  for (const [
    key,
    itemId,
    receiptItemId,
    locationId,
    code,
    serial,
    status,
    price,
    lastMaintenance,
    nextMaintenance,
  ] of assets) {
    assetIds[key as string] = await id(
      client,
      `INSERT INTO assets
      (id,farm_id,item_id,source_receipt_item_id,current_location_id,asset_code,serial_number,qr_token,status,purchase_date,
       purchase_price,warranty_expiry_date,last_maintenance_date,next_maintenance_date,note,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::asset_status,'2026-08-01',$10,'2027-08-01',$11,$12,'Tài sản mẫu.',$13,$13)
      ON CONFLICT (asset_code,farm_id) DO UPDATE SET source_receipt_item_id=EXCLUDED.source_receipt_item_id,serial_number=EXCLUDED.serial_number,
        status=EXCLUDED.status,purchase_price=EXCLUDED.purchase_price,last_maintenance_date=EXCLUDED.last_maintenance_date,
        next_maintenance_date=EXCLUDED.next_maintenance_date,note=EXCLUDED.note,updated_at=EXCLUDED.updated_at RETURNING id`,
      [
        uuid(`asset:${key}`),
        farmId,
        itemId,
        receiptItemId,
        locationId,
        code,
        serial,
        uuid(`qr:${key}`),
        status,
        price,
        lastMaintenance,
        nextMaintenance,
        SEEDED_AT,
      ],
    );
  }

  const issueId = await id(
    client,
    `INSERT INTO stock_issues
    (id,farm_id,warehouse_id,issue_code,issue_date,issue_type,status,reason,note,created_by_member_id,confirmed_by_member_id,confirmed_at,created_at,updated_at)
    VALUES ($1,$2,$3,'ISS-DEMO-001','2026-08-05','CONSUMPTION','CONFIRMED','Cấp vật tư cho đội khai thác','Phiếu xuất mẫu.',$4,$4,'2026-08-05T02:30:00Z',$5,$5)
    ON CONFLICT (farm_id,issue_code) DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,note=EXCLUDED.note,
      confirmed_by_member_id=EXCLUDED.confirmed_by_member_id,confirmed_at=EXCLUDED.confirmed_at,updated_at=EXCLUDED.updated_at RETURNING id`,
    [uuid('issue:demo'), farmId, warehouseIds.main, memberIds.owner, SEEDED_AT],
  );
  for (const [key, quantity] of [
    ['gloves', '20'],
    ['jars', '50'],
  ]) {
    await client.query(
      `INSERT INTO stock_issue_items (id,stock_issue_id,item_id,quantity,note,created_at)
      VALUES ($1,$2,$3,$4,'Vật tư xuất dùng mẫu.',$5) ON CONFLICT (id) DO UPDATE SET quantity=EXCLUDED.quantity,note=EXCLUDED.note`,
      [uuid(`issue-item:${key}`), issueId, itemIds[key], quantity, SEEDED_AT],
    );
  }

  const transferId = await id(
    client,
    `INSERT INTO stock_transfers
    (id,farm_id,from_warehouse_id,to_warehouse_id,transfer_code,transfer_date,status,note,created_by_member_id,confirmed_by_member_id,confirmed_at,created_at,updated_at)
    VALUES ($1,$2,$3,$4,'TRF-DEMO-001','2026-08-06','CONFIRMED','Chuyển thức ăn tới điểm nuôi.',$5,$5,'2026-08-06T02:00:00Z',$6,$6)
    ON CONFLICT (farm_id,transfer_code) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,confirmed_by_member_id=EXCLUDED.confirmed_by_member_id,
      confirmed_at=EXCLUDED.confirmed_at,updated_at=EXCLUDED.updated_at RETURNING id`,
    [
      uuid('transfer:demo'),
      farmId,
      warehouseIds.main,
      warehouseIds.field,
      memberIds.owner,
      SEEDED_AT,
    ],
  );
  await client.query(
    `INSERT INTO stock_transfer_items (id,stock_transfer_id,item_id,lot_id,quantity,note,created_at)
    VALUES ($1,$2,$3,$4,25,'Điều chuyển lô đường mẫu.',$5) ON CONFLICT (id) DO UPDATE SET quantity=EXCLUDED.quantity,note=EXCLUDED.note`,
    [
      uuid('transfer-item:feed'),
      transferId,
      itemIds.feed,
      lotIds.feed,
      SEEDED_AT,
    ],
  );

  const countId = await id(
    client,
    `INSERT INTO stock_counts
    (id,farm_id,warehouse_id,count_code,count_date,status,created_by_member_id,confirmed_by_member_id,confirmed_at,note,created_at,updated_at)
    VALUES ($1,$2,$3,'CNT-DEMO-001','2026-08-10','CONFIRMED',$4,$4,'2026-08-10T09:00:00Z','Thiếu 2 đôi găng tay.',$5,$5)
    ON CONFLICT (count_code,farm_id) DO UPDATE SET status=EXCLUDED.status,confirmed_by_member_id=EXCLUDED.confirmed_by_member_id,
      confirmed_at=EXCLUDED.confirmed_at,note=EXCLUDED.note,updated_at=EXCLUDED.updated_at RETURNING id`,
    [
      uuid('count:demo'),
      farmId,
      warehouseIds.main,
      memberIds.employee,
      SEEDED_AT,
    ],
  );
  for (const [key, lotId, systemQty, actualQty, note] of [
    ['gloves', null, '180', '178', 'Điều chỉnh giảm hàng hỏng.'],
    ['feed', lotIds.feed, '75', '75', 'Khớp hệ thống.'],
  ]) {
    await client.query(
      `INSERT INTO stock_count_items (id,stock_count_id,item_id,lot_id,system_quantity,actual_quantity,note,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET system_quantity=EXCLUDED.system_quantity,
        actual_quantity=EXCLUDED.actual_quantity,note=EXCLUDED.note`,
      [
        uuid(`count-item:${key}`),
        countId,
        itemIds[key!],
        lotId,
        systemQty,
        actualQty,
        note,
        SEEDED_AT,
      ],
    );
  }

  for (const row of [
    [
      'active',
      assetIds['smoker-active'],
      '2026-08-11T01:00:00Z',
      '2026-09-01T10:00:00Z',
      null,
      'ACTIVE',
    ],
    [
      'returned',
      assetIds['smoker-ready'],
      '2026-08-02T01:00:00Z',
      '2026-08-04T10:00:00Z',
      '2026-08-04T08:00:00Z',
      'RETURNED',
    ],
  ]) {
    await client.query(
      `INSERT INTO asset_assignments
      (id,farm_id,asset_id,assigned_to_member_id,assigned_by_member_id,assigned_at,expected_return_at,returned_at,status,note,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::assignment_status,'Phân công tài sản mẫu.',$10,$10)
      ON CONFLICT (id) DO UPDATE SET expected_return_at=EXCLUDED.expected_return_at,returned_at=EXCLUDED.returned_at,
        status=EXCLUDED.status,note=EXCLUDED.note,updated_at=EXCLUDED.updated_at`,
      [
        uuid(`assignment:${row[0]}`),
        farmId,
        row[1],
        memberIds.employee,
        memberIds.owner,
        row[2],
        row[3],
        row[4],
        row[5],
        SEEDED_AT,
      ],
    );
  }

  const resolvedIncidentId = uuid('incident:resolved');
  await client.query(
    `INSERT INTO asset_incidents
    (id,farm_id,asset_id,reported_by_member_id,incident_type,description,severity,status,reported_at,resolved_at,created_at,updated_at)
    VALUES ($1,$2,$3,$4,'MECHANICAL','Tay quay phát tiếng kêu bất thường.','MEDIUM','RESOLVED','2026-08-07T02:00:00Z','2026-08-08T09:00:00Z',$5,$5)
    ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description,severity=EXCLUDED.severity,status=EXCLUDED.status,
      resolved_at=EXCLUDED.resolved_at,updated_at=EXCLUDED.updated_at`,
    [
      resolvedIncidentId,
      farmId,
      assetIds.extractor,
      memberIds.employee,
      SEEDED_AT,
    ],
  );
  await client.query(
    `INSERT INTO asset_incidents
    (id,farm_id,asset_id,reported_by_member_id,incident_type,description,severity,status,reported_at,created_at,updated_at)
    VALUES ($1,$2,$3,$4,'COSMETIC','Tay cầm bình tạo khói hơi lỏng.','LOW','OPEN','2026-08-14T03:00:00Z',$5,$5)
    ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description,severity=EXCLUDED.severity,status=EXCLUDED.status,resolved_at=NULL,updated_at=EXCLUDED.updated_at`,
    [
      uuid('incident:open'),
      farmId,
      assetIds['smoker-ready'],
      memberIds.employee,
      SEEDED_AT,
    ],
  );

  await client.query(
    `INSERT INTO maintenance_records
    (id,farm_id,asset_id,incident_id,maintenance_type,scheduled_at,started_at,completed_at,status,description,result_note,
     performed_by_member_id,supplier_id,labor_cost,material_cost,other_cost,created_at,updated_at)
    VALUES ($1,$2,$3,$4,'CORRECTIVE','2026-08-08T01:00:00Z','2026-08-08T02:00:00Z','2026-08-08T08:30:00Z','COMPLETED',
      'Siết lại cụm truyền động.','Thiết bị hoạt động bình thường.',$5,$6,350000,120000,0,$7,$7)
    ON CONFLICT (id) DO UPDATE SET incident_id=EXCLUDED.incident_id,maintenance_type=EXCLUDED.maintenance_type,
      scheduled_at=EXCLUDED.scheduled_at,started_at=EXCLUDED.started_at,completed_at=EXCLUDED.completed_at,
      status=EXCLUDED.status,description=EXCLUDED.description,result_note=EXCLUDED.result_note,
      performed_by_member_id=EXCLUDED.performed_by_member_id,supplier_id=EXCLUDED.supplier_id,
      labor_cost=EXCLUDED.labor_cost,material_cost=EXCLUDED.material_cost,other_cost=EXCLUDED.other_cost,
      updated_at=EXCLUDED.updated_at`,
    [
      uuid('maintenance:completed'),
      farmId,
      assetIds.extractor,
      resolvedIncidentId,
      memberIds.employee,
      supplierId,
      SEEDED_AT,
    ],
  );
  await client.query(
    `INSERT INTO maintenance_records
    (id,farm_id,asset_id,maintenance_type,scheduled_at,status,description,performed_by_member_id,labor_cost,material_cost,other_cost,created_at,updated_at)
    VALUES ($1,$2,$3,'INSPECTION','2026-09-01T02:00:00Z','SCHEDULED','Kiểm tra định kỳ bình tạo khói.',$4,0,0,0,$5,$5)
    ON CONFLICT (id) DO UPDATE SET maintenance_type=EXCLUDED.maintenance_type,scheduled_at=EXCLUDED.scheduled_at,
      started_at=NULL,completed_at=NULL,status=EXCLUDED.status,description=EXCLUDED.description,
      performed_by_member_id=EXCLUDED.performed_by_member_id,labor_cost=EXCLUDED.labor_cost,
      material_cost=EXCLUDED.material_cost,other_cost=EXCLUDED.other_cost,updated_at=EXCLUDED.updated_at`,
    [
      uuid('maintenance:scheduled'),
      farmId,
      assetIds['smoker-ready'],
      memberIds.employee,
      SEEDED_AT,
    ],
  );

  const maintenanceIssueId = await id(
    client,
    `INSERT INTO stock_issues
    (id,farm_id,warehouse_id,issue_code,issue_date,issue_type,maintenance_record_id,status,reason,note,created_by_member_id,confirmed_by_member_id,confirmed_at,created_at,updated_at)
    VALUES ($1,$2,$3,'ISS-MAINT-001','2026-08-09','MAINTENANCE',$4,'CONFIRMED','Vật tư thay thế trong bảo trì','Phiếu xuất vật tư bảo trì mẫu.',$5,$5,'2026-08-09T03:00:00Z',$6,$6)
    ON CONFLICT (farm_id,issue_code) DO UPDATE SET warehouse_id=EXCLUDED.warehouse_id,issue_type=EXCLUDED.issue_type,
      maintenance_record_id=EXCLUDED.maintenance_record_id,status=EXCLUDED.status,reason=EXCLUDED.reason,note=EXCLUDED.note,
      confirmed_by_member_id=EXCLUDED.confirmed_by_member_id,confirmed_at=EXCLUDED.confirmed_at,updated_at=EXCLUDED.updated_at
    RETURNING id`,
    [
      uuid('issue:maintenance'),
      farmId,
      warehouseIds.main,
      uuid('maintenance:scheduled'),
      memberIds.owner,
      SEEDED_AT,
    ],
  );
  await client.query(
    `INSERT INTO stock_issue_items (id,stock_issue_id,item_id,quantity,note,created_at)
    VALUES ($1,$2,$3,$4,'Vật tư dùng cho bảo trì mẫu.',$5)
    ON CONFLICT (id) DO UPDATE SET quantity=EXCLUDED.quantity,note=EXCLUDED.note`,
    [
      uuid('issue-item:maintenance-gloves'),
      maintenanceIssueId,
      itemIds.gloves,
      '5',
      SEEDED_AT,
    ],
  );

  for (const [key, warehouseId, itemId, lotId, quantity] of [
    ['extractor', warehouseIds.main, itemIds.extractor, null, '1'],
    ['smoker', warehouseIds.main, itemIds.smoker, null, '1'],
    ['feed-main', warehouseIds.main, itemIds.feed, lotIds.feed, '75'],
    ['feed-field', warehouseIds.field, itemIds.feed, lotIds.feed, '25'],
    ['treatment', warehouseIds.main, itemIds.treatment, lotIds.treatment, '40'],
    ['gloves', warehouseIds.main, itemIds.gloves, null, '173'],
    ['jars', warehouseIds.main, itemIds.jars, null, '250'],
  ]) {
    await client.query(
      `INSERT INTO inventory_balances (id,farm_id,warehouse_id,item_id,lot_id,quantity_on_hand,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET quantity_on_hand=EXCLUDED.quantity_on_hand,updated_at=EXCLUDED.updated_at`,
      [
        uuid(`balance:${key}`),
        farmId,
        warehouseId,
        itemId,
        lotId,
        quantity,
        SEEDED_AT,
      ],
    );
  }

  // Keep 25 catalog items without balances so the mobile receipt flow can test
  // receiving stock for items that are not currently in inventory. Distribute
  // the 134 stocked survey items across both demo warehouses evenly: the six
  // base items in WH-MAIN and two existing field items make the final split 71/71.
  const stockedSurveyRows = [
    ...surveyCatalog.slice(0, 65).map((row) => ({ row, warehouseId: warehouseIds.main })),
    ...surveyCatalog.slice(65, 134).map((row) => ({ row, warehouseId: warehouseIds.field })),
  ];
  for (const { row, warehouseId } of stockedSurveyRows) {
    const itemId = surveyItemIds.get(row.rowNo);
    if (!itemId) throw new Error(`Missing survey item for row ${row.rowNo}.`);

    await client.query(
      `INSERT INTO inventory_balances
      (id,farm_id,warehouse_id,item_id,lot_id,quantity_on_hand,updated_at)
      VALUES ($1,$2,$3,$4,NULL,$5,$6)
      ON CONFLICT (id) DO UPDATE SET warehouse_id=EXCLUDED.warehouse_id,lot_id=EXCLUDED.lot_id,
        quantity_on_hand=EXCLUDED.quantity_on_hand,updated_at=EXCLUDED.updated_at`,
      [
        uuid(`balance:survey:${row.rowNo}`),
        farmId,
        warehouseId,
        itemId,
        seededInventoryQuantity(row.code, row.trackingMode),
        SEEDED_AT,
      ],
    );
  }

  const movementId = uuid('movement:feed-transfer');
  const transactions = [
    [
      'receipt-extractor',
      warehouseIds.main,
      itemIds.extractor,
      null,
      assetIds.extractor,
      'RECEIPT',
      '1',
      'STOCK_RECEIPT',
      receiptId,
      null,
    ],
    [
      'receipt-smoker-1',
      warehouseIds.main,
      itemIds.smoker,
      null,
      assetIds['smoker-active'],
      'RECEIPT',
      '1',
      'STOCK_RECEIPT',
      receiptId,
      null,
    ],
    [
      'receipt-smoker-2',
      warehouseIds.main,
      itemIds.smoker,
      null,
      assetIds['smoker-ready'],
      'RECEIPT',
      '1',
      'STOCK_RECEIPT',
      receiptId,
      null,
    ],
    [
      'receipt-feed',
      warehouseIds.main,
      itemIds.feed,
      lotIds.feed,
      null,
      'RECEIPT',
      '100',
      'STOCK_RECEIPT',
      receiptId,
      null,
    ],
    [
      'receipt-treatment',
      warehouseIds.main,
      itemIds.treatment,
      lotIds.treatment,
      null,
      'RECEIPT',
      '40',
      'STOCK_RECEIPT',
      receiptId,
      null,
    ],
    [
      'receipt-gloves',
      warehouseIds.main,
      itemIds.gloves,
      null,
      null,
      'RECEIPT',
      '200',
      'STOCK_RECEIPT',
      receiptId,
      null,
    ],
    [
      'receipt-jars',
      warehouseIds.main,
      itemIds.jars,
      null,
      null,
      'RECEIPT',
      '300',
      'STOCK_RECEIPT',
      receiptId,
      null,
    ],
    [
      'issue-gloves',
      warehouseIds.main,
      itemIds.gloves,
      null,
      null,
      'ISSUE',
      '-20',
      'STOCK_ISSUE',
      issueId,
      null,
    ],
    [
      'issue-jars',
      warehouseIds.main,
      itemIds.jars,
      null,
      null,
      'ISSUE',
      '-50',
      'STOCK_ISSUE',
      issueId,
      null,
    ],
    [
      'maintenance-issue-gloves',
      warehouseIds.main,
      itemIds.gloves,
      null,
      null,
      'MAINTENANCE_ISSUE',
      '-5',
      'STOCK_ISSUE',
      maintenanceIssueId,
      null,
    ],
    [
      'transfer-out',
      warehouseIds.main,
      itemIds.feed,
      lotIds.feed,
      null,
      'TRANSFER_OUT',
      '-25',
      'STOCK_TRANSFER',
      transferId,
      movementId,
    ],
    [
      'transfer-in',
      warehouseIds.field,
      itemIds.feed,
      lotIds.feed,
      null,
      'TRANSFER_IN',
      '25',
      'STOCK_TRANSFER',
      transferId,
      movementId,
    ],
    [
      'adjustment',
      warehouseIds.main,
      itemIds.gloves,
      null,
      null,
      'ADJUSTMENT_OUT',
      '-2',
      'STOCK_COUNT',
      countId,
      null,
    ],
    [
      'assignment',
      warehouseIds.main,
      itemIds.smoker,
      null,
      assetIds['smoker-active'],
      'ASSIGNMENT_OUT',
      '-1',
      'ASSET_ASSIGNMENT',
      uuid('assignment:active'),
      null,
    ],
  ];
  for (const row of transactions) {
    await client.query(
      `INSERT INTO inventory_transactions
      (id,farm_id,warehouse_id,item_id,lot_id,asset_id,transaction_type,quantity_change,source_type,source_id,movement_group_id,performed_by_member_id,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::inventory_transaction_type,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET transaction_type=EXCLUDED.transaction_type,quantity_change=EXCLUDED.quantity_change,
        source_type=EXCLUDED.source_type,source_id=EXCLUDED.source_id,movement_group_id=EXCLUDED.movement_group_id`,
      [
        uuid(`transaction:${row[0]}`),
        farmId,
        ...row.slice(1),
        memberIds.owner,
        SEEDED_AT,
      ],
    );
  }

  for (const [key, userId, action, entityType, entityId, data] of [
    [
      'receipt',
      userIds.owner,
      'CONFIRM',
      'stock_receipt',
      receiptId,
      { status: 'CONFIRMED' },
    ],
    [
      'transfer',
      userIds.owner,
      'CONFIRM',
      'stock_transfer',
      transferId,
      { status: 'CONFIRMED' },
    ],
    [
      'count',
      userIds.employee,
      'CONFIRM',
      'stock_count',
      countId,
      { status: 'CONFIRMED', difference: -2 },
    ],
  ]) {
    await client.query(
      `INSERT INTO audit_logs
      (id,farm_id,user_id,action,entity_type,entity_id,new_data,ip_address,user_agent,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'127.0.0.1','nuoi-ong-local-seed/1.0',$8)
      ON CONFLICT (id) DO UPDATE SET new_data=EXCLUDED.new_data,user_agent=EXCLUDED.user_agent`,
      [
        uuid(`audit:${key}`),
        farmId,
        userId,
        action,
        entityType,
        entityId,
        JSON.stringify(data),
        SEEDED_AT,
      ],
    );
  }

  await seedTransferFixture(client, roleIds, userIds, categoryIds, unitIds);

  return farmId;
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl(), max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      NAMESPACE,
    ]);
    const farmId = await seed(client);
    await client.query('COMMIT');
    const summary = await client.query<{
      table_name: string;
      row_count: string;
    }>(
      `
      SELECT 'roles' table_name,count(*)::text row_count FROM roles WHERE code IN ('ADMIN','FARM_OWNER','EMPLOYEE','GUEST')
      UNION ALL SELECT 'users',count(*)::text FROM users WHERE auth_provider='SEED'
      UNION ALL SELECT 'items',count(*)::text FROM items WHERE farm_id=$1
      UNION ALL SELECT 'survey_core_items',count(*)::text FROM items WHERE farm_id=$1 AND code LIKE 'SURV-%'
      UNION ALL SELECT 'assets',count(*)::text FROM assets WHERE farm_id=$1
      UNION ALL SELECT 'inventory_balances',count(*)::text FROM inventory_balances WHERE farm_id=$1
      UNION ALL SELECT 'inventory_transactions',count(*)::text FROM inventory_transactions WHERE farm_id=$1 ORDER BY table_name`,
      [farmId],
    );
    console.info('Local seed completed successfully.');
    console.table(
      summary.rows.map((row) => ({
        table: row.table_name,
        rows: Number(row.row_count),
      })),
    );
    console.info(
      'Stock transfer fixture ready: FARM-TRANSFER / WH-TRANSFER-SOURCE / WH-TRANSFER-TARGET / TRF-MAT-001.',
    );
    if (process.env.TRANSFER_TEST_CLERK_USER_ID) {
      console.info(
        `Stock transfer fixture membership assigned to Clerk user ${process.env.TRANSFER_TEST_CLERK_USER_ID}.`,
      );
    } else {
      console.info(
        'Set TRANSFER_TEST_CLERK_USER_ID before seeding to assign the fixture farm to a Clerk account.',
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error('Local seed failed. No partial seed data was committed.');
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
