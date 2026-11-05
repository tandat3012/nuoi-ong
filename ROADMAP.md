# Roadmap

Plan from the 2026-11-05 review against the thesis outline (`docs/Đề cương chi tiết CNTT-KLCN289.pdf`, section 6 "Cài đặt chức năng"), due 2026-11-08. An item is checked only after it is finished and verified.

## Stage 1: dashboard over time (rubric 06.3)

- [x] API `GET /dashboard/timeseries`: stock in/out (VND and document count) and purchase + maintenance costs per day, week or month, Vietnam time, warehouse filter; farm admins and warehouse managers only; integration test on PostgreSQL
- [x] `/reports` page (Thống kê): Chart.js bar charts, 7/30 day and 3/12 month presets, custom range, warehouse filter, VND ⇄ document toggle; web tests, tsc and eslint pass
- [x] Demo history seed (`api/scripts/seed-demo-history.ts`): about 13 weeks of documents and maintenance through the real services; seeded production `TRAI-ONG-CHINH` and local `FARM-DEMO` on 2026-11-05
- [x] Check `/reports` in the browser
- [ ] PR into `dev`, release to `main`, check `/reports` on production

## Stage 2: stock in/out/balance report per period, with costs (rubric 06.2)

Design not agreed yet.

- [ ] Period report per item and warehouse: opening balance, in, out, closing balance (quantity and value)
- [ ] Purchase and maintenance cost totals for the period
- [ ] Excel/CSV export

## Stage 3: farm information (rubric 04.1)

Design not agreed yet.

- [ ] API and screen for farm admins to view and edit the farm's name, address and contact details
