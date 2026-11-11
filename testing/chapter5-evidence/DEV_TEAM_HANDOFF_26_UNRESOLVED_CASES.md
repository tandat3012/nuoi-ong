# KLCN289 — Bàn giao các lượt kiểm thử chưa khép lại cho nhóm Dev

## Phạm vi và cách đếm

File này bàn giao **26 Test Case ID cần Dev chạy lại hoặc hoàn tất**. Cách tính: 20 ca `Not Run` (16 nghiệp vụ + 4 UI/UX), 4 ca nghiệp vụ chạy một phần, 1 ca `Blocked`, và 1 ca từng được ghi PASS trong trao đổi nhưng không tìm thấy bằng chứng runtime đã lưu. Không loại ca khó và không đếm trùng ID.

Khi đối chiếu thư mục evidence, có **14 ca PASS xác minh được bằng log**. Trạng thái trước đó ghi 15 PASS; riêng `TC-AUTH-005` không có log/evidence tương ứng trong workspace nên được giữ trong danh sách Dev cần xác minh lại, không tính là PASS đã khóa. Phân loại đầy đủ hiện tại: 14 PASS có bằng chứng, 1 PASS được báo cáo nhưng thiếu evidence, 4 PARTIAL, 1 BLOCKED, 20 NOT RUN = 40 ca. Không xóa/sửa lịch sử; mọi lượt Dev chạy lại phải được thêm riêng.

## Build và môi trường được phép

- Repository `nuoi-ong`, branch `dev`, SHA tham chiếu `c9b30228e418efb8c8af0573deb04099397920a6`.
- API QA: `http://127.0.0.1:5050`.
- Chỉ PostgreSQL QA `127.0.0.1:55432/nuoi_ong_test_utf8`, role `klcn289_test`, UTF8. 50 migration và 51 bảng đã có; **không chạy migration lại**.
- Chỉ Clerk Development và tài khoản synthetic. Không để lộ key, token, cookie, mật khẩu hay URL chứa credential.
- Web QA dự kiến `http://localhost:3000`; dùng `testing/chapter5-evidence/scripts/start-web-qa.mjs`. Helper vừa được đổi bind host sang `localhost` vì Web log báo proxy tới `localhost:3000` trong khi server chỉ bind `127.0.0.1`. Server cũ cần dừng bằng Ctrl+C rồi khởi động lại. Trước đó static favicon trả 200, nhưng route động `/`, `/about`, `/sign-in` bị treo/Internal Server Error; chưa có UI ca nào chạy.
- Không dùng PostgreSQL 5432/5435, production, dữ liệu khách hàng thật hoặc cổng thanh toán thật. Không migration, reset, truncate, drop hoặc xóa dữ liệu. Không tắt auth/role guard.
- Mỗi ca phải bắt đầu bằng snapshot DB hiện thời; fixture đã biến động do các ca PASS trước đó. Tạo fixture riêng theo run tag; nếu lần trước timeout/ghi dở thì kiểm tra trước khi thử lại.
- Ghi SHA thực tế của Dev build. Nếu khác SHA tham chiếu, không gán kết quả cho SHA cũ.
- PASS chỉ khi đã chạy toàn bộ Expected Result và có evidence kiểm tra được. Smoke check, source review, fixture setup và automated unit tests không phải PASS nghiệp vụ.

### Hồ sơ môi trường local hiện tại (`feature/warehouse` — bổ sung 2026-11-11)

> **Lưu ý tách biệt hồ sơ:** Giữ nguyên toàn bộ thông số nền `dev@c9b30228e418efb8c8af0573deb04099397920a6`, DB QA `55432`, bảng 14 ca `PASS` và Expected Result gốc ở trên. Hồ sơ dưới đây mô tả đúng môi trường local đang chạy thực tế trên máy để chạy riêng các lượt kiểm thử Mobile trên nhánh `feature/warehouse` (không gán kết quả của hồ sơ này cho build `dev`).

