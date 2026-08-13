# Bảng xếp hạng với đối thủ tổng hợp — Design

**Ngày:** 2026-08-13
**Trạng thái:** đã được duyệt (brainstorming), chờ lập kế hoạch thực thi
**Phạm vi:** module mới `src/lib/leaderboard/*`, trang mới `/leaderboard`, một tab trong `nav.tsx`, i18n. **Không** thêm model Prisma nào
**Nhánh:** chưa tạo

---

## 1. Bối cảnh

Đây là **gói D** trong bốn gói của lượt việc này:

| Gói | Nội dung | Trạng thái |
|---|---|---|
| A | Đo trình độ + chọn lĩnh vực + engine chọn từ mới | spec xong (`2026-08-13-level-aware-word-selection-design.md`), **hoãn chờ crawl** |
| B | Kho từ vựng đã học | chưa brainstorm |
| C | Nhắc học lại | chưa brainstorm |
| **D (spec này)** | Bảng xếp hạng có đối thủ tổng hợp | spec này |

**D không bị chặn bởi việc crawl từ vựng** (khác gói A), nên nó thực thi được ngay. Vì vậy spec này nằm trên nhánh riêng để merge độc lập với A.

### Trạng thái hiện tại — đã kiểm, không phỏng đoán

**Đã có, dùng lại được nguyên vẹn:**

- `DailyStat` (`@@unique([userId, dateStr])` + `@@index([userId, dateStr])`) với hai ledger `xp` (từ ReviewLog) và `bonusXp` (mode non-SRS). Tổng **phải** lấy qua `totalXp(row)` trong `gamification-defs.ts` — đó là single source of truth, cộng tay hai ledger là cách để chúng lệch nhau.
- `computeStreakFromDb` (`gamification-checks.ts`), `Settings.dailyGoalXp`, `UserProgress`.
- Pattern trang: server component đọc Prisma trực tiếp (`stats/page.tsx`); guest thì render `<AuthRequired>` chứ không redirect (`middleware.ts` chỉ bounce `/study`).

**Chưa có gì cả cho bảng xếp hạng:** không model, không route, không component.

### Phát hiện quan trọng — mốc ngày của app là UTC

`todayStr()` (`src/lib/utils.ts:18`) là `d.toISOString().slice(0, 10)` → **UTC**. Mốc sang ngày là **07:00 giờ VN**, và `DailyStat` / streak / daily goal đều theo mốc đó.

**Hệ quả bắt buộc:** `weekKey` của bảng xếp hạng phải suy từ **cùng mốc UTC** đó. Nếu bảng dùng tuần theo giờ VN trong khi `DailyStat` theo UTC, "XP tuần" trên bảng sẽ không khớp tổng 7 ngày user thấy ở `/stats` — lệch một phần của hai ngày biên, rất khó truy vì chỉ sai ở đầu và cuối tuần.

Ngoại lệ duy nhất: dấu **"hoạt động X giờ trước"** là cảm nhận theo đồng hồ người xem, nên nó sinh ra một *instant tuyệt đối* rồi để client render tương đối (mục 4).

> **Ngoài phạm vi, ghi lại để không mất:** mốc UTC nghĩa là XP "hôm nay" của user reset lúc 7h sáng VN — học 6h sáng tính vào hôm qua. Đây là hành vi có sẵn từ trước, không do D gây ra. Sửa sang mốc VN là ticket riêng và nó chạm streak + `DailyStat` + backfill.

### Quyết định của người dùng (ghi lại để về sau không phải đoán lại)

| Câu hỏi | Chốt |
|---|---|
| Chỉ số + chu kỳ | **XP tuần, reset thứ Hai** (cộng `DailyStat.xp + bonusXp`) |
| Thứ hạng user quyết định thế nào | **Rival hiệu chuẩn theo nhịp user**; hạng do user **kiếm được**, hệ thống chỉ điều chỉnh độ khó — KHÔNG gán hạng trực tiếp |
| Mô hình hành vi rival | **Mỗi rival một "tính cách"** tất định từ seed (không lưu, không cron) |
| Chi tiết hiển thị | **Cả 4**: tên + avatar chữ cái, streak 🔥, Δ hạng ▲▼, "hoạt động X giờ trước" |
| Tên rival | **Chỉ tên Việt** — bỏ tên nước ngoài |
| Cap độ mạnh rival | **2.2 × nhịp user** |
| Liên tục giữa các tuần | **Giữ lại 4–5 rival** của tuần trước |
| Dòng minh bạch | Đặt ở **icon ⓘ / mục giải thích**, không phải banner giữa màn |

