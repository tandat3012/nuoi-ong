import 'dotenv/config';

import { createHash } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const NAMESPACE = 'nuoi-ong-local-seed-v1';
const SEEDED_AT = '2026-08-15T08:00:00.000Z';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

type IdRow = QueryResultRow & { id: string };

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
    ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,description=EXCLUDED.description,result_note=EXCLUDED.result_note,
      labor_cost=EXCLUDED.labor_cost,material_cost=EXCLUDED.material_cost,updated_at=EXCLUDED.updated_at`,
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
    ON CONFLICT (id) DO UPDATE SET scheduled_at=EXCLUDED.scheduled_at,status=EXCLUDED.status,description=EXCLUDED.description,updated_at=EXCLUDED.updated_at`,
    [
      uuid('maintenance:scheduled'),
      farmId,
      assetIds['smoker-ready'],
      memberIds.employee,
      SEEDED_AT,
    ],
  );

  for (const [key, warehouseId, itemId, lotId, quantity] of [
    ['extractor', warehouseIds.main, itemIds.extractor, null, '1'],
    ['smoker', warehouseIds.main, itemIds.smoker, null, '1'],
    ['feed-main', warehouseIds.main, itemIds.feed, lotIds.feed, '75'],
    ['feed-field', warehouseIds.field, itemIds.feed, lotIds.feed, '25'],
    ['treatment', warehouseIds.main, itemIds.treatment, lotIds.treatment, '40'],
    ['gloves', warehouseIds.main, itemIds.gloves, null, '178'],
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