- **Repository / Branch / SHA thực tế:** `nuoi-ong`, branch `feature/warehouse`, `HEAD` = `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` (working tree có 284 thay đổi/untracked chưa commit ở `api/`, `mobile/`, `web/`).
- **Database local test:** PostgreSQL Docker container `nuoi-ong-db-local` tại `127.0.0.1`, cổng `5436`, database `nuoi_ong_local` (cấu hình trong `api/.env`). Không chạy migration, reset, seed hoặc truncate nếu chưa được phê duyệt.
- **API & Web local:** API chạy tại `http://127.0.0.1:5050` (truy cập qua LAN cho Mobile: `http://192.168.2.14:5050/api/v1`); Web chạy tại `http://localhost:3000` (`web/.env.local` trỏ `NEXT_PUBLIC_API_URL=http://localhost:5050`).
- **Mobile runtime (Metro / Dev Client):** Metro `expo start` cổng `8081`. Trong `mobile/src/shared/api/client.ts` (`resolveApiBaseUrl`), khi chạy `__DEV__` qua Metro LAN, app tự lấy IP host của Metro (`192.168.2.14`) ghép với `EXPO_PUBLIC_API_PORT=5050` (`http://192.168.2.14:5050/api/v1`), thay cho fallback IP cũ `172.31.98.42:5050` trong `mobile/.env`.
- **Auth:** Clerk Development; không in token, mật khẩu, Clerk key hoặc connection string trong log/evidence.
- **Thư mục hồ sơ & bằng chứng cho lượt `feature/warehouse`:**
  - Case records: [UIUX-MOB-006](cases/UIUX-MOB-006.md), [UIUX-MOB-009](cases/UIUX-MOB-009.md)
  - Execution Log: [EXECUTION_LOG](EXECUTION_LOG.md)
  - Logs & Screenshots: `testing/chapter5-evidence/logs/feature-warehouse-mobile-2026-11-11/` và `testing/chapter5-evidence/screenshots/feature-warehouse-mobile-2026-11-11/`

## Fixture / role đã có

| Alias synthetic | Quyền/ghi chú |
|---|---|
| `AUTH-U1` | Employee Farm A; có Store Manager riêng ở Farm B sau NV08-004. Phải xác minh context từng Farm. |
| `AUTH-U3` | Warehouse Manager Farm A; Employee Farm B; warehouse scope khác theo Farm. |
| `AUTH-U4` | Farm Owner Farm A. |
| `FARM-B-OWNER` | Farm Owner Farm B. |
| `MAINTENANCE-STAFF` | MAINTENANCE_STAFF Farm A; dùng làm coordinator theo quyết định nhóm. Không suy rộng quyền xuất/nhận/final decision. |
| `STORE-MANAGER` | STORE_MANAGER Farm A; không mặc nhiên được sửa giá/danh mục chung. |
| `SYSTEM-ADMIN` | System ADMIN hiện chưa có Farm membership; không dùng thay FARM_OWNER nếu chưa chốt quyền. |

Farm A/B và kho/vị trí QA đã tồn tại. NV08-004 đã tạo membership Farm B riêng cho U1, không ghi đè Farm A. Không giả định tồn đầu ca là giá trị ban đầu trong Test Case: đọc pre-state thực tế và dùng fixture mới có run tag.

## Các ca đã khép lại — giữ kết quả và evidence

Các ca dưới đây không cần chạy lại mặc định. Retest chỉ khi build/fixture khác làm mất khả năng so sánh hoặc có bug fix liên quan. Một số ca có lần thử đầu thất bại do harness/đối chiếu sai; giữ cả log đầu và lần kiểm tra lại PASS.