### Tiêu chí thành công

1. User học đều theo nhịp thường lệ, **đã học hôm nay** → nằm **hạng 4–8**. Đo trên 100 userId: trung vị hạng 6, 87/100 nằm trong dải, 0/100 lên hạng 1.

   **Khi chưa học hôm nay** thì thấp hơn: trung vị hạng 8,5 và khoảng 3% xuống chót bảng. Đây là **trade-off được chấp nhận**, không phải lỗi còn mở. Lý do: "không bao giờ chót" chưa từng được bảo đảm về mặt cấu trúc — `paceFactor` rút độc lập cho từng rival trong `[0.55, 1.6]` và không có gì ép một rival phải yếu; nó chỉ đúng nhờ khoảng lỏng mà chính bug hiệu chuẩn tạo ra (`restProb` âm thầm làm rival hụt ~25% sản lượng danh nghĩa). Hai cách khôi phục đều tệ hơn: ép một rival yếu theo roster từng tuần là tái lập đúng kiểu bất ổn mà ruling R9 đã xoá (tính cách rival lật giữa các tuần), còn kéo mean rival xuống thì phá luôn phần bias vừa sửa. Chót bảng khi đang chậm một ngày, với đường leo lên nhìn thấy được, vẫn là hạng **kiếm được** chứ không phải bị gán — và nó tự hết ngay khi user học.
2. User cày hơn thường lệ trong tuần → **leo được** top 3. User nghỉ 2 ngày → **tụt** khỏi top 8. Cả hai không cần luật riêng nào. **Đã đo lại sau hiệu chuẩn theo sản lượng tuần:** vế "cày hơn → top 3" vẫn đúng (cày gấp đôi nhịp cả tuần đưa user vào top 3 cho 60/60 id đo được, không đổi). Vế "nghỉ 2 ngày → tụt khỏi top 8" giờ ĐÚNG rõ hơn nhiều: ở mức nghỉ đúng 2/7 ngày (5/7 ngày hoạt động), chỉ còn 23/60 id ở trong 4–8 (từ 49/60) — tức 37/60 id giờ tụt khỏi top 8 như tiêu chí mô tả, trung vị hạng chuyển từ trong-khoảng sang hạng 9. Cùng nguyên nhân với tiêu chí 1: paceFactor không còn bị `restProb` che bớt.
3. Mở bảng trên 2 thiết bị, hoặc refresh 5 lần → **cùng một bảng**, cùng số.
4. Lúc 2h sáng giờ VN, **dưới 25%** tổng số dòng rival (gộp trên nhiều user) đọc là "vừa hoạt động" (dưới 6 giờ) — đo được ≈12.4% — và không user nào có ≥ 7/10 rival cùng "vừa hoạt động" một lúc. (Cách diễn đạt cũ — "hoạt động từ hôm qua trở về trước" — vượt quá những gì formatter thực sự hiển thị: 12 giờ trước hiện đúng "12 giờ trước", không bao giờ "hôm qua"; câu trên diễn đạt đúng cận mà test khẳng định.)
5. Không rival nào có XP tuần vượt `2.2 ×` (nhịp user × 7).
6. Mỗi ngày trong tuần, **≥ 1** rival có XP = 0.
7. Không XP nào của rival là số tròn chục. **Ghi nhận:** đây là một đơn giản hoá có chủ đích, không miễn phí — cấm số tròn chục cho CẢ 10 rival MỌI tuần tự nó cũng là một tín hiệu, vì XP thật của người thật tận cùng bằng 0 (tròn chục) khoảng 10% thời gian. Chưa cần sửa, chỉ ghi lại để không mất.
8. Sang tuần mới, **4–5** rival của tuần trước còn ở lại.
9. "XP tuần" của user trên bảng **khớp chính xác** tổng `totalXp` của 7 `DailyStat` trong tuần.

### Ngoài phạm vi

