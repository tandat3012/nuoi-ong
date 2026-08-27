import { relations } from 'drizzle-orm/relations';
import {
  roles,
  users,
  farms,
  farmMembers,
  suppliers,
  warehouses,
  locations,
  categories,
  items,
  units,
  stockReceipts,
  stockReceiptItems,
  inventoryLots,
  assets,
  inventoryBalances,
  stockIssues,
  stockIssueItems,
  stockTransfers,
  stockTransferItems,
  stockCounts,
  stockCountItems,
  assetAssignments,
  assetIncidents,
  maintenanceRecords,
  inventoryTransactions,
  auditLogs,
  farmMemberRoles,
  materialProfiles,
} from './schema';

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.systemRoleId],
    references: [roles.id],
  }),
  farmMembers: many(farmMembers),
  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  farmMemberRoles: many(farmMemberRoles),
}));

export const farmMembersRelations = relations(farmMembers, ({ one, many }) => ({
  farm: one(farms, {
    fields: [farmMembers.farmId],
    references: [farms.id],
  }),
  user: one(users, {
    fields: [farmMembers.userId],
    references: [users.id],
  }),
  stockReceipts_confirmedByMemberId: many(stockReceipts, {
    relationName: 'stockReceipts_confirmedByMemberId_farmMembers_id',
  }),
  stockReceipts_createdByMemberId: many(stockReceipts, {
    relationName: 'stockReceipts_createdByMemberId_farmMembers_id',
  }),
  stockIssues_confirmedByMemberId: many(stockIssues, {
    relationName: 'stockIssues_confirmedByMemberId_farmMembers_id',
  }),
  stockIssues_createdByMemberId: many(stockIssues, {
    relationName: 'stockIssues_createdByMemberId_farmMembers_id',
  }),
  stockTransfers_confirmedByMemberId: many(stockTransfers, {
    relationName: 'stockTransfers_confirmedByMemberId_farmMembers_id',
  }),
  stockTransfers_createdByMemberId: many(stockTransfers, {
    relationName: 'stockTransfers_createdByMemberId_farmMembers_id',
  }),
  stockCounts_confirmedByMemberId: many(stockCounts, {
    relationName: 'stockCounts_confirmedByMemberId_farmMembers_id',
  }),
  stockCounts_createdByMemberId: many(stockCounts, {
    relationName: 'stockCounts_createdByMemberId_farmMembers_id',
  }),
  assetAssignments_assignedByMemberId: many(assetAssignments, {
    relationName: 'assetAssignments_assignedByMemberId_farmMembers_id',
  }),
  assetAssignments_assignedToMemberId: many(assetAssignments, {
    relationName: 'assetAssignments_assignedToMemberId_farmMembers_id',
  }),
  assetIncidents: many(assetIncidents),
  maintenanceRecords: many(maintenanceRecords),
  inventoryTransactions: many(inventoryTransactions),
  farmMemberRoles: many(farmMemberRoles),
}));

export const farmsRelations = relations(farms, ({ many }) => ({
  farmMembers: many(farmMembers),
  suppliers: many(suppliers),
  warehouses: many(warehouses),
  locations: many(locations),
  items: many(items),
  materialProfiles: many(materialProfiles),
  stockReceipts: many(stockReceipts),
  inventoryLots: many(inventoryLots),
  assets: many(assets),
  inventoryBalances: many(inventoryBalances),
  stockIssues: many(stockIssues),
  stockTransfers: many(stockTransfers),
  stockCounts: many(stockCounts),
  assetAssignments: many(assetAssignments),
  assetIncidents: many(assetIncidents),
  maintenanceRecords: many(maintenanceRecords),
  inventoryTransactions: many(inventoryTransactions),
  auditLogs: many(auditLogs),
}));

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  farm: one(farms, {
    fields: [suppliers.farmId],
    references: [farms.id],
  }),
  stockReceipts: many(stockReceipts),
  maintenanceRecords: many(maintenanceRecords),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  farm: one(farms, {
    fields: [warehouses.farmId],
    references: [farms.id],
  }),
  locations: many(locations),
  stockReceipts: many(stockReceipts),
  inventoryBalances: many(inventoryBalances),
  stockIssues: many(stockIssues),
  stockTransfers_fromWarehouseId: many(stockTransfers, {
    relationName: 'stockTransfers_fromWarehouseId_warehouses_id',
  }),
  stockTransfers_toWarehouseId: many(stockTransfers, {
    relationName: 'stockTransfers_toWarehouseId_warehouses_id',
  }),
  stockCounts: many(stockCounts),
  inventoryTransactions: many(inventoryTransactions),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  farm: one(farms, {
    fields: [locations.farmId],
    references: [farms.id],
  }),
  warehouse: one(warehouses, {
    fields: [locations.warehouseId],
    references: [warehouses.id],
  }),
  assets: many(assets),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(categories, {
    fields: [items.categoryId],
    references: [categories.id],
  }),
  farm: one(farms, {
    fields: [items.farmId],
    references: [farms.id],
  }),
  unit: one(units, {
    fields: [items.unitId],
    references: [units.id],
  }),
  materialProfile: one(materialProfiles),
  stockReceiptItems: many(stockReceiptItems),
  inventoryLots: many(inventoryLots),
  assets: many(assets),
  inventoryBalances: many(inventoryBalances),
  stockIssueItems: many(stockIssueItems),
  stockTransferItems: many(stockTransferItems),
  stockCountItems: many(stockCountItems),
  inventoryTransactions: many(inventoryTransactions),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(items),
}));