| Test Case ID | Kết quả đã xác minh | Evidence runtime đã lưu |
|---|---|---|
| `TC-NV01-031` | PASS | [API receipt run](logs/api-stock-receipts-2026-11-11-1309.redacted.json) |
| `TC-NV01-032` | PASS sau read-only retest; lần harness đầu được giữ trong lịch sử | [Receipt/asset run](logs/api-nv01-lot-asset-2026-11-11-1335.redacted.json), [read-only retest](logs/nv01-032-readonly-retest-2026-11-11-1322.redacted.json) |
| `TC-NV01-034` | PASS | [Receipt/asset run](logs/api-nv01-lot-asset-2026-11-11-1335.redacted.json) |
| `TC-NV01-045` | PASS | [Rollback run](logs/nv01-rollback-2026-11-11-1338.redacted.json) |
| `TC-NV01-049` | PASS | [API receipt run](logs/api-stock-receipts-2026-11-11-1309.redacted.json) |
| `TC-NV02-017` | PASS | [Issue confirmation run](logs/nv02-issue-confirm-2026-11-11-1325.redacted.json) |
| `TC-NV02-046` | PASS | [Return run, final attempt](logs/nv02-046-047-2026-11-11T07-01-37-573Z.redacted.json) |
| `TC-NV02-047` | PASS | [Return run, final attempt](logs/nv02-046-047-2026-11-11T07-01-37-573Z.redacted.json) |
| `TC-NV04-004` | PASS sau read-only retest; giữ cả các lần thử trước | [Initial attempts](logs/nv04-004-2026-11-11T07-08-24-656Z.redacted.json), [follow-up attempt](logs/nv04-004-2026-11-11T07-09-41-301Z.redacted.json), [read-only retest](logs/nv04-004-readonly-retest-2026-11-11T07-13-20-287Z.redacted.json) |
| `TC-NV04-006` | PASS | [Maintenance return run](logs/nv04-006-2026-11-11T07-22-08-745Z.redacted.json) |
| `TC-NV07-004` | PASS sau read-only retest; lần đầu harness báo sai và được giữ | [Initial run](logs/nv07-004-2026-11-11T07-42-29-337Z.redacted.json), [read-only retest](logs/nv07-004-readonly-retest-2026-11-11T07-43-32-468Z.redacted.json) |
| `TC-NV08-004` | PASS sau read-only retest; lần đầu harness báo sai và được giữ | [Initial run](logs/nv08-004-2026-11-11T07-47-37-601Z.redacted.json), [read-only retest](logs/nv08-004-readonly-retest-2026-11-11T07-48-30-361Z.redacted.json) |
| `TC-NV09-001` | PASS sau retest; lần đầu thất bại do đối chiếu harness và được giữ | [Initial run](logs/nv09-001-2026-11-11T07-03-41-993Z.redacted.json), [retest](logs/nv09-001-retest-2026-11-11T07-05-46-844Z.redacted.json) |
| `TC-NV10-005` | PASS sau lần chạy lại; giữ lần blocked trước | [Initial attempt](logs/nv10-005-2026-11-11T06-52-23-188Z.redacted.json), [successful run](logs/nv10-005-2026-11-11T06-55-01-972Z.redacted.json) |

`TC-AUTH-005` không nằm trong bảng PASS đã xác minh vì chưa tìm thấy artifact có ID này. Dev chạy lại và lưu HTTP/API evidence cùng kiểm tra không lộ dữ liệu Farm ngoài membership.

## A. Năm ca nghiệp vụ cần xác minh hoặc hoàn tất

### 1. TC-AUTH-005 — Kiểm tra chéo membership Farm (reported PASS, evidence thiếu)

- **Tình trạng:** Trạng thái trước đó có ghi PASS, nhưng không tìm thấy log/hồ sơ runtime mang ID này trong workspace. Hãy chạy lại đầy đủ và ghi evidence; không kế thừa PASS cũ khi chưa có chứng cứ.
- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md), [case record](cases/TC-AUTH-005.md).
- **Fixture/steps:** Actor chỉ có membership Farm A; tạo/đọc một record synthetic thuộc Farm B bằng API trực tiếp; thử endpoint/list query trái membership theo Test Case nguồn.
- **Expected:** API không trả nội dung/aggregate Farm B, request trái quyền bị từ chối theo hợp đồng và không tạo business audit thành công. Lưu pre/post DB read-only evidence.

### 2. TC-AUTH-001 — Đăng nhập và nạp membership hiện hành

