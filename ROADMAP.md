# Roadmap

Plan from the 2026-11-05 review against the thesis outline (`docs/Đề cương chi tiết CNTT-KLCN289.pdf`, section 6 "Cài đặt chức năng"), due 2026-11-08. An item is checked only after it is finished and verified.

## Stage 1: dashboard over time (rubric 06.3)

- [x] API `GET /dashboard/timeseries`: stock in/out (VND and document count) and purchase + maintenance costs per day, week or month, Vietnam time, warehouse filter; farm admins and warehouse managers only; integration test on PostgreSQL
- [x] `/reports` page (Thống kê): Chart.js bar charts, 7/30 day and 3/12 month presets, custom range, warehouse filter, VND ⇄ document toggle; web tests, tsc and eslint pass
- [x] Demo history seed (`api/scripts/seed-demo-history.ts`): about 13 weeks of documents and maintenance through the real services; seeded production `TRAI-ONG-CHINH` and local `FARM-DEMO` on 2026-11-05
- [x] Check `/reports` in the browser
- [x] PR into `dev` (#128, #129), hotfix synced (#130), released to `main` (#131), `/reports` and product image upload checked on production on 2026-11-05

## Stage 2: stock in/out/balance report per period, with costs (rubric 06.2)

Goal: for a chosen period, show per item how much stock there was at the start, what came in, what went out and what is left (quantity and VND), plus the period's purchase and maintenance costs, and let managers download it. Builds on stage 1: same roles, warehouse filter, Vietnam time and pricing rule.

### Decisions to agree before coding

- [ ] Rows: one per item (warehouses summed) or one per item × warehouse
- [ ] ASSET items: leave them out, or include them and count asset hand-outs/returns and maintenance trips as in/out so that opening + in − out = closing (stage 1 charts leave those moves out)
- [ ] Opening/closing value: quantity × latest priced receipt at the start/end of the period (stage 1 rule), or another valuation
- [ ] In/out split into columns (receipt, issue, transfer, adjustment) or two totals
- [ ] Export format: CSV (no new dependency, opens in Excel) or a real .xlsx file (new library); PDF/print view in scope or not
- [ ] Where: a tab on `/reports` or its own page

### Work

- [ ] API `GET /dashboard/stock-report`: per row opening, in, out, closing (quantity and VND) from the ledger for `dateFrom`..`dateTo` and an optional warehouse; totals; unpriced items flagged; same roles as `/dashboard/timeseries`
- [ ] Integration test: opening + in − out = closing against `inventory_balances` for a period ending today, transfers with and without a warehouse filter, price at the period boundaries
- [ ] Cost summary for the period: purchases (receipt lines) and maintenance (labor, material, other), reusing the stage 1 cost rules
- [ ] Web: report table with item search, totals row and unpriced note; date range and warehouse filter shared with the charts
- [ ] Export of the table (format per decision above), with the period, warehouse and farm in the file
- [ ] Logic tests for any table/export formatting in a `*.logic.ts` module
- [ ] Check in the browser on local, then PR into `dev` and release

## Stage 3: farm information (rubric 04.1)

Design not agreed yet.

- [ ] API and screen for farm admins to view and edit the farm's name, address and contact details