export const unitsRelations = relations(units, ({ many }) => ({
  items: many(items),
}));

export const materialProfilesRelations = relations(
  materialProfiles,
  ({ one }) => ({
    farm: one(farms, {
      fields: [materialProfiles.farmId],
      references: [farms.id],
    }),
    item: one(items, {
      fields: [materialProfiles.itemId],
      references: [items.id],
    }),
  }),
);

export const stockReceiptsRelations = relations(
  stockReceipts,
  ({ one, many }) => ({
    farmMember_confirmedByMemberId: one(farmMembers, {
      fields: [stockReceipts.confirmedByMemberId],
      references: [farmMembers.id],
      relationName: 'stockReceipts_confirmedByMemberId_farmMembers_id',
    }),
    farmMember_createdByMemberId: one(farmMembers, {
      fields: [stockReceipts.createdByMemberId],
      references: [farmMembers.id],
      relationName: 'stockReceipts_createdByMemberId_farmMembers_id',
    }),
    farm: one(farms, {
      fields: [stockReceipts.farmId],
      references: [farms.id],
    }),
    supplier: one(suppliers, {
      fields: [stockReceipts.supplierId],
      references: [suppliers.id],
    }),
    warehouse: one(warehouses, {
      fields: [stockReceipts.warehouseId],
      references: [warehouses.id],
    }),
    stockReceiptItems: many(stockReceiptItems),
  }),
);

export const stockReceiptItemsRelations = relations(
  stockReceiptItems,
  ({ one, many }) => ({
    item: one(items, {
      fields: [stockReceiptItems.itemId],
      references: [items.id],
    }),
    stockReceipt: one(stockReceipts, {
      fields: [stockReceiptItems.stockReceiptId],
      references: [stockReceipts.id],
    }),
    inventoryLots: many(inventoryLots),
    assets: many(assets),
  }),
);

export const inventoryLotsRelations = relations(
  inventoryLots,
  ({ one, many }) => ({
    farm: one(farms, {
      fields: [inventoryLots.farmId],
      references: [farms.id],
    }),
    item: one(items, {
      fields: [inventoryLots.itemId],
      references: [items.id],
    }),
    stockReceiptItem: one(stockReceiptItems, {
      fields: [inventoryLots.sourceReceiptItemId],
      references: [stockReceiptItems.id],
    }),
    inventoryBalances: many(inventoryBalances),
    stockIssueItems: many(stockIssueItems),
    stockTransferItems: many(stockTransferItems),
    stockCountItems: many(stockCountItems),
    inventoryTransactions: many(inventoryTransactions),
  }),
);

export const assetsRelations = relations(assets, ({ one, many }) => ({
  location: one(locations, {
    fields: [assets.currentLocationId],
    references: [locations.id],
  }),
  farm: one(farms, {
    fields: [assets.farmId],
    references: [farms.id],
  }),
  item: one(items, {
    fields: [assets.itemId],
    references: [items.id],
  }),
  stockReceiptItem: one(stockReceiptItems, {
    fields: [assets.sourceReceiptItemId],
    references: [stockReceiptItems.id],
  }),
  stockIssueItems: many(stockIssueItems),
  stockTransferItems: many(stockTransferItems),
  stockCountItems: many(stockCountItems),
  assetAssignments: many(assetAssignments),
  assetIncidents: many(assetIncidents),
  maintenanceRecords: many(maintenanceRecords),
  inventoryTransactions: many(inventoryTransactions),
}));

