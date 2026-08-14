# Atelier — Studio học ngôn ngữ

[![CI](https://github.com/nv-minh/atelier/actions/workflows/ci.yml/badge.svg)](https://github.com/nv-minh/atelier/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-Vercel-ember)](https://atelier-lang.vercel.app)

Web app **full-stack** học ngôn ngữ — hiện là từ vựng tiếng Anh (A1–C1), ngữ pháp đang xây bằng **spaced repetition (FSRS)** — thuật toán họ Anki 2024. Xây bằng Next.js, Prisma + PostgreSQL, giao diện ấm kiểu editorial, có đăng nhập Google + đồng bộ dữ liệu học giữa các thiết bị.

```
8.011 từ · 7 chế độ học · 14 bộ từ nguồn · FSRS scheduler · song ngữ Anh–Vi · đăng nhập Google
```

👉 **Demo chạy thật:** https://atelier-lang.vercel.app

---

## ✨ Tính năng

### 🧠 Spaced Repetition (FSRS)
Dùng **FSRS** (`ts-fsrs`) — mô hình mỗi thẻ theo 3 biến *stability / difficulty / retrievability*, lên lịch ôn hiệu quả hơn ~25% so với SM-2 cổ điển. Mỗi thẻ đánh giá 4 nút:

| Nút | Ý nghĩa | Hiệu ứng |
|---|---|---|
| 🔴 Lại | Quên | Ôn lại sớm |
| 🟠 Khó | Nhớ mờ | Khoảng ngắn |
| 🟢 Tốt | Nhớ được | Khoảng chuẩn |
| 🔵 Dễ | Nhớ tức thì | Khoảng dài |

### 🎴 7 chế độ luyện tập
- **Flashcard** — lõi SRS: lật thẻ → đánh giá → lặp. Hỗ trợ 3 hướng: **Word→Meaning**, **Meaning→Word**, **Cloze** (điền khuyết trong câu ví dụ).
- **Trắc nghiệm** — chọn nghĩa trong 4 đáp án cùng cấp CEFR.
- **Gõ đáp án** — active recall, chấp nhận sai 1 ký tự (Levenshtein).
- **Nghe & viết** — nghe audio (UK/US, chỉnh tốc độ) rồi chép lại.
- **Ghép cặp** — game nối 6 cặp từ↔nghĩa qua 4 vòng; thưởng XP, không ghi lịch SRS.
- **Luyện phát âm** — nghe mẫu rồi đọc vào micro, trình duyệt nhận diện và chấm ngay.
- **Cram (ôn tự do)** — drill nhanh theo cấp/chủ đề, **không đụng lịch SRS** — hợp ôn trước thi.

Bốn chế độ đầu ghi vào cùng lịch FSRS; Ghép cặp và Luyện phát âm chỉ thưởng XP; Cram không ghi gì cả.
Trong nhóm ghi lịch, Quiz/Typing/Dictation tự đánh giá (đúng → Good, sai → Again).

### 🌐 Song ngữ Anh–Vi
Nghĩa + ví dụ hiện **cả tiếng Anh lẫn tiếng Việt** (dịch batch qua Google Translate, lưu sẵn DB). UI cũng chuyển được **Tiếng Việt / English**.

### 📈 Theo dõi tiến độ
- Streak (chuỗi ngày liên tục)
- Thẻ đến hạn / đã thuộc / đang học
- Thanh tiến độ theo từng cấp CEFR (A1–C1)
- Heatmap hoạt động 365 ngày
- Dự báo ôn tập 30 ngày + xu hướng độ chính xác
- **Tóm tắt phiên học** chi tiết: % đúng, thời gian, phân bổ 4 nút Again/Hard/Good/Easy

### 🖼️ Ảnh & âm thanh
- **Ảnh thật trực tiếp** trên thẻ — Wikimedia Commons cho danh từ cụ thể có bài Wikipedia, **Pexels** phủ toàn bộ số còn lại (từ trừu tượng lấy kết quả tìm kiếm phù hợp nhất).
- **Phát âm thật** (bản ghi từ dictionaryapi.dev) + fallback Web Speech API đọc đúng từ.

### 🎨 Thiết kế
"Aesthetic Atelier" — nền giấy ấm, font **Fraunces** (serif) + **Hanken Grotesk**, accent saffron-ember & moss, texture giấy nhẹ, animation mượt (Motion). Light/Dark theme, responsive đầy đủ (mobile bottom-tab nav). Loading mượt: **progress bar + skeleton** khi chuyển trang.

### 🔐 Đăng nhập & đồng bộ
**Google OAuth** (NextAuth v4 + Prisma adapter). Dữ liệu học lưu trên **Neon Postgres** → sync giữa các thiết bị theo tài khoản.

---

## 🚀 Chạy local

```bash
npm install
npx prisma generate          # sinh Prisma client
npx prisma db push           # tạo schema trên Postgres (cần DATABASE_URL)
npm run db:seed              # nạp 3.677 từ nền (A1–B2) từ data/vocabulary.json
npm run packs:import         # nạp thêm 14 bộ từ nguồn (→ 8.011 từ, có C1)
npm run images:apply         # nạp ảnh đã crawl sẵn (data/images.json) vào DB
npm run dev                  # http://localhost:3000
```

> `packs:import` idempotent (chạy lại không đổi gì): từ mới → thêm, từ đã có → hợp nhất chủ đề, **không ghi đè** cefr/nghĩa. Thêm `-- --dry-run` để xem trước.

Cần file `.env` (KHÔNG commit). Copy từ template đã có sẵn:

```bash
cp .env.example .env
```

`.env.example` liệt kê **đủ 12 biến** production đang dùng, kèm chú thích từng biến —
gồm cả nhóm nhắc học (`VAPID_*`, `CRON_SECRET`) mà bản README cũ bỏ sót.
Chạy local tối thiểu chỉ cần `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
và `AUTH_BYPASS=1`.

> Muốn setup Neon + Google OAuth đầy đủ, xem `DEPLOY.md`.

---

## 🏗️ Tech stack

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| DB | PostgreSQL (Neon) + Prisma ORM |
| Auth | NextAuth v4 + Google + Prisma adapter |
| SRS | [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) |
| UI | Tailwind CSS + Motion (Framer Motion) + lucide-react |
| Charts | Recharts |
| i18n | client-side (VI/EN) |
| Deploy | Vercel + Neon · CI: GitHub Actions |

### Cấu trúc
```
prisma/         schema.prisma + seed/translate/assign-topics/fetch-images/apply-images/import-packs scripts
scripts/packs/  pipeline dựng bộ từ chuyên đề: fetch-sources → build-wordlists → enrich → translate
scripts/images/ fetch-pexels: crawl ảnh Pexels cho từ chưa có ảnh → data/images.json
src/app/        routes: study (flashcard/quiz/typing/dictation/cram), stats, topics, browse, settings, login + api/
src/components/ study/*, stats/*, nav, i18n, theme, audio, word-image
src/lib/        fsrs, study-engine, stats, auth, session, topics-data, tts, cloze, i18n dictionaries
data/           vocabulary.json (3.677 từ nền) · packs/*.json (14 bộ nguồn) · images.json (word→ảnh, durable) · SOURCES.md (giấy phép nguồn)
```

---

## 📊 Dữ liệu

**8.011 từ** trong DB — nền **Oxford 5000** (A1–B2, 3.677 từ) + 14 bộ nguồn (thêm C1 và từ vựng theo lĩnh vực), enrich đầy đủ:
- IPA (UK + US), loại từ (Anh + Việt)
- Nghĩa tiếng Anh + **dịch tiếng Việt** (từ điển mở OVDP Anh–Việt, fallback Google Translate)
- Câu ví dụ + dịch VI
- Từ đồng nghĩa / trái nghĩa
- Audio phát âm (UK/US) · Ảnh thật (Wikimedia + Pexels — 7.987/8.011 từ, 99,7%)

| Cấp | Số từ |
|---|---|
| A1 | 928 |
| A2 | 903 |
| B1 | 1.346 |
| B2 | 2.537 |
| C1 | 2.297 |

<sub>Số đếm trực tiếp từ DB. Kiểm lại bất cứ lúc nào bằng `npm run packs:verify` (read-only).</sub>

### 📦 Bộ từ chuyên đề (word packs)

14 bộ dựng từ danh sách tần suất mở (NGSL/BSL/TSL), Oxford C1, batch crawl theo lĩnh vực và list IT tự soạn.

Lưu ý: 14 là số **file nguồn**, không phải số chủ đề người dùng thấy — `oxford-c1`, `daily-communication` và
`logistics` là input dựng dữ liệu chứ không phải chủ đề riêng (xem `src/lib/topic-taxonomy.ts`).

| Bộ | Chủ đề | Số từ | Nguồn |
|---|---|---|---|
| `business` | Tiếng Anh Thương mại | 1.744 | BSL 1.2 |
| `daily-communication` | — (từ vựng chung) | 1.622 | crawl batch |
| `oxford-c1` | — (nâng cấp C1) | 1.314 | Oxford 5000 (slice C1) |
| `toeic` | Trọng tâm TOEIC | 1.250 | TSL 1.2 |
| `conversation` | Giao tiếp hằng ngày | 721 | NGSL-Spoken 1.2 |
| `medical` | Y khoa | 464 | crawl batch |
| `it-programming` | CNTT & Lập trình | 442 | list tự soạn (informed by CSWL) |
| `legal` | Pháp lý | 261 | crawl batch |
| `daily-life` | Đời sống hằng ngày | 194 | crawl batch |
| `finance` | Tài chính | 125 | crawl batch |
| `social` | Xã hội | 124 | crawl batch |
| `office-skills` | Kỹ năng văn phòng | 65 | crawl batch |
| `travel` | Du lịch | 60 | crawl batch |
| `logistics` | — (gộp vào Thương mại) | 15 | crawl batch |

<sub>Tổng số dòng trong các file là 8.401, nhiều hơn 8.011 từ trong DB: các bộ chồng lấn nhau và `packs:import` khử trùng lặp theo từ.</sub>

Giấy phép + attribution từng nguồn: xem [`data/SOURCES.md`](data/SOURCES.md). File `data/packs/*.json` là **build artifact** đã commit — dựng lại bằng `npm run packs:fetch && packs:build && packs:enrich && packs:translate`.

**Scripts:**
```bash
npm run packs:build          # dựng danh sách từ (cần data/raw/ từ packs:fetch)
npm run packs:enrich         # IPA/nghĩa/ví dụ (dictionaryapi.dev + kaikki fallback)
npm run packs:translate      # nghĩa VI (từ điển OVDP + gtx fallback, chọn nghĩa theo ngữ cảnh)
npm run packs:import         # nạp vào DB (idempotent, hỗ trợ --dry-run)
npm run packs:verify         # kiểm tra chất lượng dữ liệu trong DB (chỉ đọc)
```

### 🖼️ Ảnh (image backfill)

Ảnh thật lưu ở `Word.imageUrl`, nguồn kép: **Wikimedia** (bài Wikipedia trùng tên từ, không cần key) và **Pexels** (phủ toàn bộ số còn lại, cần `PEXELS_API_KEY` miễn phí — [pexels.com/api](https://www.pexels.com/api/)). Artifact bền `data/images.json` (đã commit) là nguồn thật của mapping từ → ảnh, tách khỏi DB nên reset DB không mất ảnh.

```bash
npm run images:fetch-wikimedia  # crawl Wikipedia trước (ưu tiên ảnh thật hơn stock)
npm run images:fetch            # crawl Pexels cho từ còn thiếu → data/images.json (resumable)
npm run images:apply            # nạp data/images.json vào Word.imageUrl (--dry-run để xem trước)
```

`images:fetch` tự đồng bộ ảnh Wikimedia đã có trong DB vào `images.json`, không bao giờ ghi đè ảnh Wikimedia bằng Pexels, và cache mọi kết quả (kể cả rỗng) dưới `data/cache/pexels/` nên chạy lại không tốn quota. Tốc độ tự điều tiết theo phản hồi thực tế của API (backoff cố định khi gặp 429, **không** tin theo header `x-ratelimit-reset` — đã quan sát thấy header này trả giá trị vô nghĩa); chạy nền, Ctrl-C/chạy lại thoải mái, tiến độ không mất.

---

## 🔧 Mở rộng
- **Multi-user:** đã per-user (mọi bảng scope theo `userId` qua session Google).
- **Tối ưu FSRS:** `ts-fsrs` hỗ trợ optimize tham số từ lịch sử ôn → scheduler cá nhân hoá.
- **Thêm ngôn ngữ UI:** thêm entry vào `src/lib/i18n/dictionaries.ts`.
- **Ngữ pháp:** đang xây — dùng lại chính bộ lập lịch FSRS, áp cho các điểm ngữ pháp.
- **Đổi logo:** sửa `MARK` trong `src/lib/brand.ts`, chạy `npm run brand:icons`, commit lại PNG.

---

---

## 📄 Giấy phép

Mã nguồn: **MIT** (xem [`LICENSE`](LICENSE)).

Dữ liệu trong `data/` **không** thuộc phạm vi MIT — đó là build artifact dẫn xuất từ
nhiều nguồn với giấy phép khác nhau (CC BY 3.0, CC BY-SA 3.0, và một từ điển Việt chỉ
cho phép phi thương mại). Chi tiết từng nguồn: [`data/SOURCES.md`](data/SOURCES.md).

---

*Xây dựng cá nhân — data học sync qua Neon, deploy Vercel, CI GitHub Actions.*