- **Đã có:** API probe từng bị 401 do JWT `nbf` lệch giờ; một phiên sau trả HTTP 200 nhưng không chạy sign-in trên Web/đọc lại UI đầy đủ. Giữ tất cả lần chạy cũ.
- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L27), [case record](cases/TC-AUTH-001.md), [partial API evidence](logs/auth-api-session-2026-11-11-1311.redacted.json).
- **Fixture/steps còn thiếu:** Đồng hồ đồng bộ, Clerk Development session mới; AUTH-U1 active Employee Farm A. Mở `/sign-in`, đăng nhập, xác nhận user/Farm A, gọi API đọc được trong scope.
- **Expected:** Phiên hợp lệ; đúng user/membership; API được phép đọc; không lộ credential. Ghi lại phần Web mới thành retest riêng.
- **Evidence:** Ảnh sign-in đã che dữ liệu nhạy cảm; API request/response đã che token; DB read-only membership check.

### 3. TC-AUTH-004 — Chuyển Farm không giữ dữ liệu Farm trước

- **Đã có:** API scope retest đạt; Farm switcher và client state trên Web chưa kiểm tra.
- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L75), [case record](cases/TC-AUTH-004.md), [backend retest](logs/auth-farm-scope-retest-2026-11-11-1318.redacted.json).
- **Fixture/steps còn thiếu:** AUTH-U1 có membership riêng A/B, dữ liệu synthetic phân biệt; Web sign-in, chọn A, chuyển B, refresh, thử mở ID chỉ thuộc A trong B context.
- **Expected:** Request/UI dùng Farm B; dữ liệu A không còn trong UI; direct read ID A bị từ chối/không tìm thấy theo hợp đồng và không trả nội dung A.
- **Evidence:** Ảnh trước/sau switch, network log che token, read-only DB mapping Farm/record.

### 4. TC-AUTH-006 — STORE_MANAGER không sửa catalog chung

- **Đã có:** Negative API patch của Store Manager được từ chối và catalog không đổi; positive ADMIN và action đơn hàng được phép chưa chạy.
- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L107), [case record](cases/TC-AUTH-006.md), [negative API evidence](logs/auth-store-catalog-2026-11-11-1330.redacted.json).
- **Fixture/steps còn thiếu:** Dùng actor ADMIN đúng phạm vi đã được nhóm chốt để kiểm tra update phí/catalog; dùng Store Manager thử action đơn hàng được phép và thử lại action bị cấm qua UI/API.
- **Expected:** Chỉ role hợp lệ sửa catalog/giá; Store Manager bị từ chối và không đổi dữ liệu/audit; action đơn hàng được phép vẫn hoạt động.
- **Pending:** System ADMIN không có Farm membership. Hỏi nhóm liệu ADMIN cần membership hay có quyền xuyên Farm; không tự thêm membership/role để làm PASS.
- **Evidence:** API responses, catalog/audit before-after, UI screenshot và action order positive control.

### 5. TC-NV04-011 — Coordinator tạo lịch trực tiếp

- **Đã có:** API/DB phần chính đạt: MAINTENANCE_STAFF tạo lịch trực tiếp, Employee bị từ chối; tồn/lifecycle/ledger không đổi. Web readback còn thiếu.
- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L1680), [case record](cases/TC-NV04-011.md), [API+DB evidence](logs/maintenance-schedule-2026-11-11-1325.redacted.json).
- **Bước còn thiếu:** Mở `/maintenance` ở đúng Farm, refresh list/detail và so khớp record, ASSET, lịch, mô tả, trạng thái SCHEDULED với API/DB. Không gọi issue/receive/final-decision.
- **Expected:** Web đọc đúng lịch; tạo lịch không đổi lifecycle/balance/ledger, không tạo phiếu xuất. Giữ evidence API/DB cũ và thêm lượt Web riêng.
- **Evidence:** Ảnh Web list/detail, API/DB readback, SHA/build và thời điểm.

## B. Mười sáu ca nghiệp vụ chưa chạy

### 6. TC-NV02-004 — Nhận thiếu, chênh lệch còn mở

