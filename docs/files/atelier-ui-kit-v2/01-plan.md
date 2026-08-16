# Atelier — Kế hoạch tái thiết kế UI v2

> Hướng "Studio xanh": xanh royal + lavender, thẻ bo mềm, nhân vật 3D.
> **Bản này thay thế hoàn toàn v1.** Viết cho AI coding agent thực thi tuần tự.
> File đi kèm: `02-tokens.css` · `03-agent-prompts.md` · `preview.html` · `assets/`

---

## 0. Cách dùng

1. Mở `preview.html` **trên điện thoại** trước. Nếu không thích hướng này thì dừng, đừng code.
2. Đọc mục 1 → 4 trước khi gõ dòng code đầu tiên.
3. Làm đúng thứ tự phase ở mục 12. Mỗi phase có tiêu chí nghiệm thu.
4. Mọi màu / khoảng cách / bo góc / font-size đọc từ `02-tokens.css`. Cần giá trị mới → thêm token, không hard-code.
5. Mâu thuẫn giữa tài liệu và code thực tế → ghi vào `MIGRATION-NOTES.md`, hỏi người dùng, **không tự ý bỏ tính năng**.

**Nguyên tắc bao trùm:** app dùng mỗi ngày 10 phút, một tay, trên điện thoại, có thể đang đi xe buýt. Mọi lựa chọn thẩm mỹ thua cuộc trước ba thứ: đọc được, chạm trúng, tải nhanh.

---

## 1. Audit hiện trạng — tóm tắt

Đã audit trực tiếp: `/` `/topics` `/browse` `/grammar` `/grammar/[topic]` `/grammar/.../lesson/[n]`.
Chưa audit được (cần đăng nhập): `/study/*` `/notebook` `/stats` `/leaderboard` `/settings` `/word/*` `/onboarding` → **Phase 0**.

### 🔴 Lỗi chặn — đang chạy trên production

| # | Vấn đề |
|---|---|
| B1 | `/browse` **không có ô tìm kiếm**. 8.011 từ, 201 trang, chỉ có nút Trước/Sau |
| B2 | 40 ảnh Pexels hotlink `w=940` cho thumbnail nhỏ → **3–6 MB/trang** trên 4G |
| T1 | `/topics` lộ raw key i18n: `topics.blurbs.medical`, `.legal`, `.daily-life`, `.finance`, `.social`, `.office-skills` |
| T2 | Card "Tiếng Anh Thương mại" **không có link** |
| G1 | `/grammar` mất tiêu đề section "Thì" và tên card đầu — chỉ còn `0/10 bài · 360 câu hỏi` lơ lửng |
| H1 | `/` là landing marketing cho **cả người đã đăng nhập** — ngày thứ 30 vẫn phải cuộn qua quảng cáo mới tới nút học |
| H3 | Trang chủ nói "Sắp có: Ngữ pháp, chưa hẹn ngày" trong khi `/grammar` **đã chạy** với 40+ chủ điểm |
| X1 | Không có bottom nav; 8 mục nav ở đỉnh màn hình, ngoài tầm ngón cái |
| X2 | `meta viewport` thiếu `viewport-fit=cover` → `env(safe-area-inset-*)` luôn trả 0 |
| X3 | Chế độ standalone không có nút Back → người dùng kẹt |

### 🟠 Ưu tiên cao

| # | Vấn đề |
|---|---|
| H2 | Nav render **2 lần** trong DOM (bộ 8 mục + bộ 6 mục) |
| B3 | Phân trang Trước/Sau; mất vị trí cuộn khi back |
| B4 | Một dòng `/browse` nhồi 8 trường cùng trọng lượng thị giác |
| B5 | Bộ lọc 28 chủ đề đổ dọc trong luồng nội dung |
| B6 | Ảnh không khớp nghĩa: `a` dùng ảnh chữ "A" 960px; `abstract`/`abstraction` chung ảnh; `abortion` gắn ảnh người thật |
| T3 | Card chủ đề preview 4 từ theo alphabet: `airport apple bill cinema` — vô nghĩa |
| T4 | Chủ đề trùng khái niệm: Giao tiếp / Giao tiếp hằng ngày / Giao tiếp xã hội; Công việc / Thương mại / Kỹ năng văn phòng; Tiền bạc / Tài chính; Nhà cửa / Sinh hoạt; Cơ thể / Y khoa |
| T5 | Sắp xếp theo số từ giảm dần → người mới không biết bắt đầu từ đâu |
| G2 | Số liệu phi lý: "0/1 bài · 200 câu hỏi"; "Trạng từ · 0/11 bài · 60 câu hỏi" |
| G4 | Bài học dùng markdown thô: `*Present Continuous*` in nghiêng, ký tự `►` làm callout |
| G5 | Ví dụ đúng/sai hiển thị **giống hệt nhau** — mất thông tin quan trọng nhất |
| X5 | Không có dark mode. Học buổi tối là khung giờ chính |
| X6 | Từ loại sai hàng loạt: `about`, `above`, `abroad`, `absolutely` đều gắn "Động từ" |
| X7 | Nghĩa Việt lỗi: `academy` → "ton giảng triết học); trường phái triết học Pla; học viện". Synonym lạ: `accessibility` → "a11y" |

