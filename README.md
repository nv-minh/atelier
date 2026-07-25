# Atelier — Vocabulary Studio

[![CI](https://github.com/nv-minh/vocab-training/actions/workflows/ci.yml/badge.svg)](https://github.com/nv-minh/vocab-training/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-Vercel-ember)](https://vocab-master-dusky.vercel.app)

Web app **full-stack** luyện từ vựng tiếng Anh (A1–B2) bằng **spaced repetition (FSRS)** — thuật toán họ Anki 2024. Xây bằng Next.js, Prisma + PostgreSQL, giao diện ấm kiểu editorial, có đăng nhập GitHub + đồng bộ dữ liệu học giữa các thiết bị.

```
3.677 từ · 5 chế độ học · FSRS scheduler · song ngữ Anh–Vi · đăng nhập GitHub
```

👉 **Demo chạy thật:** https://vocab-master-dusky.vercel.app

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

### 🎴 5 chế độ luyện tập
- **Flashcard** — lõi SRS: lật thẻ → đánh giá → lặp. Hỗ trợ 3 hướng: **Word→Meaning**, **Meaning→Word**, **Cloze** (điền khuyết trong câu ví dụ).
- **Trắc nghiệm** — chọn nghĩa trong 4 đáp án cùng cấp CEFR.
- **Gõ đáp án** — active recall, chấp nhận sai 1 ký tự (Levenshtein).
- **Nghe & viết** — nghe audio (UK/US, chỉnh tốc độ) rồi chép lại.
- **Cram (ôn tự do)** — drill nhanh theo cấp/chủ đề, **không đụng lịch SRS** — hợp ôn trước thi.

Mọi chế độ (trừ Cram) ghi vào cùng lịch FSRS; Quiz/Typing/Dictation tự đánh giá (đúng → Good, sai → Again).

### 🌐 Song ngữ Anh–Vi
Nghĩa + ví dụ hiện **cả tiếng Anh lẫn tiếng Việt** (dịch batch qua Google Translate, lưu sẵn DB). UI cũng chuyển được **Tiếng Việt / English**.

### 📈 Theo dõi tiến độ
- Streak (chuỗi ngày liên tục)
- Thẻ đến hạn / đã thuộc / đang học
- Thanh tiến độ theo từng cấp CEFR (A1–B2)
- Heatmap hoạt động 365 ngày
- Dự báo ôn tập 30 ngày + xu hướng độ chính xác
- **Tóm tắt phiên học** chi tiết: % đúng, thời gian, phân bổ 4 nút Again/Hard/Good/Easy

### 🖼️ Ảnh & âm thanh
- **Ảnh thật trực tiếp** trên thẻ (lấy từ Wikimedia Commons cho ~670 danh từ cụ thể).
- **Phát âm thật** (bản ghi từ dictionaryapi.dev) + fallback Web Speech API đọc đúng từ.

### 🎨 Thiết kế
"Aesthetic Atelier" — nền giấy ấm, font **Fraunces** (serif) + **Hanken Grotesk**, accent saffron-ember & moss, texture giấy nhẹ, animation mượt (Motion). Light/Dark theme, responsive đầy đủ (mobile bottom-tab nav). Loading mượt: **progress bar + skeleton** khi chuyển trang.

### 🔐 Đăng nhập & đồng bộ
**GitHub OAuth** (NextAuth v4 + Prisma adapter). Dữ liệu học lưu trên **Neon Postgres** → sync giữa các thiết bị theo tài khoản.

---

## 🚀 Chạy local

```bash
npm install
npx prisma generate          # sinh Prisma client
npx prisma db push           # tạo schema trên Postgres (cần DATABASE_URL)
npm run db:seed              # nạp 3.677 từ từ data/vocabulary.json
npm run dev                  # http://localhost:3000
```

Cần file `.env` (KHÔNG commit):
```
DATABASE_URL="postgresql://..."        # Neon / Postgres
NEXTAUTH_SECRET="..."                   # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID="..."                  # GitHub OAuth app
GITHUB_CLIENT_SECRET="..."
AUTH_BYPASS="1"                         # (tuỳ chọn) dùng local không cần login
```

> Muốn setup Neon + GitHub OAuth đầy đủ, xem `DEPLOY.md`.

---

## 🏗️ Tech stack

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| DB | PostgreSQL (Neon) + Prisma ORM |
| Auth | NextAuth v4 + GitHub + Prisma adapter |
| SRS | [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) |
| UI | Tailwind CSS + Motion (Framer Motion) + lucide-react |
| Charts | Recharts |
| i18n | client-side (VI/EN) |
| Deploy | Vercel + Neon · CI: GitHub Actions |

### Cấu trúc
```
prisma/         schema.prisma + seed/translate/assign-topics/fetch-images scripts
src/app/        routes: study (flashcard/quiz/typing/dictation/cram), stats, topics, browse, settings, login + api/
src/components/ study/*, stats/*, nav, i18n, theme, audio, word-image
src/lib/        fsrs, study-engine, stats, auth, session, topics-data, tts, cloze, i18n dictionaries
data/           vocabulary.json (3.677 từ enrich)
```

---

## 📊 Dữ liệu

3.677 từ từ **Oxford 5000** (A1–B2), enrich thêm:
- IPA (UK + US), loại từ (Anh + Việt)
- Nghĩa tiếng Anh + **dịch tiếng Việt** (99%)
- Câu ví dụ + dịch VI
- Từ đồng nghĩa / trái nghĩa
- Audio phát âm (UK/US) · Ảnh thật (Wikimedia, ~670 từ)

| Cấp | Số từ |
|---|---|
| A1 | 898 |
| A2 | 792 |
| B1 | 690 |
| B2 | 1.297 |

---

## 🔧 Mở rộng
- **Multi-user:** đã per-user (mọi bảng scope theo `userId` qua session GitHub).
- **Tối ưu FSRS:** `ts-fsrs` hỗ trợ optimize tham số từ lịch sử ôn → scheduler cá nhân hoá.
- **Thêm ngôn ngữ UI:** thêm entry vào `src/lib/i18n/dictionaries.ts`.
- **Ảnh AI 100%:** thay Wikimedia bằng nguồn AI (Lexica/…) khi API ổn định để phủ mọi từ.

---

*Xây dựng cá nhân — data học sync qua Neon, deploy Vercel, CI GitHub Actions.*
