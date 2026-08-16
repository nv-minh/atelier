# Baseline "trước" — Atelier v2 (Plan 0, Task 1)

- **Ngày đo:** 2026-08-16
- **Commit SHA (lúc đo):** `0489b995c23f751b1f2bda3f27f00875115221f5` (`0489b99`, branch `fix/ui-blocking-bugs`, working tree sạch, không có thay đổi trong `src/`)
- **Tag ảnh chụp tương ứng:** `t00-baseline` (`data/ui-shots/t00-baseline/`, 84 file PNG — không commit, đã có trong `.gitignore`)
- **Server đo:** `npm run build && npm start` (bản build production, cổng 3000), Chromium do Playwright điều khiển.

## ⚠️ Hai phát hiện về môi trường cần biết trước khi đọc số liệu dưới đây

### 1. `AUTH_BYPASS=1` không có tác dụng dưới `npm start`

`.env` có `AUTH_BYPASS=1`, nhưng cả `src/lib/session.ts:11`, `src/middleware.ts:10` và
`next.config.js:24` đều khoá thêm điều kiện `process.env.NODE_ENV !== "production"`. Next.js
CLI tự set `NODE_ENV=production` cho mọi lệnh `next build` / `next start` khi biến này chưa được
set từ trước (`node_modules/next/dist/bin/next:60`), **bất kể** giá trị `AUTH_BYPASS`. Đã xác minh
trực tiếp: dưới `npm start` sạch, `curl /api/profile` trả `401 {"error":"unauthorized"}` và
`curl /study` trả `307` (redirect `/login`) — kể cả khi ép `NODE_ENV=test` vào tiến trình `next
start` (không rebuild) thì kết quả vẫn y hệt, vì `process.env.NODE_ENV` bị Next.js inline thành
literal `"production"` ngay tại lúc `next build`, không đọc động lúc chạy nữa.

**Hệ quả cho số liệu dưới đây:** toàn bộ phép đo (Lighthouse, kích thước route, ảnh `t00-baseline`)
chạy ở trạng thái **khách chưa đăng nhập** cho các route có gate (`/topics/food`, `/notebook`,
`/stats`, `/leaderboard`, `/settings`, `/word/*`) — các trang này vẫn trả HTTP 200 (chúng tự vẽ
`<AuthRequired>` thay vì tự chuyển hướng, xem comment trong `src/middleware.ts:22-32`), riêng
`/study` bị middleware chuyển hướng 307 sang `/login`. Route `/browse` và `/grammar` không bị ảnh
hưởng — cả hai đều công khai ở trang/tab mặc định (xem `src/app/browse/page.tsx:22-38` — trang 1,
`scope=all` là "mẫu miễn phí"). Vì mọi plan sau đo lại cũng sẽ chạy `npm start` với cùng ràng buộc
này, số liệu vẫn so sánh được — chỉ cần biết đây là baseline của bản build production **không**
bypass, không phải bản đã đăng nhập.

Muốn xem trải nghiệm đã đăng nhập thật (dùng cho audit ở
`docs/superpowers/notes/2026-08-16-ui-v2-audit-logged-in.md`) phải chạy `npm run dev` — dev không ép
`NODE_ENV=production` nên `AUTH_BYPASS` hoạt động đúng như tài liệu.

### 2. Ảnh `fullPage: true` có thể "nhân đôi" thanh nav dưới giữa trang — đây là lỗi của công cụ chụp, không phải lỗi app

Với các trang cao hơn khung nhìn ban đầu (900px), ảnh full-page đôi khi vẽ thanh nav dưới cùng
(`position: fixed`, `src/components/nav.tsx:93`) lặp lại ở giữa trang thay vì chỉ ở đáy trang — đây
là hạn chế đã biết của Chromium/Playwright khi chụp `fullPage` với phần tử `fixed`. Đã xác minh bằng
tay: cuộn thật (`window.scrollTo` tới cuối) trên `/leaderboard` cho thấy dòng bị "che" (hạng #10,
Hải Yến) thực ra hiển thị đầy đủ, đúng vị trí, không bị cắt — nội dung không hề mất, thanh nav chỉ
tạm thời che nó lúc chụp full-page. Không có mục nào trong audit dưới liệt kê hiện tượng này như một
lỗi thật.

## 1. Lighthouse mobile

Lệnh: `npx --yes lighthouse@12 <url> --form-factor=mobile --only-categories=performance,accessibility --output=json --quiet --chrome-flags="--headless"`
(Lighthouse 12.8.2, chạy được — không cần "không đo được"). Điểm số đo trên bản build production,
ở trạng thái khách (xem mục ⚠️ 1 ở trên: `/topics` và `/browse` là view khách; `/` và `/grammar` vốn
công khai). **INP không có trong output audit của Lighthouse 12 (`interaction-to-next-paint` không
tồn tại trong `audits`), nên dùng TBT (Total Blocking Time) thay thế** như brief cho phép.