---

## 2. Hướng thiết kế

### 2.1 Tinh thần

Lấy từ mockup bạn gửi: nền lavender rất nhạt chuyển sắc, thẻ trắng bo mạnh, một màu xanh royal duy nhất làm điểm nhấn, nhân vật 3D bóng bẩy làm nhân vật chính. Cảm giác: **sáng, mềm, thân thiện, hiện đại** — không phải nghiêm nghị.

### 2.2 Bốn nguyên tắc

1. **Một màu điểm nhấn.** Toàn app chỉ có xanh `#2C4EE8` làm màu hành động. Các màu khác (hổ phách, bạc hà, san hô, tím) chỉ được dùng đúng vai trò đã gán ở mục 3.2 — không dùng trang trí.
2. **Vật thể 3D là nhân vật, không phải icon.** Nó lớn, có bóng đổ, có quầng sáng, đứng giữa thẻ. Nếu bạn đang cân nhắc đặt nó ở góc như một icon 24px thì dùng icon line đi, đừng dùng 3D.
3. **Bo góc mạnh và đều tay.** Thẻ 24–28px, nút 16px, chip tròn hết. Không trộn bo nhẹ với bo mạnh trong cùng màn hình.
4. **Ngón cái là đơn vị đo.** Mọi hành động lặp lại nằm ở 1/3 dưới màn hình. Đỉnh màn hình chỉ để đọc.

### 2.3 Hai signature

**Dải khoảng ôn** — hiện khoảng ôn kế tiếp ngay dưới mỗi nút chấm điểm: `Lại · 10ph` / `Khó · 2ng` / `Tốt · 5ng` / `Dễ · 12ng`. FSRS đã tính sẵn, chỉ là chưa ai cho người dùng thấy. Đây là thứ Quizlet/Memrise không có. Sau khi chấm, chấm tròn trượt sang mốc mới 340ms.

**Con dấu CEFR** — A1→C1 là một thang tiến bộ, không phải 5 hạng mục ngang nhau. Mã hoá bằng độ đậm trên **một** hue xanh: A1 viền mờ → A2 viền rõ → B1 nền nhạt → B2 nền đậm → C1 mực đặc. Nhìn lướt biết ngay từ khó hay dễ.

### 2.4 Cảnh báo font — đọc kỹ

Font trong mockup nhìn giống **Poppins**. **Poppins không hỗ trợ đầy đủ dấu tiếng Việt** — `ệ ặ ỡ ữ` sẽ vỡ hoặc rơi về font hệ thống, làm giao diện lệch hẳn. Gilroy và Sora cũng thiếu.

Dùng **Be Vietnam Pro** (OFL): thiết kế riêng cho dấu tiếng Việt, có weight tới 800, dáng chữ rất gần mockup. Nếu muốn tròn hơn nữa thì **Nunito** (OFL, có tiếng Việt).

Phiên âm IPA: **IBM Plex Mono**, dự phòng **Charis SIL**. Bắt buộc test glyph `/əbˈdʌk.ʃn̩/ /ˌækəˈdemɪk/` trước khi chốt — thiếu glyph sẽ ra ô vuông tofu.

---

## 3. Design tokens

Toàn bộ ở `02-tokens.css`. Điểm phải nhớ:

### 3.1 Quy tắc cứng

- **Không hard-code hex.** Sau Phase 2: `grep -rn "#[0-9a-fA-F]\{6\}" src/components` phải ra 0 dòng.
- **Không `100vh`** — dùng `100dvh`. `100vh` sai trên Safari mobile.
- **Không `env(safe-area-*)` rải rác** — dùng `var(--safe-t)`, `var(--safe-b)`, `var(--pad-bottom-nav)`.
- **Không z-index tự nghĩ** — dùng `var(--z-*)`.
- **Nền là gradient, không phải màu phẳng.** `--bg-canvas` là `linear-gradient` + `background-attachment: fixed`. Đây là chữ ký của hướng này; đặt màu phẳng sẽ mất chất ngay.
- **Bóng đổ ám xanh.** `rgb(44 78 232 / …)`, không dùng bóng xám trung tính — trên nền lavender bóng xám trông bẩn.
- Dark mode qua `[data-theme="dark"]` trên `<html>`, không qua class Tailwind `dark:` — để một biến điều khiển tất cả, kể cả `<meta name="theme-color">`.

### 3.2 Vai trò màu — không được dùng sai

| Token | Chỉ dùng cho |
|---|---|
| `--accent` xanh | hành động, link, focus, thanh tiến độ, tab đang chọn |
| `--due` hổ phách | số từ đến hạn, chuỗi ngày |
| `--mastered` tím | trạng thái "đã thuộc" |
| `--correct` bạc hà | phản hồi đúng — **chỉ trong phiên học** |
| `--wrong` san hô | phản hồi sai — **chỉ trong phiên học** |

Ngoài phiên học, màn hình chỉ được có xanh + hổ phách + tím. Bạc hà và san hô không xuất hiện ở dashboard, thư viện, cài đặt.

