# Quyết định cuối sau bảo trì (P1-05, NV04) — ghi chú cho Mobile

- Duyệt/từ chối yêu cầu bảo trì (`/maintenance-requests/:id/approve|reject`): chỉ ADMIN/FARM_OWNER; quản lý kho giờ nhận 403.
- Kho duyệt nhập lại (`return-receipt/approve`) không còn đưa thiết bị đạt về `AVAILABLE`: tài sản nằm kho nhưng vẫn `MAINTENANCE` cho tới khi ADMIN/FARM_OWNER gọi `POST /maintenance-records/:id/final-decision/reuse` (→ `AVAILABLE`) hoặc `/final-decision/hold` với `note` bắt buộc (→ `DAMAGED`).
- Hồ sơ bảo trì có thêm `finalDecision` (`REUSE` | `HOLD` | null), `finalDecisionNote`, `finalDecidedByMemberId`, `finalDecidedAt`. Màn chi tiết nên hiện "Chờ chủ trại quyết định cho dùng lại" khi `status = COMPLETED`, `returnStatus = CONFIRMED`, `finalDecision = null`.