export const inventoryBalancesRelations = relations(
  inventoryBalances,
  ({ one }) => ({
    farm: one(farms, {
      fields: [inventoryBalances.farmId],
      references: [farms.id],
    }),
    item: one(items, {
      fields: [inventoryBalances.itemId],
      references: [items.id],
    }),
    inventoryLot: one(inventoryLots, {
      fields: [inventoryBalances.lotId],
      references: [inventoryLots.id],
    }),
    warehouse: one(warehouses, {
      fields: [inventoryBalances.warehouseId],
      references: [warehouses.id],
    }),
  }),
);

export const stockIssuesRelations = relations(stockIssues, ({ one, many }) => ({
  farmMember_confirmedByMemberId: one(farmMembers, {
    fields: [stockIssues.confirmedByMemberId],
    references: [farmMembers.id],
    relationName: 'stockIssues_confirmedByMemberId_farmMembers_id',
  }),
  farmMember_createdByMemberId: one(farmMembers, {
    fields: [stockIssues.createdByMemberId],
    references: [farmMembers.id],
    relationName: 'stockIssues_createdByMemberId_farmMembers_id',
  }),
  farm: one(farms, {
    fields: [stockIssues.farmId],
    references: [farms.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockIssues.warehouseId],
    references: [warehouses.id],
  }),
  stockIssueItems: many(stockIssueItems),
}));

export const stockIssueItemsRelations = relations(
  stockIssueItems,
  ({ one }) => ({
    asset: one(assets, {
      fields: [stockIssueItems.assetId],
      references: [assets.id],
    }),
    item: one(items, {
      fields: [stockIssueItems.itemId],
      references: [items.id],
    }),
    inventoryLot: one(inventoryLots, {
      fields: [stockIssueItems.lotId],
      references: [inventoryLots.id],
    }),
    stockIssue: one(stockIssues, {
      fields: [stockIssueItems.stockIssueId],
      references: [stockIssues.id],
    }),
  }),
);

export const stockTransfersRelations = relations(
  stockTransfers,
  ({ one, many }) => ({
    farmMember_confirmedByMemberId: one(farmMembers, {
      fields: [stockTransfers.confirmedByMemberId],
      references: [farmMembers.id],
      relationName: 'stockTransfers_confirmedByMemberId_farmMembers_id',
    }),
    farmMember_createdByMemberId: one(farmMembers, {
      fields: [stockTransfers.createdByMemberId],
      references: [farmMembers.id],
      relationName: 'stockTransfers_createdByMemberId_farmMembers_id',
    }),
    farm: one(farms, {
      fields: [stockTransfers.farmId],
      references: [farms.id],
    }),
    warehouse_fromWarehouseId: one(warehouses, {
      fields: [stockTransfers.fromWarehouseId],
      references: [warehouses.id],
      relationName: 'stockTransfers_fromWarehouseId_warehouses_id',
    }),
    warehouse_toWarehouseId: one(warehouses, {
      fields: [stockTransfers.toWarehouseId],
      references: [warehouses.id],
      relationName: 'stockTransfers_toWarehouseId_warehouses_id',
    }),
    stockTransferItems: many(stockTransferItems),
  }),
);

export const stockTransferItemsRelations = relations(
  stockTransferItems,
  ({ one }) => ({
    asset: one(assets, {
      fields: [stockTransferItems.assetId],
      references: [assets.id],
    }),
    item: one(items, {
      fields: [stockTransferItems.itemId],
      references: [items.id],
    }),
    inventoryLot: one(inventoryLots, {
      fields: [stockTransferItems.lotId],
      references: [inventoryLots.id],
    }),
    stockTransfer: one(stockTransfers, {
      fields: [stockTransferItems.stockTransferId],
      references: [stockTransfers.id],
    }),
  }),
);