### 3.3 Nối vào Tailwind

```js
// tailwind.config.ts
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: { extend: {
    colors: {
      surface: 'var(--bg-surface)', sunken: 'var(--bg-sunken)', tint: 'var(--bg-tint)',
      fg: { DEFAULT:'var(--fg-default)', muted:'var(--fg-muted)', subtle:'var(--fg-subtle)' },
      accent: { DEFAULT:'var(--accent)', hover:'var(--accent-hover)',
                soft:'var(--accent-soft)', subtle:'var(--accent-subtle)', fg:'var(--accent-fg)' },
      due:'var(--due)', mastered:'var(--mastered)',
      correct:'var(--correct)', wrong:'var(--wrong)', hairline:'var(--border-hairline)',
    },
    fontFamily: { display:'var(--font-display)', sans:'var(--font-body)',
                  mono:'var(--font-mono)', ipa:'var(--font-ipa)' },
    borderRadius: { xs:'var(--r-xs)', sm:'var(--r-sm)', md:'var(--r-md)',
                    lg:'var(--r-lg)', xl:'var(--r-xl)', '2xl':'var(--r-2xl)' },
    boxShadow: { xs:'var(--shadow-xs)', sm:'var(--shadow-sm)', md:'var(--shadow-md)',
                 lg:'var(--shadow-lg)', accent:'var(--shadow-accent)' },
    zIndex: { appbar:'20', tabbar:'30', sheet:'40', overlay:'50', toast:'60' },
  }},
}
```

---

## 4. Hệ thống hình ảnh — phần quan trọng nhất

Đây là chỗ thay đổi lớn nhất so với hiện trạng, và cũng là chỗ tiết kiệm băng thông lớn nhất.

### 4.1 Bỏ ảnh chụp, dùng vật thể 3D

| | Ảnh Pexels (hiện tại) | Vật thể 3D (mới) |
|---|---|---|
| Dung lượng | 60–200 KB/ảnh | **4,5 KB/ảnh** |
| Khớp nghĩa | thường sai | chính xác theo Unicode |
| Nhất quán | mỗi ảnh một phong cách | một phong cách duy nhất |
| Nhạy cảm | `abortion` ra ảnh người thật | không có |
| Offline | không cache nổi | **cache toàn bộ 6 MB** |
| Giấy phép | phải ghi công Wikimedia | MIT, tự do |

Bộ asset: **1.375 vật thể 3D**, tổng **6 MB**, trong `assets/3d/`. Nguồn: Microsoft Fluent Emoji (MIT).

### 4.2 Tỉ lệ phủ — số liệu thật đã đo

Chạy bộ khớp trên hai mẫu:

| Mẫu | Phủ |
|---|---|
| 80 từ cụ thể A1–A2 (`dog`, `apple`, `spider`, `airplane`…) | **96%** |
| 40 từ đầu `/browse` vần A (`abandon`, `ability`, `abstraction`…) | **5%** |

Kết luận: 3D phủ gần trọn từ vựng cụ thể — đúng nhóm mà hình ảnh thật sự giúp ghi nhớ. Từ trừu tượng gần như không phủ được, **và đó là điều đúng**: ảnh cho từ trừu tượng luôn gây nhiễu.

Ước tính trên 8.011 từ: khoảng **20–25% dùng 3D**, phần còn lại dùng thẻ chữ.

### 4.3 Hai loại thẻ

Thêm cột `image_policy` vào dữ liệu từ: `art3d` | `typographic`. Mặc định `typographic`.

**Thẻ 3D** (`art3d`) — vật thể lớn 192px, có `.art3d-stage` tạo quầng sáng, `filter: drop-shadow` để nó "đứng" trên mặt phẳng thay vì trôi lơ lửng, hiệu ứng `art3d-enter` nảy nhẹ khi vào màn hình.

**Thẻ chữ** (`typographic`) — **không phải trạng thái lỗi.** Từ đặt rất lớn (`--text-hero`, weight 800) trên nền `--bg-tint`, phiên âm mono bên dưới, con dấu CEFR góc trên phải. Phải trông có chủ đích. Nếu nó trông như thẻ bị thiếu ảnh thì bạn đã làm sai.

### 4.4 Quy tắc cấm gán ảnh

Bộ khớp `assets/map-vocab-to-3d.py` đã chặn sẵn, giữ nguyên các quy tắc này:

- Từ loại chức năng (giới từ, liên từ, đại từ, mạo từ) → không bao giờ có ảnh
- Hậu tố trừu tượng (`-tion`, `-ness`, `-ment`, `-ity`, `-ance`, `-ism`, `-ability`…) → không có ảnh
- Danh sách nhạy cảm (`abortion`, `abuse`, `addiction`, `suicide`, `weapon`, `drug`…) → không có ảnh
- Điểm khớp < 70 → không có ảnh

### 4.5 Chạy khớp

```bash
# xuất từ vựng ra JSON: [{"word":"spider","pos":"noun"}, ...]
python3 assets/map-vocab-to-3d.py words.json > vocab-3d-map.json
```
In ra stderr tỉ lệ phủ. Kiểm tra thủ công **200 từ khớp điểm 70** trước khi ghi vào DB — đây là nhóm dễ sai nhất.

