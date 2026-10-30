import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../src/db/schema';
import { DatabaseService } from '../src/db/database.service';
import { CommerceService } from '../src/modules/commerce/commerce.service';
import { StoreOrdersService } from '../src/modules/store-orders/store-orders.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';
import { StockIssuesService } from '../src/modules/warehouses/stock-issues.service';

export type OrderTestDb = NodePgDatabase<typeof schema>;

export async function seedOrders(db: OrderTestDb) {
  const ids = {
    farm: randomUUID(),
    otherFarm: randomUUID(),
    warehouse: randomUUID(),
    otherWarehouse: randomUUID(),
    location: randomUUID(),
    category: randomUUID(),
    unit: randomUUID(),
    customer: randomUUID(),
    otherCustomer: randomUUID(),
    staff: randomUUID(),
    admin: randomUUID(),
    member: randomUUID(),
    adminMember: randomUUID(),
    storeCategory: randomUUID(),
    product: randomUUID(),
    variant: randomUUID(),
    item: randomUUID(),
  };
  await db.insert(schema.farms).values([
    { id: ids.farm, code: ids.farm, name: 'Order tests' },
    { id: ids.otherFarm, code: ids.otherFarm, name: 'Other farm' },
  ]);
  await db.insert(schema.warehouses).values([
    { id: ids.warehouse, farmId: ids.farm, code: 'SALE', name: 'Sales' },
    { id: ids.otherWarehouse, farmId: ids.farm, code: 'OTHER', name: 'Other' },
  ]);
  await db.insert(schema.locations).values({
    id: ids.location,
    farmId: ids.farm,
    warehouseId: ids.warehouse,
    code: 'SALE',
    name: 'Sales shelf',
    type: 'WAREHOUSE',
  });
  await db.insert(schema.users).values(
    [ids.customer, ids.otherCustomer, ids.staff, ids.admin].map((id) => ({
      id,
      authProvider: 'CLERK',
      authProviderUserId: id,
      email: `${id}@orders.test`,
      fullName: 'Order customer',
    })),
  );
  await db.insert(schema.farmMembers).values([
    { id: ids.member, farmId: ids.farm, userId: ids.staff },
    { id: ids.adminMember, farmId: ids.farm, userId: ids.admin },
  ]);
  const roles = await db
    .insert(schema.roles)
    .values([
      { code: 'EMPLOYEE', name: 'Employee', scope: 'FARM' },
      { code: 'ADMIN', name: 'Admin', scope: 'FARM' },
    ])
    .onConflictDoNothing()
    .returning();
  void roles;
  const [employeeRole] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.code, 'EMPLOYEE'));
  const [adminRole] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.code, 'ADMIN'));
  await db.insert(schema.farmMemberRoles).values([
    { farmMemberId: ids.member, roleId: employeeRole.id },
    { farmMemberId: ids.adminMember, roleId: adminRole.id },
  ]);
  await db
    .insert(schema.categories)
    .values({ id: ids.category, code: ids.category, name: 'Internal' });
  await db
    .insert(schema.units)
    .values({ id: ids.unit, code: `OR-${ids.unit.slice(0, 8)}`, name: 'Unit' });
  await db.insert(schema.items).values({
    id: ids.item,
    farmId: ids.farm,
    categoryId: ids.category,
    unitId: ids.unit,
    code: ids.item,
    name: 'Honey',
    itemType: 'MATERIAL',
    trackingMode: 'QUANTITY',
  });
  await db.insert(schema.inventoryBalances).values({
    farmId: ids.farm,
    warehouseId: ids.warehouse,
    itemId: ids.item,
    quantityOnHand: '10',
  });
  await db
    .insert(schema.storeCategories)
    .values({ id: ids.storeCategory, name: 'Honey', slug: ids.storeCategory });
  await db.insert(schema.storeProducts).values({
    id: ids.product,
    categoryId: ids.storeCategory,
    name: 'Mật ong',
    slug: ids.product,
    status: 'PUBLISHED',
  });
  await db.insert(schema.storeProductVariants).values({
    id: ids.variant,
    productId: ids.product,
    itemId: ids.item,
    name: 'Chai 500ml',
    price: '185000',
    quantityStep: '0.125',
  });
  await db
    .insert(schema.storeSettings)
    .values({ id: 1, warehouseId: ids.warehouse })
    .onConflictDoUpdate({
      target: schema.storeSettings.id,
      set: { warehouseId: ids.warehouse },
    });
  const database = { db } as unknown as DatabaseService;
  const warehouseService = new WarehousesService(database);
  const commerce = new CommerceService(database);
  const service = new StoreOrdersService(database, commerce, warehouseService);
  const issues = new StockIssuesService(database, warehouseService);
  const input = (quantity = 3) => ({
    idempotencyKey: randomUUID(),
    recipientName: 'Khách mua hàng',
    phone: '0901234567',
    address: 'Địa chỉ nhận hàng',
    paymentMethod: 'COD' as const,
    items: [{ variantId: ids.variant, quantity }],
  });
  return { ids, database, service, issues, commerce, input };
}