export const stockCountsRelations = relations(stockCounts, ({ one, many }) => ({
  farmMember_confirmedByMemberId: one(farmMembers, {
    fields: [stockCounts.confirmedByMemberId],
    references: [farmMembers.id],
    relationName: 'stockCounts_confirmedByMemberId_farmMembers_id',
  }),
  farmMember_createdByMemberId: one(farmMembers, {
    fields: [stockCounts.createdByMemberId],
    references: [farmMembers.id],
    relationName: 'stockCounts_createdByMemberId_farmMembers_id',
  }),
  farm: one(farms, {
    fields: [stockCounts.farmId],
    references: [farms.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockCounts.warehouseId],
    references: [warehouses.id],
  }),
  stockCountItems: many(stockCountItems),
}));

export const stockCountItemsRelations = relations(
  stockCountItems,
  ({ one }) => ({
    asset: one(assets, {
      fields: [stockCountItems.assetId],
      references: [assets.id],
    }),
    item: one(items, {
      fields: [stockCountItems.itemId],
      references: [items.id],
    }),
    inventoryLot: one(inventoryLots, {
      fields: [stockCountItems.lotId],
      references: [inventoryLots.id],
    }),
    stockCount: one(stockCounts, {
      fields: [stockCountItems.stockCountId],
      references: [stockCounts.id],
    }),
  }),
);

export const assetAssignmentsRelations = relations(
  assetAssignments,
  ({ one }) => ({
    asset: one(assets, {
      fields: [assetAssignments.assetId],
      references: [assets.id],
    }),
    farmMember_assignedByMemberId: one(farmMembers, {
      fields: [assetAssignments.assignedByMemberId],
      references: [farmMembers.id],
      relationName: 'assetAssignments_assignedByMemberId_farmMembers_id',
    }),
    farmMember_assignedToMemberId: one(farmMembers, {
      fields: [assetAssignments.assignedToMemberId],
      references: [farmMembers.id],
      relationName: 'assetAssignments_assignedToMemberId_farmMembers_id',
    }),
    farm: one(farms, {
      fields: [assetAssignments.farmId],
      references: [farms.id],
    }),
  }),
);

export const assetIncidentsRelations = relations(
  assetIncidents,
  ({ one, many }) => ({
    asset: one(assets, {
      fields: [assetIncidents.assetId],
      references: [assets.id],
    }),
    farm: one(farms, {
      fields: [assetIncidents.farmId],
      references: [farms.id],
    }),
    farmMember: one(farmMembers, {
      fields: [assetIncidents.reportedByMemberId],
      references: [farmMembers.id],
    }),
    maintenanceRecords: many(maintenanceRecords),
  }),
);

export const maintenanceRecordsRelations = relations(
  maintenanceRecords,
  ({ one }) => ({
    asset: one(assets, {
      fields: [maintenanceRecords.assetId],
      references: [assets.id],
    }),
    farm: one(farms, {
      fields: [maintenanceRecords.farmId],
      references: [farms.id],
    }),
    assetIncident: one(assetIncidents, {
      fields: [maintenanceRecords.incidentId],
      references: [assetIncidents.id],
    }),
    farmMember: one(farmMembers, {
      fields: [maintenanceRecords.performedByMemberId],
      references: [farmMembers.id],
    }),
    supplier: one(suppliers, {
      fields: [maintenanceRecords.supplierId],
      references: [suppliers.id],
    }),
  }),
);

export const inventoryTransactionsRelations = relations(
  inventoryTransactions,
  ({ one }) => ({
    asset: one(assets, {
      fields: [inventoryTransactions.assetId],
      references: [assets.id],
    }),
    farm: one(farms, {
      fields: [inventoryTransactions.farmId],
      references: [farms.id],
    }),
    item: one(items, {
      fields: [inventoryTransactions.itemId],
      references: [items.id],
    }),
    inventoryLot: one(inventoryLots, {
      fields: [inventoryTransactions.lotId],
      references: [inventoryLots.id],
    }),
    farmMember: one(farmMembers, {
      fields: [inventoryTransactions.performedByMemberId],
      references: [farmMembers.id],
    }),
    warehouse: one(warehouses, {
      fields: [inventoryTransactions.warehouseId],
      references: [warehouses.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  farm: one(farms, {
    fields: [auditLogs.farmId],
    references: [farms.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const farmMemberRolesRelations = relations(
  farmMemberRoles,
  ({ one }) => ({
    farmMember: one(farmMembers, {
      fields: [farmMemberRoles.farmMemberId],
      references: [farmMembers.id],
    }),
    role: one(roles, {
      fields: [farmMemberRoles.roleId],
      references: [roles.id],
    }),
  }),
);