### 4.6 Kỹ thuật

- Serve từ `public/3d/`, `Cache-Control: public, max-age=31536000, immutable`
- `next/image` với `width={192} height={192}` cố định → **không bao giờ CLS**
- Service worker precache toàn bộ 6 MB → học offline đầy đủ
- Prefetch asset của 2 thẻ kế tiếp
- `loading="eager"` cho thẻ hiện tại, `lazy` cho phần còn lại

---

## 5. App shell & điều hướng

### 5.1 Từ 8 mục trên đỉnh → 5 tab nổi dưới đáy

| Tab | Route | Ghi chú |
|---|---|---|
| Học | `/` (dashboard) | tab mặc định khi đã đăng nhập |
| Chủ đề | `/topics` | nút tìm kiếm ở app bar dẫn tới `/browse` |
| **Ôn ngay** | `/study` | nút nổi giữa, nền `--accent`, badge số từ đến hạn |
| Ngữ pháp | `/grammar` | |
| Tôi | `/me` | gộp Sổ tay + Tiến độ + Xếp hạng + Cài đặt |

Nav dạng **viên thuốc nổi**: cách mép 12px, nền `--bg-glass` + `backdrop-filter: blur(18px)`, bo `--r-2xl`, bóng `--shadow-md`. Ẩn hoàn toàn trong `/study/*`.

### 5.2 Bắt buộc cho PWA

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F5F7FF" />
<meta name="theme-color" media="(prefers-color-scheme: dark)"  content="#0A0E22" />
<meta name="apple-mobile-web-app-capable" content="yes" />
```

1. `viewport-fit=cover` — thiếu thì `env(safe-area-inset-*)` luôn trả 0 (X2)
2. `theme-color` theo dark mode — hiện để `#1F1C16` cho cả hai, thanh trạng thái tối trên nền sáng trông vỡ
3. Nút Back trong standalone (X3):
   ```ts
   const isStandalone = matchMedia('(display-mode: standalone)').matches
     || (navigator as any).standalone === true
   ```
4. Vuốt từ mép trái để back, ngưỡng 30% chiều rộng
5. Icon maskable với safe zone 40% — thiếu thì Android cắt góc
6. `apple-touch-startup-image` ≥ 6 kích thước (iOS không tự sinh)

---

## 6. Thư viện component

`src/components/ui/` (primitive) và `src/components/app/` (domain).

### 6.1 Primitive

| Component | Biến thể | Cao | Ghi chú |
|---|---|---|---|
| `Button` | primary / secondary / ghost / danger | 40 / 48 / 56 | primary có `--shadow-accent`; active `scale .97` |
| `IconButton` | ghost / filled | 44 / 48 | luôn có `aria-label` |
| `Chip` | filter / tag / choice | 34 | bo `--r-pill` |
| `Card` | flat / raised / interactive | – | bo `--r-xl`, bóng `--shadow-sm` |
| `Sheet` | bottom / full | – | vuốt xuống đóng, drag handle 36×4, `--safe-b` |
| `Toast` | info / success / error | – | nổi **trên** nav, tự tắt 3.2s, có Hoàn tác |
| `Input` | text / search | 48 | `font-size: 16px` bắt buộc — nhỏ hơn iOS tự zoom |
| `SegmentedControl` | – | 40 | giọng US/UK, phạm vi lọc |
| `ProgressBar` | line / ring | – | line cao 7–8px, bo pill, nền `--bg-sunken` |
| `Skeleton` | text / card / art3d | – | shimmer 1.4s, tắt khi reduced-motion |
| `EmptyState` | – | – | vật thể 3D 120px + 1 câu + 1 nút |
| `Tabs` | pill | 44 | cuộn ngang, scroll-snap |

### 6.2 Domain

| Component | Mô tả |
|---|---|
| `Art3D` | bọc `<img>` + `.art3d-stage`, props: `slug`, `size`, `float`, `enter` |
| `WordVisual` | chọn giữa `Art3D` và `TypographicCard` theo `image_policy` |
| `CefrStamp` | con dấu A1–C1 (2.3) |
| `IntervalRibbon` | signature (2.3) |
| `WordCard` | thẻ học, lật 3D |
| `WordRow` | 1 dòng `/browse`, 3 dòng nội dung |
| `RatingBar` | 4 nút FSRS + khoảng ôn dự kiến |
| `SessionProgress` | thanh tiến độ + số thẻ + nút thoát |
| `StreakCard` | số mono + dải 7 ô tuần + vật thể 3D `fire` |
| `TopicCard` | vật thể 3D 46px + tên + vòng tiến độ |
| `GrammarLessonBody` | renderer bài học (mục 8.6) |
| `ExampleBlock` | ví dụ neutral / correct / wrong |
| `PronounceButton` | 3 trạng thái: idle / phát / lỗi |

### 6.3 Yêu cầu chung

Vùng chạm ≥ 44×44px · có `:focus-visible` · có `loading` và `disabled` · không animation khi `prefers-reduced-motion` · text không cắt bằng `overflow:hidden` mà thiếu `title`.