| Route | Performance | Accessibility | LCP | TBT | CLS |
|---|---|---|---|---|---|
| `/` | 70 | 100 | 8.0 s | 30 ms | 0.002 |
| `/topics` | 72 | 98 | 7.5 s | 30 ms | 0.002 |
| `/browse` | 77 | 90 | 6.8 s | 10 ms | 0.002 |
| `/grammar` | 77 | 100 | 6.6 s | 0 ms | 0.002 |

## 2. Kích thước route (từ `npm run build`)

Nguyên văn cột `Size` và `First Load JS`, đơn vị giữ nguyên như build in ra:

```
Route (app)                              Size     First Load JS
┌ ƒ /                                    10.3 kB         185 kB
├ ○ /_not-found                          880 B          88.3 kB
├ ƒ /api/auth/[...nextauth]              0 B                0 B
├ ƒ /api/cron/reminders                  0 B                0 B
├ ƒ /api/export                          0 B                0 B
├ ƒ /api/grammar/answer                  0 B                0 B
├ ƒ /api/grammar/lesson-read              0 B                0 B
├ ƒ /api/grammar/session-end             0 B                0 B
├ ƒ /api/notebook                        0 B                0 B
├ ƒ /api/placement/items                 0 B                0 B
├ ƒ /api/placement/result                0 B                0 B
├ ƒ /api/profile                         0 B                0 B
├ ƒ /api/push/subscribe                  0 B                0 B
├ ƒ /api/quote                           0 B                0 B
├ ƒ /api/settings                        0 B                0 B
├ ƒ /api/stats                           0 B                0 B
├ ƒ /api/stats/forecast                  0 B                0 B
├ ƒ /api/stats/heatmap                   0 B                0 B
├ ƒ /api/study/queue                     0 B                0 B
├ ƒ /api/study/quiz-options              0 B                0 B
├ ƒ /api/study/review                    0 B                0 B
├ ƒ /api/study/session                   0 B                0 B
├ ƒ /api/vault/bulk                      0 B                0 B
├ ƒ /api/words                           0 B                0 B
├ ƒ /browse                              4.95 kB         191 kB
├ ƒ /grammar                             2.12 kB         118 kB
├ ƒ /grammar/[topic]                     4.1 kB          167 kB
├ ƒ /grammar/[topic]/lesson/[order]      2.61 kB         156 kB
├ ƒ /grammar/[topic]/test                6.86 kB         177 kB
├ ƒ /leaderboard                         4.74 kB         175 kB
├ ○ /login                               1.29 kB         120 kB
├ ○ /manifest.webmanifest                0 B                0 B
├ ƒ /notebook                            6.41 kB         177 kB
├ ○ /offline                             695 B           117 kB
├ ○ /onboarding                          6.46 kB         175 kB
├ ○ /opengraph-image                     0 B                0 B
├ ○ /privacy                             1.54 kB         111 kB
├ ○ /robots.txt                          0 B                0 B
├ ƒ /settings                            6.51 kB         186 kB
├ ○ /sitemap.xml                         0 B                0 B
├ ƒ /stats                               111 kB          281 kB
├ ○ /study                               3.89 kB         132 kB
├ ƒ /study/cram                          2.93 kB         180 kB
├ ƒ /study/dictation                     166 B           187 kB
├ ƒ /study/flashcard                     165 B           187 kB
├ ƒ /study/matching                      3.87 kB         160 kB
├ ƒ /study/pronunciation                 6.69 kB         163 kB
├ ƒ /study/quiz                          166 B           187 kB
├ ƒ /study/typing                        166 B           187 kB
├ ○ /terms                               1.54 kB         111 kB
├ ƒ /topics                              3.56 kB         174 kB
├ ƒ /topics/[slug]                       3.33 kB         181 kB
├ ○ /twitter-image                       0 B                0 B
└ ƒ /word/[word]                         4.51 kB         179 kB
+ First Load JS shared by all            87.4 kB
  ├ chunks/2117-ed5e7398b7005fc2.js      31.8 kB
  ├ chunks/fd9d1056-76c9259a4566bdf9.js  53.6 kB
  └ other shared chunks (total)          2 kB

ƒ Middleware                             50.3 kB
```

`/stats` nổi bật nhất: 111 kB Size riêng route / 281 kB First Load JS — cao hẳn so với phần còn lại
(kế tiếp là `/browse` 191 kB First Load JS). Đáng để plan sau soi lại (recharts + toàn bộ dữ liệu
huy hiệu/heatmap/forecast tải trong 1 lần fetch phía server, xem `src/app/stats/page.tsx`).

## 3. Tổng byte ảnh của `/browse` trang 1

Đo bằng Playwright (`page.on('response')`, lọc `resourceType() === 'image'`, cộng
`(await response.body()).length`), trên bản build production, trạng thái khách (trang 1 công khai):

- **Số ảnh:** 46
- **Tổng byte:** 1.589.458 bytes (≈ 1552.2 KiB / ≈ 1.52 MiB)