- Gói A / B / C.
- Matchmaking league nhiều user thật (xem mục 6 — interface không chặn, nhưng không làm bây giờ).
- Đổi mốc ngày UTC → VN (ticket riêng, xem trên).
- Giải thưởng / thăng hạng - xuống hạng kiểu division (bronze/silver/gold). Chưa cần, và thêm vào sau không phải phá cấu trúc.
- Bảng theo tháng hoặc all-time.

---

## 2. Kiến trúc: tất định từ seed, không lưu gì

Không bảng bot, không cron, không job. 10 rival là **hàm thuần của `(userId, weekKey)`**.

| Module | Loại | Việc |
|---|---|---|
| `rng.ts` | thuần | hash chuỗi (cyrb128) + PRNG (mulberry32); `(userId, weekIndex, i)` → seed → dãy số |
| `personas.ts` | data | pool ~60 tên gọi Việt + bảng màu avatar |
| `rivals.ts` | thuần | sinh 10 persona + tính cách cho một `(userId, weekIndex)` |
| `pace.ts` | server mỏng | đo nhịp user từ `DailyStat` |
| `board.ts` | thuần | `(rivals, pace, userWeeklyXp, now)` → bảng đã sort + Δ hạng + lastActive |

Trang `/leaderboard` là **server component đọc Prisma trực tiếp** (theo pattern `stats/page.tsx`) — không cần API route. Guest → `<AuthRequired>`, vì bảng xếp hạng mà không có XP của chính mình thì vô nghĩa.

**Vì sao tất định thay vì bot rows + cron:** repo chưa có hạ tầng job nào; bot nằm trong bảng `User` sẽ lẫn vào mọi query khác (đếm user, thống kê hệ thống) — đúng loại rò rỉ khó thấy; và một bảng bot phải invalidate/cập nhật mỗi ngày là state có thể lệch. Tất định thì test được bằng vitest không cần mock gì, và tiêu chí 3 đạt được miễn phí.

---

## 3. Hiệu chuẩn và tính cách

### 3.1 Nhịp user

`pace.ts` đo HAI nhịp khác nhau từ cùng **7 ngày `DailyStat` gần nhất** (mỗi ngày lấy qua `totalXp(row)`, ngày không có row tính là 0), và chỉ một trong hai được đưa vào hiệu chuẩn rival:

- `sessionPace` — median XP/ngày, tính CHỈ trên những ngày có hoạt động. Đo độ NẶNG của một buổi học — không phân biệt buổi đó có hiếm hay không.
- `dailyPace` = `round(sessionPace × activeDays / 7)` — nhịp đó dàn đều ra cả tuần, tức **sản lượng tuần thật** của user quy về một con số/ngày. Đây là con số đưa vào `buildBoard` để hiệu chuẩn rival, **không phải** `sessionPace`.

**Vì sao tách hai nhịp (sửa 2026-08-13):** một user học 2 buổi/tuần rất nặng và một user học nhẹ đều 7 ngày có thể có cùng `sessionPace`, nhưng sản lượng tuần khác hẳn nhau. Hiệu chuẩn rival theo `sessionPace` (bản gốc) có lỗi hệ thống hai chiều: rival của user học 2 buổi/tuần bị đặt ở đúng cường độ buổi học đó **mỗi ngày trong tuần** (phạt nặng — sản lượng tuần thật của user chỉ ~2 buổi, rival chạy như 7 buổi); còn rival của user học đều 7 ngày lại (do một lỗi hiệu chuẩn khác, xem 3.2) chạy dưới `sessionPace` một chút mỗi ngày, nên user "học đều mỗi ngày" thắng rival một cách không do thực lực. `dailyPace` sửa lỗi thứ nhất.

- User mới (< 3 ngày có dữ liệu) → CẢ HAI nhịp cùng dùng `Settings.dailyGoalXp` làm giả định, và `dailyPace` **không** bị chia nhỏ theo `activeDays` ở đây — một goal đã là mục tiêu MỖI NGÀY, chia nhỏ nó theo 1-2 ngày dữ liệu ít ỏi sẽ làm rival của user mới gần như miễn phí. Không có nhánh này thì user mới có pace = 0 và toàn bộ rival sinh ra XP 0.
- Dùng **median** cho `sessionPace`, chứ không phải mean: một hôm cày 600 XP không được phép đẩy cả bảng lên rồi làm user tụt hạng suốt tuần sau.

### 3.2 Năm tham số tất định mỗi rival