---

## 7. Motion

| Nơi | Hiệu ứng | Thời lượng | Easing |
|---|---|---|---|
| Vật thể 3D vào màn hình | `art3d-pop` scale .82→1.04→1 | 340ms | `--ease-bounce` |
| Vật thể 3D đứng yên | `art3d-float` lên xuống 6px | 4.5s lặp | ease-in-out |
| Lật thẻ | rotateY 3D | 460ms | `--ease-out` |
| Chuyển thẻ | trượt trái + mờ | 220ms | `--ease-standard` |
| Nhấn nút | scale .97 | 90ms | `--ease-standard` |
| Dải khoảng ôn dịch chuyển | translateX + scale chấm | 340ms | `--ease-spring` |
| Mở bottom sheet | trượt lên | 300ms | `--ease-out` |
| Chuyển trang | mờ dần | 150ms | `--ease-standard` |

`art3d-float` **chỉ dùng khi màn hình có đúng một vật thể 3D**. Nhiều vật thể cùng trôi = say sóng.

**Haptics** (chỉ khi `navigator.vibrate` tồn tại, có công tắc tắt): lật thẻ 10ms · đúng 15ms · sai [30,40,30] · xong phiên [15,60,25].

**Cấm:** parallax, scroll-reveal trong app, confetti, count-up > 600ms.

---

## 8. Spec màn hình

### 8.1 `/` — tách làm hai

**Chưa đăng nhập → landing**, rút từ 8 section xuống 5:
1. Hero = **demo thẻ thật, chạm được, 0 lần cuộn** + nút "Tiếp tục với Google"
2. Cách hoạt động → `IntervalRibbon` động
3. 7 chế độ → grid 2 cột, vật thể 3D + tên
4. Chủ đề → 8 chip **có link thật** tới `/topics/[slug]` (sửa H6)
5. CTA + footer

Bỏ hẳn section "Sắp có: Ngữ pháp" (sai sự thật — H3), thay bằng số liệu thật + link.

**Đã đăng nhập → dashboard.** Xem `preview.html` màn 2. Ràng buộc cứng: **thẻ "Hôm nay" + nút "Ôn ngay" phải nằm trọn trong màn hình đầu tiên trên iPhone SE (375×667), 0 lần cuộn.**

Thẻ Hôm nay: nền `--accent-gradient`, số lớn mono, thanh tiến độ, nút trắng chữ xanh, vật thể 3D `fire` ở góc dưới phải. Khi 0 từ đến hạn: đổi sang trạng thái nghỉ, vật thể `party-popper`, màu `--mastered`.

### 8.2 `/study` — vỏ phiên học

Toàn màn hình, ẩn nav. Header 48px: `✕` + `ProgressBar` + đếm thẻ + `⋯`. Vùng thẻ căn giữa. Vùng hành động cố định đáy trong 1/3 dưới + `--safe-b`.

- `✕` → sheet xác nhận nếu đã làm > 3 thẻ
- `⋯` → sheet: âm thanh, giọng US/UK, báo lỗi từ, gắn sao
- Khóa input 250ms sau mỗi lần chấm (chống double-tap)
- Prefetch asset + audio 2 thẻ kế tiếp

#### 8.2.1 Flashcard — xem `preview.html` màn 1

Mặt trước: `WordVisual` 192px → từ (`--text-hero`, weight 800) → IPA + nút phát âm → đường kẻ + "Chạm để xem nghĩa". Con dấu CEFR góc trên phải.

Mặt sau: từ + từ loại + CEFR → **nghĩa Việt trước** (16px, `--fg-default`) → nghĩa Anh (14px, `--fg-muted`) → `ExampleBlock` → ☆ Lưu / ✎ Ghi chú.

`RatingBar`: 4 nút cao 56px, mỗi nút có nhãn + khoảng ôn mono bên dưới. `Lại` viền san hô, `Khó` viền hổ phách, `Tốt` **nền xanh đặc** (mặc định), `Dễ` viền bạc hà. Nền các nút giữ trắng — chỉ viền và chữ đổi màu.

#### 8.2.2 Trắc nghiệm
4 lựa chọn cao ≥ 56px, bo `--r-md`. Đúng: nền `--correct-subtle` + viền + ✓ + rung 15ms. Sai: nền `--wrong-subtle` + ✗ + rung [30,40,30], **đồng thời làm sáng đáp án đúng**. Sau khi chọn, thanh đáy trượt lên chứa nghĩa đầy đủ + nút "Tiếp". **Không tự chuyển câu.**

#### 8.2.3 Gõ từ
`font-size: 16px`, `autocapitalize/autocorrect/spellcheck` off. Dùng `visualViewport` API đẩy ô nhập lên trên bàn phím — đây là lỗi kinh điển. Sai 1 ký tự → "Suýt đúng!" + highlight, cho nhập lại 1 lần. Có nút "Không nhớ" ngay dưới.

#### 8.2.4 Nghe viết
Nút phát 72px giữa màn, tự phát 1 lần khi vào. Ô trống `_ _ _ _` gợi độ dài. Nút "Chậm lại" (rate 0.7).

