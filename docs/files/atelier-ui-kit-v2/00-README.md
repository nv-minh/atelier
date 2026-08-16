# Atelier — UI Kit v2 (hướng "Studio xanh")

**Mở `preview.html` trên điện thoại trước tiên.** Nếu không thích hướng này thì dừng, đừng code.

```
atelier-ui-kit-v2/
├── preview.html          ← mockup sống: 3 màn hình thật, có light/dark toggle
├── 00-README.md          ← file này
├── 01-plan.md            ← spec đầy đủ: audit, hướng, token, 12 màn hình, 8 phase
├── 02-tokens.css         ← design token, thả thẳng vào project
├── 03-agent-prompts.md   ← prompt copy-paste cho AI agent theo từng phase
└── assets/
    ├── 3d/               1.375 vật thể 3D webp · 6 MB · MIT
    ├── 3d-manifest.json  slug -> tên + từ khoá tìm kiếm
    ├── 3d-topics.json    28 chủ đề -> asset
    ├── map-vocab-to-3d.py  bộ khớp 8.011 từ -> asset
    ├── fetch-3d-assets.py  crawl lại / mở rộng
    └── README-3d.md      hướng dẫn dùng bộ 3D
```

## Bắt đầu

```bash
# 1. xem trước
open preview.html          # hoặc gửi file lên điện thoại

# 2. cài vào project
cp -r assets/3d            <project>/public/3d
cp 02-tokens.css           <project>/src/styles/tokens.css
cp 01-plan.md 00-README.md <project>/          # để agent đọc được

# 3. khớp từ vựng với asset 3D
python3 assets/map-vocab-to-3d.py words.json > vocab-3d-map.json

# 4. mở 03-agent-prompts.md, chạy "Prompt khởi động", rồi Phase 0 → 7
```

## Ba việc làm ngay, không cần thiết kế lại gì

1. `/topics` đang lộ 6 key i18n: `topics.blurbs.medical`, `.legal`, `.daily-life`, `.finance`, `.social`, `.office-skills`
2. Trang chủ nói "Sắp có: Ngữ pháp, chưa hẹn ngày" trong khi `/grammar` đã chạy với 40+ chủ điểm
3. `/grammar` mất tiêu đề section "Thì" và tên card đầu

## Giấy phép

| Thành phần | Giấy phép |
|---|---|
| Vật thể 3D (Microsoft Fluent Emoji) | MIT — tự do thương mại, không cần ghi công |
| Be Vietnam Pro, IBM Plex Mono, Nunito | OFL |
| Token, plan, preview | tạo riêng cho dự án này |