| Tham số | Khoảng | Tác dụng |
|---|---|---|
| `paceFactor` | 0.55 → 1.6, phân bố quanh 1.0 | rival mạnh/yếu so với nhịp user |
| `peakHour` | giờ ưa thích, **đặt theo giờ VN** rồi đổi sang UTC | quyết định "hoạt động X giờ trước" |
| `regularity` | σ của XP ngày | đều đặn hay thất thường |
| `restProb` | xác suất nghỉ một ngày | tạo ngày XP 0, và quyết định streak |
| `weekendBias` | ± | mạnh hoặc yếu vào cuối tuần |

Cộng `formTrend` trôi theo tuần (phong độ lên/xuống giữa các tuần).

`XP ngày = f(tính cách, hash(rivalId, dateStr))`. Các hành vi "người" — cày cuối tuần, mất 2 ngày rồi quay lại mạnh — **rơi ra từ tham số**, không cần luật riêng cho từng kiểu.

**Phép chia `1 / (1 − restProb)` (sửa 2026-08-13):** `paceFactor` phải mang nghĩa "sản lượng TUẦN của rival này so với `dailyPace` của user", nhưng rival chỉ tạo XP vào những ngày không nghỉ — nên XP mỗi ngày hoạt động được chia cho phần trăm ngày hoạt động, `(1 − restProb)`, để bù lại đúng phần ngày nghỉ:

```
rivalDailyXp = round(dailyPace × paceFactor × jitter × weekend × form / (1 − restProb))
```

Không có phép chia này, `restProb` âm thầm biến thành một tham số SỨC MẠNH ẩn: một rival nghỉ nhiều (restProb cao) có sản lượng tuần thật thấp hơn hẳn `paceFactor` hứa hẹn, bất kể `paceFactor` của nó là bao nhiêu — nghĩa là rival "thất thường" luôn yếu hơn rival "đều đặn" cùng `paceFactor`, một hiệu ứng phụ không ai chủ ý thiết kế. `restProb` bị chặn ở `REST_PROB_MAX = 0.45` (< 1) nên mẫu số `(1 − restProb)` luôn nằm trong `[0.55, 0.95]` — không bao giờ bằng 0. Luật cưỡng chế nghỉ của `dailyXpForAll` (mục 5.2) vẫn trừ thêm một rival-ngày mỗi ngày, nên sản lượng tuần thật của rival vẫn thấp hơn danh nghĩa vài phần trăm — có chủ đích, giữ user "đúng nhịp" nhỉnh hơn trung vị một chút thay vì nằm đúng giữa.

### 3.3 Cap

Không rival nào có XP tuần vượt `2.2 × (pace × 7)`. Bảng mà người đứng đầu gấp 10 lần mình không tạo động lực, nó tạo cảm giác vô vọng — và đó là lý do duy nhất tính năng này tồn tại.

---

## 4. Bốn chi tiết hiển thị

| Chi tiết | Cách làm |
|---|---|
| **Tên + avatar** | Chỉ tên Việt (`Thu Hà`, `Minh Quân`, `Duy Anh`…) từ `personas.ts`; vòng tròn chữ cái đầu, màu từ seed. **Không dùng ảnh người.** Dùng token màu của repo — nhớ gotcha DEFAULT key (util màu bare/opacity không emit gì nếu thiếu key `DEFAULT`) |
| **Streak 🔥** | Suy từ `restProb` của chính tính cách đó → rival hay nghỉ có streak thấp. Tự nhất quán, không cần luật riêng |
| **Δ hạng ▲▼** | Sinh lại bảng của **hôm qua** rồi so thứ hạng. "Bảng hôm qua" = XP tuần **tích luỹ đến hết hôm qua** cho cả rival và user (không phải XP của riêng ngày hôm qua). Miễn phí vì mọi thứ tất định. **Thứ Hai ẩn Δ**: tuần mới nên mọi người bằng 0, so với hạng của tuần trước là so hai thang khác nhau |
| **"Hoạt động X giờ trước"** | Sinh một **instant tuyệt đối** từ `peakHour` + ngày; rival nghỉ hôm nay → instant của hôm qua/hôm trước. **Đã build:** client render tương đối theo `nowIso` — thời điểm `now` phía SERVER lúc render trang, truyền xuống làm prop — chứ không phải đồng hồ riêng của trình duyệt. Chọn vậy để tránh **hydration mismatch** (server và client tự gọi `Date.now()` sẽ ra hai số "X phút trước" khác nhau) và để không lệch theo đồng hồ máy người xem chỉnh sai giờ. Đánh đổi: nhãn đứng yên tại thời điểm render, không tự đếm tiến nếu để tab mở lâu — chấp nhận được vì trang không tự refresh |