#### 8.2.5 Ghép cặp
Lưới 2×5, ô cao 64px. Đúng cặp → mờ dần + co lại 200ms. Sai → rung ngang 300ms. Có đồng hồ mono — chế độ duy nhất có yếu tố tốc độ.

#### 8.2.6 Phát âm
Nút mic 88px, viền tạo sóng khi ghi. Waveform canvas ≤ 30 thanh (không dùng spinner). Kết quả: từng âm tiết tô màu theo độ khớp. Xử lý rõ trường hợp từ chối quyền mic / trình duyệt không hỗ trợ.

#### 8.2.7 Cram
Chế độ **duy nhất** dùng vuốt: trái = chưa thuộc, phải = thuộc. Thẻ nghiêng tối đa 8°, nhãn mờ "THUỘC"/"CHƯA" khi vượt 25% chiều rộng. Chồng 3 thẻ sau (scale .96/.92). Banner đỉnh: "Chế độ Cram — không ảnh hưởng lịch ôn."

#### 8.2.8 Tổng kết — xem `preview.html` màn 3
Vật thể 3D `trophy` 170px với `art3d-enter` → số thẻ (56px mono) → 3 ô số liệu (đúng % / thời gian / đã thuộc) → `IntervalRibbon` tổng hợp → chip từ cần xem lại → 2 nút.
**Không confetti, không âm thanh chiến thắng.** Phần thưởng là con số và dải khoảng ôn dịch chuyển.

### 8.3 `/topics`
Chip lọc cuộn ngang → section "Gợi ý cho bạn" → grid 2 cột. Mỗi `TopicCard`: vật thể 3D 46px (bảng ở `assets/3d-topics.json`) + tên + số từ + thanh tiến độ.
Sửa: T1 (6 key i18n), T2 (link), T3 (bỏ preview 4 từ alphabet, thay bằng tiến độ + số từ đến hạn), T5 (sắp xếp theo độ phù hợp), T4 (chia 2 nhóm: **Chủ đề đời sống** và **Chuyên ngành & Thi cử** — chỉ nhóm ở tầng hiển thị, không đụng dữ liệu).

### 8.4 `/browse` — sửa nhiều nhất

```
┌────────────────────────────────┐
│ ←  [🔍 Tìm từ…            ]    │  dính đỉnh, luôn hiện
│  [Chủ đề ▾][CEFR ▾][Trạng thái ▾] │ mở bottom sheet
├────────────────────────────────┤
│  8.011 từ                      │
│  spider              B1    🔊  │  WordRow cao 68px
│  /ˈspaɪdər/                    │
│  con nhện                      │
│ ─────────────────────────────  │
│              ⋮ cuộn vô hạn     │
└────────────────────────────────┘
```

| # | Việc | Sửa |
|---|---|---|
| 1 | Ô tìm kiếm dính đỉnh, debounce 250ms, tìm cả Anh và Việt | B1 |
| 2 | **Bỏ thumbnail khỏi danh sách** — ảnh chỉ ở trang chi tiết và thẻ học | B2 |
| 3 | Cuộn vô hạn + ảo hoá `@tanstack/react-virtual`, giữ vị trí khi back | B3 |
| 4 | 3 dòng: từ+CEFR+loa / phiên âm / nghĩa Việt. Nghĩa Anh, synonym, từ loại → trang chi tiết | B4 |
| 5 | Bộ lọc vào bottom sheet, hiện số kết quả trực tiếp, có "Xóa lọc" | B5 |
| 6 | Nhãn `US` → `SegmentedControl` trong sheet cài đặt, không lặp mỗi dòng | B7 |
| 7 | 5 trạng thái → Chip lọc: Tất cả · Chưa gặp · Đang học · Đã thuộc · Đã đánh dấu | B8 |
| 8 | Nhấn giữ → menu nhanh: phát âm, gắn sao, thêm vào phiên | mới |

**`/word/[slug]`:** `WordVisual` 200px → từ + IPA + loa + CEFR → từ loại · nghĩa Việt · nghĩa Anh → `ExampleBlock` → synonym dạng chip bấm được → `IntervalRibbon` lịch sử ôn thật → ghi chú cá nhân → [Thêm vào phiên ôn] ☆

### 8.5 `/grammar`
Thẻ "Tiếp tục" ở đầu (chỉ khi có) → 4 section dạng accordion, mặc định mở section đang học dở.
Sửa G1 (tiêu đề "Thì" + tên card đầu), G2 (audit số liệu; chủ đề 0 câu hỏi thì **ẩn nhãn** thay vì hiện "0 câu hỏi"), G3 (hàng "Nên học trước" gồm 3 chủ điểm nền tảng).

### 8.6 `/grammar/[topic]/lesson/[n]`

