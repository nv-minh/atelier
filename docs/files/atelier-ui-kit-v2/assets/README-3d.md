# Bộ asset 3D — 1.375 vật thể

Nguồn: **Microsoft Fluent Emoji** · giấy phép **MIT** · dùng thương mại tự do, không cần ghi công.

```
assets/
├── 3d/                    1.375 file .webp, 256×256, ~4,5 KB/file, tổng 6 MB
├── 3d-manifest.json       slug -> { name, keys }  (dùng để tìm kiếm)
├── 3d-topics.json         28 chủ đề -> slug asset
├── map-vocab-to-3d.py     bộ khớp từ vựng -> asset
└── fetch-3d-assets.py     script crawl lại / mở rộng
```

## Tên file

Đặt theo tên Unicode chuẩn hoá, ví dụ `spider.webp`, `red-apple.webp`, `fork-and-knife-with-plate.webp`.
Tra tên qua `3d-manifest.json`:

```json
"spider": { "name": "spider", "keys": ["spider"] }
"red-apple": { "name": "red apple", "keys": ["apple", "red", "red apple"] }
```

## Khớp với 8.011 từ

```bash
# xuất từ vựng: [{"word":"spider","pos":"noun"}, ...]
python3 map-vocab-to-3d.py words.json > vocab-3d-map.json
```

Tỉ lệ phủ đã đo:

| Mẫu | Phủ |
|---|---|
| 80 từ cụ thể A1–A2 | **96%** |
| 40 từ trừu tượng vần A | **5%** |

Ước tính trên toàn bộ 8.011 từ: **20–25% dùng 3D**, còn lại dùng thẻ chữ. Đây là kết quả đúng — ảnh cho từ trừu tượng luôn gây nhiễu.

Bộ khớp đã chặn sẵn: từ loại chức năng, hậu tố trừu tượng (`-tion`, `-ness`, `-ity`…), danh sách nhạy cảm, điểm khớp < 70.

⚠️ Kiểm tra thủ công **200 từ khớp điểm 70** trước khi ghi vào DB — đây là nhóm dễ sai nhất.

## Dùng trong code

```tsx
<Art3D slug="spider" size={192} float enter />
```

```tsx
// src/components/app/Art3D.tsx
export function Art3D({ slug, size = 192, float, enter, alt = '' }) {
  return (
    <div className="art3d-stage" style={{ width: size, height: size }}>
      <img
        src={`/3d/${slug}.webp`}
        width={size} height={size} alt={alt}
        className={`art3d ${float ? 'art3d-float' : ''} ${enter ? 'art3d-enter' : ''}`}
      />
    </div>
  )
}
```

Các class `.art3d`, `.art3d-stage`, `.art3d-float`, `.art3d-enter` đã có sẵn trong `02-tokens.css` mục 7.

## Triển khai

- Copy `3d/` vào `public/3d/`
- `Cache-Control: public, max-age=31536000, immutable`
- Service worker precache toàn bộ 6 MB → học offline đầy đủ
- Kích thước cố định 192×192 → **không bao giờ CLS**
- `loading="eager"` cho thẻ hiện tại, `lazy` cho phần còn lại

## Mở rộng

`fetch-3d-assets.py` crawl trực tiếp từ repo GitHub. Cách nhanh hơn (không dính rate limit):

```bash
npm pack @lobehub/fluent-emoji-3d   # 16 MB, toàn bộ thư viện
```

Nguồn 3D thay thế nếu cần thêm (kiểm tra giấy phép từng bộ):

| Nguồn | Giấy phép |
|---|---|
| **Fluent Emoji** (đang dùng) | MIT |
| Noto Emoji | Apache 2.0 / OFL |
| OpenMoji | CC BY-SA 4.0 (**bắt buộc ghi công**) |
| Shapefest | free, kiểm tra điều khoản |
| Icons8 3D (Ouch) | free có ghi công |