---

## 5. Sáu luật chống lộ

1. **XP không bao giờ tròn chục** — jitter luôn khác 0. Người thật không dừng ở đúng 200 XP.
2. **Mỗi ngày ≥ 1 rival có XP = 0.** Bảng mà cả 10 người học đủ 7/7 ngày là bảng máy. Đây là **ràng buộc phải cưỡng chế**, không phải thứ tự rơi ra từ `restProb`: sau khi sinh XP cho một ngày, nếu không rival nào nghỉ thì buộc rival có `restProb` cao nhất ngày đó nghỉ. Tất định vì thứ tự so sánh cố định.
3. **Cap `2.2 × pace`** (mục 3.3).
4. **`lastActive` tự nhiên thưa vào ban đêm nhờ lệch trục VN/UTC — không cần quota** *(sửa theo ruling R9, thay cho bản gốc bên dưới)*. Lúc 2h sáng giờ VN, dấu "hoạt động X trước" của một rival KHÔNG nghỉ hôm đó cách khoảng `26 − peakHourVn` giờ (vì `now` = hôm nay 19:00 UTC, còn instant đỉnh không-nghỉ = hôm nay 00:00 UTC + (`peakHourVn` − 7) giờ). Rival đỉnh giờ khuya VN (`peakHourVn` nhỏ) vì vậy đọc STALE NHẤT bảng, không phải mới nhất — nên không cần luật hậu kiểm lẫn quota giới hạn số rival đỉnh đêm (bản gốc: **tối đa 2 rival** trong khoảng 00:00–05:00 VN, rival thứ 3 bị dịch sang giờ tối — **ruling R9 bỏ quota này** vì độ lệch trục đã tự đạt hiệu quả tương đương). Tính chất được khẳng định bằng hai test: **(a) cận tổng hợp** — dưới 25% tổng số dòng rival trên 25 user là "vừa hoạt động" (<6 giờ) lúc 2h sáng, đo được ≈12.4%; **(b) cận theo từng user** — không user nào có ≥ 7/10 rival "vừa hoạt động" cùng lúc. Đây vẫn là **test quan trọng nhất của cả spec**: "10 người vừa học 10 phút trước" lúc 3h sáng là chỗ user bắt được ngay, và bắt được một lần là mất tin cả bảng.
5. **Liên tục giữa các tuần: giữ 4–5 rival của tuần trước**, thay phần còn lại. Subset giữ lại chọn bằng `hash(userId, weekKey)` nên vẫn tất định. Đổi cả 10 người mỗi tuần là dấu hiệu máy — league của người thật thì có người quen.
6. **Không trùng tên trong cùng một tuần.**

**Minh bạch:** một dòng giải thích ở chỗ *tìm được nhưng không chắn đường* — icon ⓘ hoặc mục "Bảng xếp hạng hoạt động thế nào?" — không phải banner giữa màn. Cảm giác thật đến từ nhịp hành vi ở mục 3, không đến từ việc che nguồn gốc. Cách này thì user tò mò tìm hiểu sẽ gặp câu trả lời thật, thay vì tự phát hiện rồi mất tin.

---

## 6. Chuẩn bị cho user thật (không làm bây giờ)

`board.ts` nhận `entries: { kind: "user" | "rival"; name: string; weeklyXp: number; … }[]`. Khi app có nhiều user thật, chỉ cần đổi **nguồn** entries — logic sort / Δ hạng / hiển thị không đổi.

Không thiết kế matchmaking bây giờ (YAGNI: hiện gần như chỉ có một user thật, league chung sẽ là 1 người + 10 rival, tức đúng bằng thiết kế này nhưng phức tạp hơn). Interface không chặn đường.

---

## 7. Test & nghiệm

Vitest thuần, không cần mock Prisma (chỉ `pace.ts` chạm DB và nó mỏng).