| Phần tử | Trình bày |
|---|---|
| Thuật ngữ tiếng Anh trong câu Việt | `<span class="term">`: mono 0.92em, nền `--accent-subtle`, padding 2px 6px, bo `--r-xs`. **Không in nghiêng markdown thô** |
| Câu ví dụ | block riêng: 18px, nền `--bg-surface`, viền trái 3px `--accent`, bo `--r-md` |
| Phần nhấn trong ví dụ (`is reading`) | nền `--accent-subtle`, chữ `--accent-fg`, weight 600 |
| Ví dụ **đúng** | ✓ `--correct`, viền trái `--correct` |
| Ví dụ **sai** | ✗ `--wrong`, chữ `line-through`, opacity .7 |
| Callout `►` | `<Callout>`: nền `--due-subtle`, icon info. Bỏ ký tự `►` thô |
| Số thứ tự "1. hành động đang xảy ra" | ô vuông mono — đây **đúng** là chuỗi |
| Chiều dài dòng | tối đa `--content-max` |
| Thanh "Đã hiểu → Bài 3" | **dính đáy** (sửa G6) |

### 8.7 `/me`
Avatar + tên + trình độ + chuỗi ngày → 3 ô số liệu (đã học / đã thuộc / đến hạn) → danh sách: Sổ tay · Từ hay quên · Tiến độ · Xếp hạng · Xuất CSV/Anki · Cài đặt.

### 8.8 `/stats`
Đúng **3 biểu đồ**: nhiệt đồ 12 tuần (ô 12px, 5 mức đậm của xanh) · đường số từ đã thuộc · phân bố CEFR (5 thanh, nhãn là `CefrStamp`). Cộng 1 câu văn ở đầu: *"Tuần này bạn ôn 210 thẻ, nhiều hơn tuần trước 18%."*
**Không dùng Recharts/Chart.js** — 3 biểu đồ này quá đơn giản để trả giá 100–200 KB. Vẽ SVG thủ công hoặc `visx` module lẻ.

### 8.9 `/leaderboard`
Người dùng hiện tại **sticky** trong danh sách. Nhãn nhỏ "Đối thủ luyện tập" cạnh tên bot — trang chủ đã nói thẳng điều này, giữ nguyên sự trung thực đó. Top 3 dùng số thứ tự mono lớn, không bục vàng-bạc-đồng.

### 8.10 Trạng thái

| Màn hình | Vật thể 3D | Câu chữ |
|---|---|---|
| 0 từ đến hạn | `party-popper` | "Xong hết rồi. Học từ mới?" |
| Sổ tay trống | `bookmark-tabs` | "Chưa có từ nào được lưu. Gắn sao khi học để lưu vào đây." |
| Tìm 0 kết quả | `magnifying-glass-tilted-left` | "Không có từ nào khớp *xyz*." + [Xóa bộ lọc] |
| Offline | `electric-plug` | "Đang ngoại tuyến. 24 từ đã tải sẵn — học tiếp được." |
| Lỗi tải | `construction-sign` | "Không tải được danh sách từ." + [Thử lại] |
| 404 | `world-map` | "Trang này không tồn tại." |

Nguyên tắc viết: **lỗi không xin lỗi, không mơ hồ.** Nói cái gì hỏng và làm gì tiếp.

---

## 9. Streak và động lực

Streak có tác dụng thật: người đạt chuỗi 7 ngày có khả năng hoàn thành khoá học cao gấp **3,6 lần**. Nhưng nó cũng là kỹ thuật rủi ro nhất — vận hành bằng nỗi sợ mất mát, dễ khiến người dùng thấy bị mắc kẹt.

Phản hồi trực tiếp từ nghiên cứu về người học ngôn ngữ: người chỉ học được cuối tuần thấy chuỗi ngày hoàn toàn vô dụng, và bị cảnh báo "sắp mất chuỗi" vào tối thứ Hai là trải nghiệm tệ nhất.

**Bốn quyết định:**

1. **Mục tiêu tuần, không chỉ chuỗi ngày.** Cho chọn "4 ngày/tuần". Người đi làm ở Việt Nam học 4 buổi/tuần là tốt — đừng biến điều đó thành thất bại.
2. **Streak freeze tự động, miễn phí.** Nghỉ 1 ngày trong tuần không phá chuỗi. Không bán "băng đóng chuỗi".
3. **Thông báo nói dữ liệu, không nói nỗi sợ.** ❌ "Chuỗi 12 ngày sắp mất!" ✅ "24 từ đến hạn ôn hôm nay."
4. **Khôi phục nhẹ nhàng.** Màn hình đầu khi quay lại không được là "Bạn đã mất chuỗi 12 ngày", mà là "Chào lại. 38 từ đến hạn — ôn 10 từ trước nhé?"

---

## 10. Accessibility

- [ ] Tương phản chữ thường ≥ 4.5:1, chữ ≥ 24px ≥ 3:1. **Kiểm tra kỹ chữ trắng trên `--accent` và chữ trên nền gradient.** Mockup gốc có chỗ chữ xanh nhạt trên nền xanh — không copy lỗi đó.
- [ ] Mọi `IconButton` có `aria-label` tiếng Việt
- [ ] Focus trap đúng trong sheet/dialog, ESC đóng
- [ ] Vùng chạm ≥ 44×44px
- [ ] `prefers-reduced-motion` tôn trọng — kể cả `art3d-float` và `art3d-enter`
- [ ] `<html lang="vi">`, từ tiếng Anh bọc `<span lang="en">` → screen reader đọc đúng giọng
- [ ] Phiên âm IPA có `aria-hidden` (screen reader đọc IPA nghe rất tệ)
- [ ] Không truyền thông tin **chỉ bằng màu**: đúng/sai luôn kèm icon ✓/✗
- [ ] Vật thể 3D: `alt` mô tả nghĩa từ nếu mang thông tin, `alt=""` nếu trang trí
- [ ] Zoom 200% không vỡ layout