- **Nguồn:** [ca Chương 5](../../KLCN289_CHUONG5_15_TEST_CASES_MINH_HOA.md#L105), [case record](cases/TC-NV02-004.md).
- **Fixture/steps:** Transfer QUANTITY/LOT mới; xuất 10 ở nguồn, đích nhận 7 và ghi lý do thiếu 3; đọc trạng thái, balance và ledger.
- **Expected:** Nguồn giảm 10, đích chỉ tăng 7 một lần; thiếu 3/lý do còn mở; phiếu không được coi là hoàn tất. Không tự đặt tên enum nếu nhóm/UML chưa chốt.
- **Evidence/dependency:** API request/response, balances/ledger/audit trước-sau. Nếu nhãn trạng thái chưa chốt thì ghi Requirement Pending cho nhãn; không suy diễn.

### 7. TC-NV02-045 — ASSET trả hỏng không khả dụng

- **Nguồn:** [NV02-03](../../KLCN289_TEST_CASES_NV02_03_NV02_05.md#L87), [case record](cases/TC-NV02-045.md).
- **Fixture/steps:** ASSET synthetic đang giao/sử dụng; trả về condition DAMAGED và lý do; đọc đúng asset/location/status/balance/ledger/audit; thử thao tác dùng/cấp phát nếu có trong ca nguồn.
- **Expected:** Cùng ID ASSET được nhận; không thành AVAILABLE/usable; lưu condition, actor, thời gian, vị trí. Hạch toán tồn vật lý theo quyết định đã chốt, không tự chọn quy tắc mới.
- **Evidence:** HTTP responses và DB snapshots trước-sau.

### 8. TC-NV02-061 — Kho đích nhận đúng ASSET

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L175), [case record](cases/TC-NV02-061.md).
- **Fixture/steps:** ASSET AVAILABLE ở kho nguồn; kho đích khác trong cùng Farm; Employee yêu cầu, actor được quyền duyệt, Manager có scope kho đích. Create request → approve/dispatch → kiểm tra IN_TRANSIT → receive đúng assetCode.
- **Expected:** Cùng asset ID/code, không tạo cá thể mới; trước receive chưa nằm/sẵn dùng ở kho đích; sau receive location/scope chuyển, actor/time và movement đúng một lần.
- **Evidence:** Responses từng bước, request, asset, source/destination balance, ledger movement group và audit.

### 9. TC-NV03-002 — Snapshot cũ không ghi đè biến động sau đó

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L259), [case record](cases/TC-NV03-002.md).
- **Fixture/steps:** QUANTITY baseline đã snapshot; sau snapshot phát sinh giao dịch hợp lệ; submit count cũ. Dùng DB QA và harness đồng bộ nếu cần.
- **Expected:** Count stale bị từ chối/yêu cầu đo lại; balance không bị ghi thành số tuyệt đối cũ; không phát sinh adjustment sai.
- **Evidence/dependency:** Snapshot/version/timestamps, request log, balance/adjustment/ledger. Nếu test đồng thời, ghi harness/barrier cụ thể.

### 10. TC-NV03-004 — Chỉ actor đúng thẩm quyền duyệt chênh lệch

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L291), [case record](cases/TC-NV03-004.md).
- **Fixture/steps:** Count có chênh lệch; submit; thử actor không có quyền; chỉ thử approve hợp lệ sau khi nhóm chốt role matrix.
- **Expected:** Trước approve không đổi tồn/ledger; trái quyền bị từ chối và không có audit thành công; approve hợp lệ áp dụng delta một lần, ghi đúng reviewer/time.
- **Pending:** Quyền duyệt chênh lệch cần nhóm xác nhận. Không tự gán role; có thể ghi riêng kết quả negative authorization nếu phần positive bị chặn.

### 11. TC-NV03-006 — Retry không ghi adjustment kép

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L323), [case record](cases/TC-NV03-006.md).
- **Fixture/steps:** Count riêng có thiếu 2; approver đúng thẩm quyền đã chốt; approve một lần rồi retry đúng cùng phiếu/operation; đọc adjustment, balance, ledger, audit.
- **Expected:** Một adjustment -2, balance cuối theo baseline trừ 2; retry không tạo adjustment/ledger/audit lần hai. Sau timeout phải đọc trạng thái trước khi gửi lại.

### 12. TC-NV05-004 — Hai đơn tranh lượng tồn cuối

