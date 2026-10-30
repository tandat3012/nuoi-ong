# Roadmap

Feature plan from the project review on 2026-10-27. An item is checked only after it is finished and verified.

## P0: finish and ship what exists

- [x] Commit the store orders and store products work (migration `0019`, `store-admin`, `store-orders`, checkout, order pages): branch `feature/store-orders`, code only
- [x] Fix the store-orders idempotency integration test that assumes an empty `store_orders` table (local, not committed)
- [x] Restore or replace the deleted auth, farm-access and warehouses unit tests (local, not committed)
- [x] Lot and asset selection in stock count and transfer forms: lots selectable; ASSET items excluded from counts by decision and handled in asset records (PR #70)
- [x] Create/edit screens for suppliers, units, categories and storage locations: shared categories/units ADMIN only (PR #71)
- [x] Dashboard KPIs: stock value, items below minimum, expiring lots, assets in repair, pending approvals, today's orders: stock value = on hand × latest receipt price (PR #72)

## P1: run the business properly

- [ ] Notifications (in-app, plus email/Zalo): low stock, expiring lots, maintenance due, new orders, approval requests, customer order status
- [ ] Purchasing: purchase requests → purchase orders → goods receipt against the order, with supplier price history
- [ ] Scheduled maintenance: recurring schedules per asset and overdue warnings
- [ ] Customer account: profile, saved addresses, reorder, order tracking timeline
- [ ] Payments: VietQR on the bank-transfer screen (order code as transfer note), later automatic payment matching via webhook (e.g. SePay/Casso)
- [ ] Shipping: fee rules by region instead of manual entry; tracking number field
- [ ] Reports: goods in/out/stock balance per period, stock valuation, Excel/PDF export, printable vouchers
- [ ] Audit log of who did what across all documents

## P2: nice to have

- [ ] Promo codes, product reviews, wishlist, related products
- [ ] Returns and refunds, with stock going back into the warehouse
- [ ] Stock levels shown on the storefront
- [ ] Equipment depreciation; batch-printed QR labels
- [ ] Offline-friendly scanning for staff in the field
- [ ] Hive/colony records and honey-harvest batches, tracing a sold jar back to its harvest (if thesis scope allows)