---

## 11. Ngân sách hiệu năng

Đo trên **Moto G Power, 4G chậm**.

| Chỉ số | Mục tiêu |
|---|---|
| LCP | < 2.0s |
| INP | < 200ms |
| CLS | < 0.05 |
| JS route đầu (gzip) | < 180 KB |
| Tổng font | < 120 KB |
| Ảnh trang `/browse` | < 150 KB |
| Toàn bộ asset 3D (precache) | 6 MB |
| Lighthouse Performance mobile | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |

Việc cụ thể: ảo hoá `/browse` · bỏ thumbnail khỏi list · `next/dynamic` cho biểu đồ và chế độ Phát âm · `npx @next/bundle-analyzer` · service worker precache app shell + font + 3D pack.

---

## 12. Lộ trình

| Phase | Việc | Ngày | Nghiệm thu |
|---|---|---|---|
| **0** | Audit 7 trang sau đăng nhập + baseline Lighthouse + bundle | 0.5 | có `MIGRATION-NOTES.md` đầy đủ + số liệu trước |
| **1** | 10 lỗi chặn ở mục 1 | 0.5 | không còn raw i18n key; mọi card click được; `querySelectorAll('nav').length === 1` |
| **2** | Token + font + dark mode + primitive | 1.5 | `/dev/ui` đủ component 2 theme; grep hex ra 0 dòng; test glyph IPA + dấu tiếng Việt pass |
| **2b** | Tích hợp asset 3D | 1 | `/topics` không còn emoji; `WordVisual` chạy đúng 2 policy; chạy xong `map-vocab-to-3d.py` và ghi vào DB |
| **3** | App shell + nav nổi + safe area | 1.5 | cài PWA lên iPhone **và** Android máy thật, không nội dung nào bị che, back luôn dùng được |
| **4** | `/browse` + hệ thống ảnh ⭐ | 2 | LCP < 2s trên 4G chậm; ảnh < 150 KB; tìm được "vocabulary" trong < 3 giây |
| **5** | Phiên học ⭐ | 2.5 | làm hết 30 thẻ **một tay**; INP < 200ms; không thẻ nào layout shift |
| **6** | Dashboard, Chủ đề, Ngữ pháp | 2 | người đã đăng nhập thấy nút "Ôn ngay" ở màn hình đầu, 0 lần cuộn, trên iPhone SE |
| **7** | Stats, xếp hạng, trạng thái, hoàn thiện | 1.5 | mục 10 và 11 tick hết |

**Tổng ~13 ngày.** Cắt còn Phase 0→5 (~9 ngày) đã đổi 80% cảm nhận.

---

## 13. Definition of Done

Merge được khi: chạy đúng ở 360/390/430/768/1024 · đúng ở light và dark · đúng trong PWA standalone trên iOS **và** Android máy thật · không hex hard-code, không `100vh`, không z-index tự nghĩ · đủ trạng thái loading/rỗng/lỗi/offline · vùng chạm ≥ 44px có focus visible · `prefers-reduced-motion` tôn trọng · không thiếu key i18n · Lighthouse không tụt so với baseline · ảnh chụp trước/sau đính vào PR.

---

## 14. Những điều KHÔNG được làm

1. ❌ Thêm mascot hoặc nhân vật hoạt hình có tính cách (vật thể 3D ≠ mascot)
2. ❌ Dùng vật thể 3D như icon nhỏ 24px ở góc — dùng icon line cho việc đó
3. ❌ Cho nhiều hơn **một** vật thể 3D `art3d-float` trên cùng màn hình
4. ❌ Dùng Poppins / Gilroy / Sora (vỡ dấu tiếng Việt)
5. ❌ Đặt `--bg-canvas` thành màu phẳng (mất chữ ký của hướng này)
6. ❌ Dùng bóng đổ xám trung tính
7. ❌ Dùng `--correct` / `--wrong` ngoài phiên học
8. ❌ Gán ảnh cho từ trừu tượng chỉ để lấp chỗ trống
9. ❌ Confetti, âm thanh chiến thắng, modal "Chúc mừng!"
10. ❌ Scroll-reveal / parallax trong app
11. ❌ Tự động chuyển câu sau khi trả lời
12. ❌ Font < 16px cho nội dung đọc hoặc ô nhập (iOS sẽ zoom)
13. ❌ Thư viện biểu đồ nặng cho 3 biểu đồ đơn giản
14. ❌ Bật âm thanh mặc định
15. ❌ Giấu việc đối thủ xếp hạng là bot
16. ❌ Đổi logic FSRS hay schema DB (trừ cột `image_policy` và `art3d_slug`)