- **Nguồn:** [ca concurrency](../../KLCN289_SAMPLE_TEST_CASES_NV01_NV02_NV05.md#L500), [case record](cases/TC-NV05-004.md).
- **Fixture/steps:** Variant synthetic available=5; hai order riêng cùng confirm quantity=5 qua harness/barrier đồng thời.
- **Expected:** Chính xác một hold 5 thành công; đơn còn lại bị từ chối; available không âm, tổng hold ≤5; physical ledger chưa giảm trước xuất.
- **Evidence:** Harness/log timestamps, cả hai HTTP responses, order/hold/allocation/balance DB before-after. Không thay bằng thao tác tay tuần tự.

### 13. TC-NV05-018 — Webhook bank transfer hợp lệ idempotent

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L651), [case record](cases/TC-NV05-018.md).
- **Fixture/steps:** Order synthetic BANK_TRANSFER unpaid; simulator/stub QA; gửi webhook đúng signature/order/amount; gửi lại callback giống hệt; đọc payment/order/audit.
- **Expected:** Callback hợp lệ xác nhận theo rule; callback trùng không ghi PAID/payment/audit lần hai; không có tiền thật.
- **Evidence:** Event IDs/payload đã loại signature, responses, DB before-after.

### 14. TC-NV05-019 — Webhook sai chữ ký hoặc sai số tiền

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L667), [case record](cases/TC-NV05-019.md).
- **Fixture/steps:** Order BANK_TRANSFER unpaid; chạy riêng biến thể bad signature và valid signature/wrong amount bằng simulator.
- **Expected:** Không biến thể nào đặt order PAID, tạo payment success/audit sai hoặc xuất kho.
- **Evidence:** Simulator logs, response, order/payment/issue/audit snapshots, không ghi secret.

### 15. TC-NV05-027 — Chỉ lượng hàng trả đạt tăng khả dụng

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L795), [case record](cases/TC-NV05-027.md).
- **Fixture/steps:** Return order synthetic; received 5, accepted 4, rejected 1; nhận và confirm qua workflow hiện có.
- **Expected:** Chỉ 4 đạt tăng available (ví dụ baseline riêng 20→24); 1 lỗi không cộng khả dụng; lưu lý do/chênh lệch. Nếu source thiếu field, ghi gap thay vì bịa field.
- **Evidence:** Return record, before-after balance/ledger, HTTP log, lý do.

### 16. TC-XFLOW-007 — Order từ giữ tồn đến xuất, payment và giao

- **Nguồn:** [Test Case liên nghiệp vụ](../../KLCN289_TEST_CASES_CONTINUED.md#L1571), [case record](cases/TC-XFLOW-007.md).
- **Fixture/steps:** Farm/kho bán đã cấu hình, variant synthetic available=5, order quantity=2; PENDING → confirm → hold → issue → payment/delivery simulator; đọc từng tầng.
- **Expected:** PENDING chưa hold; confirm giữ đúng 2 một lần; order khác không lấy phần hold; chỉ xuất làm on-hand 5→3; payment/delivery không trừ tồn lần hai.
- **Evidence:** UI/API responses, order/hold/issue/payment/delivery records, balances/ledger. No real payment.

### 17. TC-NV06-004 — Warranty claim đúng ASSET/serial đã bán

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L863), [case record](cases/TC-NV06-004.md).
- **Fixture/steps:** Order line đã giao synthetic với ASSET và serial; tạo claim đúng cá thể; thử sai cá thể/serial.
- **Expected:** Claim gắn đúng ASSET/serial đã bán; sai cá thể bị từ chối; không tạo asset Farm mới.
- **Evidence:** Order/line/asset/claim link, responses, DB snapshots và audit.

### 18. TC-NV06-005 — Không sửa có phí trước khách đồng ý

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L879), [case record](cases/TC-NV06-005.md).
- **Fixture/steps:** Claim warranty synthetic; tạo quote có phí; thử start khi khách chưa trả lời, khi từ chối, rồi trong lượt riêng sau khi đồng ý.
- **Expected:** Paid repair chỉ bắt đầu sau khi đồng ý được lưu; quote không phải payment/tiền đã thu; pending/declined không tạo repair paid.
- **Evidence:** Claim/quote state transitions, repair/payment/audit; simulator only.

