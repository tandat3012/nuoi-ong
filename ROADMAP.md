# Roadmap

Plan from the 2026-11-05 review against the thesis outline (`docs/Đề cương chi tiết CNTT-KLCN289.pdf`, section 6 "Cài đặt chức năng"), due 2026-11-08. An item is checked only after it is finished and verified.

## Stage 1: dashboard over time (rubric 06.3)

- [x] API `GET /dashboard/timeseries`: stock in/out (VND and document count) and purchase + maintenance costs per day, week or month, Vietnam time, warehouse filter; farm admins and warehouse managers only; integration test on PostgreSQL
- [x] `/reports` page (Thống kê): Chart.js bar charts, 7/30 day and 3/12 month presets, custom range, warehouse filter, VND ⇄ document toggle; web tests, tsc and eslint pass
- [x] Demo history seed (`api/scripts/seed-demo-history.ts`): about 13 weeks of documents and maintenance through the real services; seeded production `TRAI-ONG-CHINH` and local `FARM-DEMO` on 2026-11-05
- [x] Check `/reports` in the browser
- [x] PR into `dev` (#128, #129), hotfix synced (#130), released to `main` (#131), `/reports` and product image upload checked on production on 2026-11-05

## Stage 2: stock in/out/balance report per period, with costs (rubric 06.2)

Goal: for a chosen period, show per item how much stock there was at the start, what came in, what went out and what is left (quantity and VND), plus the period's purchase and maintenance costs, and let managers download it. Builds on stage 1: same roles, warehouse filter and Vietnam time.

### Decisions (agreed 2026-11-05)

- [x] Rows: one per item × warehouse, grouped by warehouse with a value subtotal per warehouse and a farm total; lots summed into the item row; rows with no stock and no movement in the period are hidden
- [x] Value: moving weighted average per warehouse. Receipts at their own price; unpriced receipts and upward adjustments at the warehouse's current average, else the item's latest receipt price in the farm, else "no price" (0 VND, flagged); transfers carry the sending warehouse's average; asset returns at the current average. Stage 1 charts switch to the same values
- [x] Screen columns: opening | in (receipts, upward adjustments) | out (issues, downward adjustments incl. lost/retired assets) | transfers ± | asset hand-outs/returns ± (hand-out, return, sent to and back from maintenance) | closing, each with quantity and VND; totals add VND only
- [x] CSV export of what is on screen: one quantity + VND column pair per ledger kind (receipt, transfer in, adjustment up, issue, transfer out, adjustment down, hand-out, return, to maintenance, back from maintenance); `;` separator, `2,5` decimals, UTF-8 with BOM, farm/warehouse/period at the top
- [x] Where: a "Nhập – xuất – tồn" tab on `/reports` under the shared filters and totals; search by name/code and filter by item type; same roles and period presets as stage 1

### Work

- [x] Valuation: moving weighted average per warehouse over the farm's ledger, with unit tests
- [x] API `GET /dashboard/stock-report`: rows per item × warehouse with opening, closing and each ledger kind (quantity and VND) for `dateFrom`..`dateTo` and an optional warehouse; unpriced rows flagged; same roles as `/dashboard/timeseries`
- [x] `/dashboard/timeseries` stock values from the same valuation
- [x] Integration tests: opening + movements = closing, average price across a receipt, issue and transfer, warehouse filter, 400/404; report closing quantity matched `inventory_balances` on local `FARM-DEMO` (0 of 81 differ)
- [x] Web: tabs on `/reports`, grouped table with search, item type filter, subtotals, farm total and unpriced note; costs from the shared totals
- [x] CSV export per the decision above, with logic tests for the table and file formatting
- [ ] Check in the browser on local, then PR into `dev` and release

## Stage 3: farm information (rubric 04.1)

Design not agreed yet.

- [ ] API and screen for farm admins to view and edit the farm's name, address and contact details
