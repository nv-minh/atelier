# Audit 7 trang sau đăng nhập — Atelier v2 (Plan 0, Task 1)

- **Ngày đo:** 2026-08-16
- **Commit SHA:** `0489b995c23f751b1f2bda3f27f00875115221f5` (`0489b99`)
- **Server đo:** `npm run dev` (KHÔNG phải `npm start`) — xem lý do bên dưới.
- **Người dùng:** bypass user `local@atelier.app` (`AUTH_BYPASS=1`).
- **Cách xem:** chụp ảnh full-page bằng Playwright ở 375px/1280px × light/dark cho từng route bên
  dưới (script tạm, không thuộc bộ chụp chính thức `scripts/ui/shots.mjs` — không commit), rồi đọc
  lại ảnh. Không dùng số liệu suy đoán từ code; chỉ ghi lại điều nhìn thấy trên ảnh.

## Vì sao chạy `npm run dev` thay vì bản production

Xem chi tiết trong `docs/superpowers/notes/2026-08-16-ui-v2-baseline.md` (mục ⚠️ 1): dưới
`npm run build && npm start`, Next.js tự ép `NODE_ENV=production`, và `AUTH_BYPASS` bị khoá theo
điều kiện `NODE_ENV !== "production"` ở cả `src/lib/session.ts:11`, `src/middleware.ts:10`,
`next.config.js:24` — nên bản build production **luôn** hiện trạng thái khách, kể cả khi
`.env` có `AUTH_BYPASS=1`. Bảy trang trong tài liệu này chỉ xem được ở trạng thái đăng nhập thật khi
chạy `npm run dev` (dev không ép `NODE_ENV=production`). Đã xác nhận trực tiếp: `curl
/api/profile` dưới `npm run dev` trả `200 {"profile":null}` (đã qua bypass), dưới `npm start` trả
`401`.

## Lưu ý về ảnh full-page + thanh nav dưới (fixed)

Một vài ảnh full-page cho thấy thanh nav dưới cùng (`fixed`, `src/components/nav.tsx:93`) lặp lại ở
giữa trang thay vì chỉ ở đáy — đã xác minh bằng cách cuộn thật (`window.scrollTo` tới cuối trang,
chụp lại đúng viewport) trên `/leaderboard`: nội dung phía sau thanh nav (hạng #10, "Hải Yến") thực
ra hiển thị đầy đủ, không bị mất hay cắt. Đây là hạn chế đã biết của Chromium/Playwright khi chụp
`fullPage: true` với phần tử `position: fixed`, không phải lỗi của app — không liệt kê hiện tượng
này trong các bảng dưới.

## `/word/spider` — kiểm tra trước

Đã xác nhận `spider` tồn tại trong DB (`prisma.word.findUnique({ where: { word: "spider" } })` trả
về bản ghi) và `/word/spider` trả HTTP 200 dưới `npm run dev` khi đăng nhập.

---

## `/study`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì trong ảnh chụp (light/dark, 375/1280) | — | — | — |

## `/study/flashcard`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/study/quiz`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/study/typing`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/study/dictation`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/study/matching`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/study/pronunciation`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/study/cram`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/notebook`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/stats`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Biểu đồ "Độ chính xác" vẽ trục/lưới nhưng không có đường dữ liệu nào và không có thông báo "chưa có dữ liệu" khi tài khoản chưa có bản ghi đánh giá Tốt/Dễ — trống trơn, dễ đọc nhầm là lỗi tải dữ liệu. Biểu đồ "Dự báo ôn tập" ngay phía trên vẫn vẽ đường bình thường với cùng tài khoản. | thấp | chưa gán (ngoài phạm vi Task 1) | `src/components/stats/charts.tsx:61-99` (`AccuracyChart`) |

## `/leaderboard`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì (xem mục lưu ý về ảnh full-page ở trên — không tính hiện tượng nav che nội dung mid-page) | — | — | — |

## `/settings`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/word/spider`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |

## `/onboarding`

| Cái gì hỏng | Mức độ | Phase nào sửa | File:line |
|---|---|---|---|
| Không quan sát thấy vấn đề gì | — | — | — |