### 19. TC-NV06-007 — Replacement issue liên kết đúng claim

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L911), [case record](cases/TC-NV06-007.md).
- **Fixture/steps:** Claim có quyết định đổi; replacement item/kho synthetic đủ tồn. Tạo/confirm issue; thử thay claim link/item/kho sang đối tượng khác.
- **Expected:** Issue trỏ đúng claim/quantity; không đổi sang mặt hàng/kho khác; order line gốc không bị ghi đè; balance/ledger giảm đúng một lần.
- **Evidence:** Claim/order/issue IDs, response negative, balances/ledger/audit before-after.

### 20. TC-NV09-004 — Hàng chưa có giá được tách khỏi valuation

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L1243), [case record](cases/TC-NV09-004.md).
- **Fixture/steps:** Cùng Farm/report scope có hàng đã định giá trị 300000 và lượng 3 chưa định giá; gọi report/valuation, lọc theo scope, đọc Web nếu sẵn.
- **Expected:** 300000 chỉ là phần đã định giá; 3 chưa giá hiện riêng; không gán “chưa biết” thành 0 đồng hay tuyên bố tổng đầy đủ.
- **Evidence:** API JSON, screenshot/export, fixture item/price và read-only DB đối chiếu.

### 21. TC-NV10-007 — ADMIN cập nhật phí chung không sửa snapshot order cũ