| File | Khẳng định chính |
|---|---|
| `rng.test.ts` | cùng seed → cùng dãy; đổi `userId` hoặc chỉ số tuần → dãy khác |
| `week.test.ts` | `weekIndex` tăng đúng 1 mỗi tuần, khớp mốc **UTC** của `todayStr()`; tuần bắt đầu thứ Hai; ngày giao tuần không nhảy hai lần |
| `rivals.test.ts` | 10 tên không trùng, đều thuộc pool Việt; giữ lại 4–5 rival của tuần trước; mọi tham số trong khoảng |
| `board.test.ts` | quét 100 id: học đều (đã học hôm nay) → trung vị hạng 4–8, không ai hạng 1; cày mạnh → top 3; Δ của user đi theo XP thật của họ (chặt `> 0` / `< 0`, không phải `>= 0`); không rival nào vượt cap; không XP tròn chục; mỗi ngày ≥ 1 rival XP 0 (kể cả khi không rival nào tự nghỉ — luật cưỡng chế); thứ Hai không có Δ; tổng XP rival tăng dần trong tuần |
| `activity.test.ts` | 2h sáng VN: gộp 25 user thì < 25% dòng rival là "vừa hoạt động" (< 6 giờ), và không user nào có ≥ 7/10; không bao giờ 10/10 dưới 30 phút; bảng đêm im hơn bảng chiều; rival nghỉ liên tục → fallback đúng 4 ngày |
| `pace.test.ts` | `sessionPace` là median chứ không mean (một ngày 600 XP không kéo cả bảng); `dailyPace = round(sessionPace × activeDays / 7)`; < 3 ngày dữ liệu → fallback `dailyGoalXp` **nguyên giá trị**, không bị nhân xuống |

Nghiệm bằng tay: tiêu chí 1, 2, 9 của mục 1 — đặc biệt **tiêu chí 9** (XP tuần trên bảng khớp tổng 7 `DailyStat`), vì đó là chỗ hai mốc thời gian có thể lệch nhau.

---

## 8. Chia plan triển khai

| Plan | Nội dung |
|---|---|
| **D1** | `rng.ts` + `week.ts` + `personas.ts` + `rivals.ts` + test — thuần, không UI |
| **D2** | `pace.ts` + `board.ts` + test (hoàn thành lõi; nghiệm được tiêu chí 1, 2, 5–8) |
| **D3** | Trang `/leaderboard` + tab `nav.tsx` + `<AuthRequired>` + i18n vi/en + mục giải thích ⓘ |

D1 → D2 → D3 tuần tự, nhưng cả ba đều **không phụ thuộc gói A**, nên chạy song song với việc crawl được.

---

## 9. Giả định do tác giả spec quyết, không do người dùng chọn

1. **Mọi con số tune được nằm trong một `constants.ts`**: cap 2.2, khoảng `paceFactor` 0.55–1.6, số rival giữ lại 4–5, số rival = 10. Giá trị **khởi điểm**, không phải kết quả đo. (Ngưỡng "≥8/10 lúc đêm" của bản gốc bị bỏ theo ruling R9 — mục 5.4 — và không còn là hằng số nào trong `constants.ts`; luật thay thế của nó là một tính chất đo được của lệch trục VN/UTC, không phải một tunable.)
2. **10 rival + user = 11 dòng.** Đủ để có top 3 đáng leo và có đáy đáng tránh, vừa một màn mobile không cần scroll.
3. **Pool tên ~60**, tất cả tên gọi Việt hai âm. Đủ để 10 tên/tuần không trùng và không lặp lại sớm. Tên do người viết, không sinh bằng thuật toán ghép âm — ghép âm dễ ra tên nghe sai.
4. **Streak của rival suy từ `restProb`, không lưu.** Nghĩa là nó là con số nhất quán với hành vi chứ không phải lịch sử thật; nếu sau này có drill-down "7 ngày qua của rival này" thì phải sinh từ cùng seed để hai chỗ không lệch.
5. **Guest không xem được bảng** (`<AuthRequired>`). Bảng cần nhịp của chính user để hiệu chuẩn, nên bảng cho guest sẽ là bảng hiệu chuẩn theo `dailyGoalXp` mặc định — vô nghĩa và dễ gây hiểu sai.
6. **Không gửi thông báo về thứ hạng.** Push/nudge là gói C; nếu C làm thì "bạn vừa bị vượt" là ứng viên tốt, nhưng nó thuộc C, không phải D.