export async function cleanupOrders(
  db: OrderTestDb,
  ids: Awaited<ReturnType<typeof seedOrders>>['ids'],
) {
  const orders = db
    .select({ id: schema.storeOrders.id })
    .from(schema.storeOrders)
    .where(eq(schema.storeOrders.farmId, ids.farm));
  const issues = db
    .select({ id: schema.stockIssues.id })
    .from(schema.stockIssues)
    .where(eq(schema.stockIssues.farmId, ids.farm));
  await db
    .delete(schema.auditLogs)
    .where(eq(schema.auditLogs.farmId, ids.farm));
  await db
    .delete(schema.inventoryTransactions)
    .where(eq(schema.inventoryTransactions.farmId, ids.farm));
  await db
    .delete(schema.storeOrderItems)
    .where(inArray(schema.storeOrderItems.orderId, orders));
  await db
    .delete(schema.storeOrders)
    .where(eq(schema.storeOrders.farmId, ids.farm));
  await db
    .delete(schema.stockIssueItems)
    .where(inArray(schema.stockIssueItems.stockIssueId, issues));
  await db
    .delete(schema.stockIssues)
    .where(eq(schema.stockIssues.farmId, ids.farm));
  await db
    .delete(schema.storeProductVariants)
    .where(eq(schema.storeProductVariants.productId, ids.product));
  await db
    .delete(schema.storeProducts)
    .where(eq(schema.storeProducts.id, ids.product));
  await db
    .delete(schema.storeCategories)
    .where(eq(schema.storeCategories.id, ids.storeCategory));
  await db
    .delete(schema.inventoryBalances)
    .where(eq(schema.inventoryBalances.farmId, ids.farm));
  await db.delete(schema.items).where(eq(schema.items.id, ids.item));
  await db
    .delete(schema.locations)
    .where(eq(schema.locations.id, ids.location));
  await db
    .delete(schema.warehouses)
    .where(eq(schema.warehouses.farmId, ids.farm));
  await db
    .delete(schema.farmMemberRoles)
    .where(
      inArray(schema.farmMemberRoles.farmMemberId, [
        ids.member,
        ids.adminMember,
      ]),
    );
  await db
    .delete(schema.farmMembers)
    .where(eq(schema.farmMembers.farmId, ids.farm));
  await db
    .delete(schema.users)
    .where(
      inArray(schema.users.id, [
        ids.customer,
        ids.otherCustomer,
        ids.staff,
        ids.admin,
      ]),
    );
  await db
    .delete(schema.stockDocumentCounters)
    .where(
      inArray(schema.stockDocumentCounters.farmId, [ids.farm, ids.otherFarm]),
    );
  await db
    .delete(schema.farms)
    .where(inArray(schema.farms.id, [ids.farm, ids.otherFarm]));
  await db
    .delete(schema.categories)
    .where(eq(schema.categories.id, ids.category));
  await db.delete(schema.units).where(eq(schema.units.id, ids.unit));
}