- **Nguồn:** [Test Case](../../KLCN289_TEST_CASES_CONTINUED.md#L1439), [case record](cases/TC-NV10-007.md).
- **Fixture/steps:** Shipping fee synthetic và order có snapshot cũ; actor ADMIN có quyền theo quyết định nhóm; actor không quyền làm negative control.
- **Expected:** ADMIN update hợp lệ có actor/time/before-after audit; role không quyền bị từ chối; order snapshot cũ và inventory không đổi.
- **Pending:** ADMIN system-only chưa có Farm membership; nhóm phải chốt quyền xuyên Farm/membership. Nếu chưa chốt thì BLOCKED/Requirement Pending, không cấp quyền thủ công.
- **Evidence:** API, fee/audit/order snapshot before-after, UI nếu có.

## C. Bốn ca UI/UX — giao Dev chạy trên Web/Mobile thật

### 22. UIUX-WEB-023 — Màn hình bảo trì phân tách coordinator, kho và quyết định cuối

- **Nguồn:** [UI/UX case](../../KLCN289_UI_UX_TEST_CASES.md#L219), [case record](cases/UIUX-WEB-023.md). Màn hình `/maintenance`.
- **Fixture/steps:** Cần record SCHEDULED, IN_PROGRESS, returned PASSED/FAILED và chờ final decision; mở theo role, kiểm timeline/actor/cost/date/receipt; thử control theo quyền rồi hủy dialog.
- **Expected:** Actor từng bước rõ; sửa xong không bị nhầm kho đã nhận; FAILED không hiển thị AVAILABLE; nhãn/giá trị không bị cắt.
- **Evidence:** Screenshots list/detail/action theo role, viewport/browser, fixture IDs, actual result; không chụp credential.

### 23. UIUX-WEB-032 — Đơn hàng/payment/delivery status và action nhất quán

- **Nguồn:** [UI/UX case](../../KLCN289_UI_UX_TEST_CASES.md#L300), [case record](cases/UIUX-WEB-032.md). Màn hình `/store-orders`, detail/customer, `/store-payments`.
- **Fixture/steps:** Synthetic orders PENDING, PAID/unpaid, SHIPPING, COMPLETED, cancelled; COD/BANK_TRANSFER. Lọc, mở detail, kiểm confirm/ship/complete/refund/mark-paid theo role/state.
- **Expected:** Method/status không lẫn; action đúng role/state; bank chưa PAID không hiển thị sẵn giao; customer/snapshot rõ. Refund/payment chỉ simulator, không giao dịch thật.
- **Evidence:** Screenshots list/filter/detail/payment, API readback, build/device/browser.

### 24. UIUX-MOB-006 — Sửa Receipt rồi submit giữ dữ liệu mới

- **Nguồn:** [UI/UX case](../../KLCN289_UI_UX_TEST_CASES.md#L383), [case record](cases/UIUX-MOB-006.md). Mobile ReceiptDetailScreen `/receipts/[id]`.
- **Fixture/steps:** Receipt DRAFT synthetic; sửa quantity/note/location hợp lệ; Save, reload, Submit; đọc API/Web/DB. Nếu Save lỗi thì không submit giá trị cũ; chỉ fault-inject với QA harness sẵn có.
- **Expected:** Submit chỉ dùng dữ liệu đã PATCH thành công; save failure không gửi state cũ như mới; Web/API đọc đúng dữ liệu Mobile đã lưu.
- **Evidence:** Ảnh trước/sau, request IDs/responses đã lọc token, DB read-only, Android device/OS/app build.

### 25. UIUX-MOB-009 — Transfer DISCREPANCY hiển thị đang chờ xử lý

- **Nguồn:** [UI/UX case](../../KLCN289_UI_UX_TEST_CASES.md#L411), [case record](cases/UIUX-MOB-009.md). Mobile TransferNotificationDetailScreen `/transfers/[id]`.
- **Fixture/steps:** Transfer synthetic dispatch=10, receive=8, discrepancy=2/reason; tạo bằng workflow/API, không sửa status trực tiếp. Mở notification/detail, kiểm badge/số/source/destination; xem lại sau resolve hợp lệ.
- **Expected:** DISCREPANCY là đang chờ xử lý; số xuất/nhận/lệch hiển thị; không nói tồn không đổi/phiếu đã kết thúc khi còn chờ.
- **Implementation note:** Có ghi nhận source trước đây rằng badge/default message có thể chưa xử lý DISCREPANCY; đây không phải FAIL runtime. Ghi đúng hành vi quan sát.
- **Evidence:** Ảnh trước/sau resolve, record/API readback, device/OS/app build.

## Ca BLOCKED — nằm trong 26 ID cần xử lý

### 26. TC-NV08-008 — Bảo vệ OWNER cuối

- Lượt cũ dùng SYSTEM-ADMIN chưa có membership Farm, API trả 403 và không có mutation; Farm vẫn có một OWNER active. Actor không đạt precondition nên đó là BLOCKED, không phải source FAIL. Giữ log [NV08-008](logs/nv08-008-2026-11-11T07-52-31-435Z.redacted.json). Ca này được tính trong 26 ID bàn giao.
- Chạy lại chỉ sau khi nhóm chốt quyền ADMIN xuyên Farm/membership. Không tự thêm membership qua SQL. Sau khi có actor hợp lệ, thử deactivation OWNER cuối và cạnh tranh hai OWNER; kiểm tra membership/audit transaction.

## Ghi nhận mỗi lượt

Tạo một dòng/lịch sử mới cho mỗi run; không ghi đè lượt trước:

```text
Test Case ID / Run #:
Build SHA:
Tester alias / thời điểm + timezone:
Platform, browser hoặc device/OS:
Fixture tag và pre-state evidence:
Expected Result (trích đúng nguồn):
Actual Result:
Status: Not Run | Pass | Fail | Blocked
Bug ID:
Evidence path(s):
Retest of / notes:
```

## Nguồn cần đọc cùng file này

- [Danh sách 40 ca](../../KLCN289_CHUONG5_40_TEST_CASES_UU_TIEN.md)
- [Test Case NV01–NV10/XFLOW](../../KLCN289_TEST_CASES_CONTINUED.md)
- [NV02 bổ sung](../../KLCN289_TEST_CASES_NV02_03_NV02_05.md)
- [Bộ UI/UX](../../KLCN289_UI_UX_TEST_CASES.md)
- [Execution Log](EXECUTION_LOG.md), [Summary](SUMMARY.md), [CHAPTER5_HANDOFF](CHAPTER5_HANDOFF.md), [case records](cases/)

Nếu phần tóm tắt ở đây và Expected Result trong Test Case nguồn khác nhau, dùng nội dung nguồn đã chốt; ghi discrepancy và hỏi nhóm, không tự sửa Expected Result.
