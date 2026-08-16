# Migration UI/UX "Atelier v2" — Design

- **Ngày:** 2026-08-16
- **Trạng thái:** người dùng đã duyệt phạm vi, hướng nhận diện, cách ra nhánh, phạm vi DB và chính sách ảnh (5 câu hỏi, phiên 2026-08-16)
- **Nền code:** `main` (`b9f220c`)
- **Nguồn ràng buộc:** `docs/files/atelier-ui-kit-v2/01-plan.md` + `docs/files/atelier-ui-kit-v2/02-tokens.css`
- **KHÔNG dùng:** `docs/files/atelier-ui-kit-v2/03-agent-prompts.md` — xem §7 R0
- **Asset:** 1.375 webp 3D nằm ngoài git ở `docs/files/atelier-ui-kit-v2/assets/3d/` cho tới khi Plan 2 chép vào `public/3d/`

---

## 1. Bối cảnh

App đang chạy trên hướng nhận diện "giấy + hổ phách" (paper/ink/ember, nền có lớp nhiễu `body::before`, font Literata + Fira Sans + Noto Sans Mono). Kit v2 đổi sang hướng **"Studio xanh"**: xanh royal `#2C4EE8` + lavender, bo góc mạnh (thẻ 24–28px), vật thể 3D làm nhân vật chính thay ảnh chụp, nav dạng viên thuốc nổi ở đáy, và hai "signature": **dải khoảng ôn** (hiện mốc ôn kế tiếp dưới mỗi nút chấm điểm) và **con dấu CEFR** (A1→C1 mã hoá bằng độ đậm trên một hue xanh).

Ngoài thẩm mỹ, đợt này giải quyết một món nợ cấu trúc: **repo chưa từng có thư viện component**. Chuỗi class nút primary bị copy-paste 41 lần; `.card-atelier` xuất hiện 72 chỗ ở 40 file; `.display` ~133 chỗ ở 48 file; `text-soft` 362 chỗ. Không có `Button`, `Input`, `Sheet`, `Chip`, `Tabs`, `EmptyState` nào — chỉ có class trong `@layer components` của `globals.css`.

**Nguyên tắc bao trùm của kit** (§0): app dùng mỗi ngày 10 phút, một tay, trên điện thoại, có thể đang đi xe buýt. Mọi lựa chọn thẩm mỹ thua cuộc trước ba thứ: **đọc được, chạm trúng, tải nhanh**.

---

## 2. Đối chiếu audit của kit với code thật

Kit audit production khi **chưa đăng nhập được** (nó tự ghi điều này ở §1) và **trước** khi module ngữ pháp Plan 2 lên (2026-08-15) cùng ô tìm kiếm `/browse` (`028a7d6`, 2026-08-14). Bảng dưới là kết quả kiểm lại từng mục trên `main` @ `b9f220c`. **Đây là bảng ràng buộc, không phải §1 của kit.**

### Còn đúng

| Mục | Bằng chứng |
|---|---|
| **T1** `/topics` lộ 6 raw i18n key | `vi.topics.blurbs` (`src/lib/i18n/dictionaries.ts:729-752`) dừng ở `toeic`, thiếu `medical/legal/finance/daily-life/social/office-skills`. `src/components/i18n-provider.tsx:25` trả về chính key khi miss → thẻ in ra chuỗi `topics.blurbs.medical`. Bản dịch VI thật **đã có sẵn nhưng chưa dùng** ở `src/lib/topic-taxonomy.ts:385,394,403,412,421,430`. Bản EN của đúng 6 key này (`dictionaries.ts:1581-1586`) là **tên chủ đề dán nhầm**, không phải blurb |
| **T2** card không bấm được | Mọi card đều là `<Link>` (`topics-grid-view.tsx:44-50`) — mô tả của kit sai. Lỗi thật: hàng preview + mũi tên `→` nằm sau `{tp.preview.length > 0 && …}` (`:63-72`), nên 8 slug `curated:true` render thẻ không có đáy và không có tín hiệu bấm được |
| **T3** preview 4 từ vô nghĩa | `src/lib/topics-data.ts:35-51` lấy 4 từ đầu theo `orderBy [{cefr:asc},{word:asc}]` → "4 từ đầu bảng chữ cái trong band CEFR thấp nhất" |
| **T5** sắp xếp sai với người mới | `topics-data.ts:57` `.sort((a,b) => b.count - a.count)` |
| **H3** trang chủ nói "Sắp có: Ngữ pháp" | `dictionaries.ts:675-678` + `src/app/landing-view.tsx:273-281`, trong khi `/grammar` đã chạy với 33 chủ điểm |
| **H2** nav render 2 lần | `src/components/nav.tsx` trả một fragment chứa cả header desktop 8 link (`:40-88`) lẫn tab bar mobile 6 link (`:91-134`); ẩn/hiện thuần CSS nên DOM mobile có 14 anchor |
| **X2** thiếu `viewport-fit=cover` | `src/app/layout.tsx:110-112` export `viewport` chỉ có `themeColor`. Hệ quả: 4 chỗ `env(safe-area-inset-*)` (`nav.tsx:42`, `nav.tsx:103`, `auth-gate.tsx:164`, `pwa-install.tsx:153`) **luôn trả 0** |
| **X3** standalone không có Back | Không có `router.back()` ở nav hay layout |
| **B2** ảnh nặng ở `/browse` | `Word.imageUrl` là URL Pexels `?w=940` vẽ vào ô `w-20 h-20` (80px), 40 dòng/trang (`library-client.tsx:306-308`) |
| **B4** một dòng nhồi 8 trường | `library-client.tsx:290-352` |
| **G4** `►` thô trong bài học | 29 lần dạng text trong `<p>` của HTML đã sanitize; không có chỗ nào trong `src/` xử lý ký tự này |
| **G5** ví dụ đúng/sai giống hệt nhau | `GrammarCommonMistake.bodyEn` là blob text, phân biệt duy nhất là tiền tố `Incorrect:` / `Correct:` |

### Đã cũ hoặc đã tự khỏi — **không được đưa vào plan**

| Mục | Thực tế |
|---|---|
| **X1** "không có bottom nav" | Đã có, `nav.tsx:91-134`, 6 mục, đã có padding safe-area |
| **X5** "không có dark mode" | Đã có đầy đủ: `tailwind.config.ts:4` `darkMode:"class"`, khối `.dark` `globals.css:28-46`, `theme-provider.tsx`, `theme-toggle.tsx`, script chống FOUC `layout.tsx:134-138`. Việc của Phase 2 là **di trú** `.dark` → `[data-theme]` + sơn lại, không phải dựng mới |
| **B1** "`/browse` không có ô tìm kiếm" | Có từ `028a7d6`. Vấn đề thật nhỏ hơn: submit-on-Enter, không debounce, chỉ tìm cột `word` bằng `contains` (`src/lib/vault/scope.ts:118`), và Postgres `contains` mặc định phân biệt hoa thường nên chỉ chạy được nhờ đã `toLowerCase()` ở `:64` |
| **G1** "`/grammar` mất tiêu đề Thì + tên card đầu" | `src/app/grammar/hub-view.tsx:77` render `t('grammar.clusters.<key>')`, `:86` render tên chủ đề; cả 4 key cụm có đủ ở hai từ điển (`dictionaries.ts:796`, `:1631`). Audit trúng một bản deploy cũ |
| **G2** "hiện 0 câu hỏi" | Đã sửa: `hub-view.tsx:91` `{tp.testQuestionCount > 0 && …}` |
| **H1** "`/` là landing cho cả người đã đăng nhập" | Đã sửa: `src/app/page.tsx:76-95` rẽ nhánh server-side, khách → `LandingView`, đã đăng nhập → `HomeView`. **Việc còn lại không phải tách trang** mà là thiết kế lại `HomeView`: nó mở bằng hero marketing (`display-xl` + phụ đề + 2 nút + chữ "a" trang trí 26rem, `home-view.tsx:59-127`) nên trên iPhone SE nút "Ôn ngay" nằm dưới màn hình đầu |

### Đã có một nửa

**Dải khoảng ôn** (signature §2.3) không phải làm từ đầu: `src/components/study/preview-client.ts:47` `getRatingPreviewsClient()` đã tính sẵn 4 mốc và `src/components/study/rating-buttons.tsx:51` đã in ra. Ba lỗ hổng:

1. `formatInterval` trả đơn vị tiếng Anh `m/h/d/mo/y` và **viết trùng hai bản**: `src/lib/utils.ts:47-59` và `preview-client.ts:33-45`.
2. Chỉ chế độ flashcard truyền `previews`; `cram-session.tsx` và `src/app/topics/[slug]/topic-viewer.tsx:164` truyền `[]`.
3. Client hard-code `request_retention: 0.9` (`preview-client.ts:11`) và bỏ qua `Settings.requestRetention`; đồng thời `src/lib/fsrs.ts:35` memo hoá scheduler đầu tiên nên `getFsrs(0.85)` gọi sau **âm thầm** trả về bản 0.9 → mốc hiển thị và interval server ghi có thể lệch nhau.

---

## 3. Số đo thật

Chạy `docs/files/atelier-ui-kit-v2/assets/map-vocab-to-3d.py` trên đủ 8.011 từ (danh sách lấy từ khoá của `data/images.json`):

| Nhóm | Số từ | Ghi chú |
|---|---:|---|
| Khớp 3D → `art3d` | **654 (8,2%)** | kit §4.2 ước 20–25%. Phân bố điểm: 204 ở 100, 441 ở 95, 6 ở 85, **3 ở 70** |
| Trừu tượng / nhạy cảm → `typographic` | 932 | hậu tố `-tion/-sion/-ness/-ment/-ity/-ance/-ence/-ism/-ship/-hood/-ology/-ability` + danh sách nhạy cảm của bộ khớp |
| Từ cụ thể còn lại → `photo` | 6.425 | 6.403 đã có `imageUrl` thật (Pexels 7.023 / Wikimedia 963 / none 25 trên toàn bộ) |

Hai hệ quả bắt buộc:

1. **Khâu "kiểm tay 200 từ khớp điểm 70" của §4.5 không tồn tại.** Chỉ có 9 từ khớp mờ: `button`, `face`, `mark` (điểm 70) và 6 từ điểm 85. Kiểm cả 9 mất hai phút.
2. **Hai chính sách của §4.3 là không đủ.** Nếu chỉ có `art3d | typographic` thì 7.357 từ — kể cả từ cụ thể như `airport`, `bottle`, `dentist` — rơi hết xuống thẻ chữ, tức app mất hình minh hoạ của ~92% từ vựng trong khi 7.986/8.011 từ đang có ảnh thật.

---

## 4. Quyết định của người dùng (ràng buộc)

1. **Phạm vi**: toàn bộ Phase 0→7 của §12 kit.
2. **Nhận diện**: thay hoàn toàn sang hướng xanh, **gồm cả** logo, icon PWA, ảnh OG, `theme_color` của manifest. Lớp nhiễu paper-grain bị bỏ.
3. **Nhánh/deploy**: các lỗi chặn đi thành PR riêng, merge `main` + deploy prod **ngay**. Toàn bộ re-skin nằm trên nhánh dài `feat/ui-atelier-v2` và deploy **một lần** khi xong — người dùng không bao giờ thấy app nửa cũ nửa mới.
4. **DB**: chỉ thêm `Word.imagePolicy` + `Word.art3dSlug`. Không làm đợt dọn dữ liệu bẩn (từ loại sai, nghĩa VI vỡ, synonym rác) — đó là đợt riêng.
5. **Chính sách ảnh: BA, không phải hai** — `art3d` (654) | `photo` (6.425) | `typographic` (932). Nguyên tắc §4.4 của kit giữ nguyên: từ loại chức năng, hậu tố trừu tượng, danh sách nhạy cảm, điểm khớp < 70 **không bao giờ có ảnh**. Khác biệt duy nhất: từ cụ thể không khớp asset 3D thì giữ ảnh thật thay vì rơi xuống thẻ chữ. `src/components/word-image.tsx` được **giữ lại và tái dụng** làm nhánh `photo` của `WordVisual`, không xoá. `/browse` vẫn bỏ sạch thumbnail (B2) — đó mới là chỗ tiết kiệm băng thông thật.

---

## 5. Hợp đồng token

### 5.1 Một nguồn, hai dạng

`var(--accent)` chứa hex **âm thầm xoá** `bg-accent/12`: `parseColorFormat` của Tailwind (`node_modules/tailwindcss/src/util/pluginUtils.js:123-131`) chỉ trả về hàm khi chuỗi chứa đúng chữ `<alpha-value>`; với `var(--accent)` thì `parseColor()` trả `null`, `withAlphaValue` trả `undefined`, và **utility không được sinh ra — không lỗi, không cảnh báo**. Repo có **204 chỗ** dùng `/N`.

`color-mix()` bị loại dù nó *chạy* được trên Tailwind 3.4: trên trình duyệt không hỗ trợ (iOS < 16.2, Chrome < 111) **cả khai báo bị bỏ**, nên `bg-accent` trên nút primary vẽ ra không gì cả — trắng trên trắng. Với người dùng Việt Nam trên máy đủ mọi đời, đó là đánh đổi không có mặt lợi.

**Chốt:** mỗi màu công bố hai dạng, không bao giờ gõ hex hai lần.

```css
--p-blue-600-rgb: 44 78 232;
--p-blue-600: rgb(var(--p-blue-600-rgb));

--accent-rgb: var(--p-blue-600-rgb);
--accent:     rgb(var(--accent-rgb));
```

Dark mode **chỉ gán lại dạng `-rgb`**; dạng màu tự theo, vì thay thế custom property là lazy và cả hai cùng tính trên `<html>`.

- **Tầng 1** (`rgb(var(--x-rgb) / <alpha-value>)` trong `tailwind.config.ts`): nhận `/N`. Mọi màu mà component có thể pha loãng phải nằm ở đây.
- **Tầng 2** (`var(--x)` trần): token **đã pha sẵn alpha** ở dark (`--bg-tint: rgb(74 103 240 / 0.16)`), `--accent-soft`, mọi `*-subtle`, `--bg-glass`, `--bg-overlay`, và mọi gradient. `bg-tint` chạy; `bg-tint/50` **không sinh ra gì**. Đây là hệ hai tầng có chủ đích, và `src/styles/design-system.test.ts` fail build nếu ai viết dạng thứ hai.

### 5.2 Vị trí file

`src/styles/tokens.css` chứa **chỉ khai báo custom property**, không có selector phần tử nào, và được import ở `layout.tsx` **trước** `./globals.css`:

```ts
import "@/styles/tokens.css";   // chỉ custom property — không tranh thứ tự với preflight
import "./globals.css";
```

Lý do không `@import` từ trong `globals.css`: `postcss.config.js` chỉ có `tailwindcss` + `autoprefixer`, **không có `postcss-import`**, nên `@import` phụ thuộc thứ tự của css-loader chứ không phải postcss. Tách làm hai import là bất biến theo cấu trúc.

Các mục §6 (BASE), §7 (`.art3d*`) và §8 (reduced motion) của `02-tokens.css` chuyển vào `@layer` tường minh trong `globals.css`.

### 5.3 Sửa bắt buộc khi chép `02-tokens.css`

`--shadow-xs: none` và `--shadow-sm: none` ở khối dark **phải đổi thành `0 0 #0000`**. Tailwind ghép `box-shadow: <ring>, <ring>, var(--tw-shadow)`; một phần tử `none` làm hỏng cả khai báo và **mất luôn focus ring** — triệu chứng sẽ là "dark mode không có viền focus", gần như không lần ra được.

### 5.4 Lớp tương thích v1 (xoá ở task cuối của Plan 8)

Bảy dòng trỏ biến v1 sang token v2, **ở dạng triplet** vì Tailwind cần thế:

```css
:root {
  --paper: var(--bg-canvas-solid-rgb);  --paper-2: var(--bg-sunken-rgb);
  --surface: var(--bg-surface-rgb);     --ink: var(--fg-default-rgb);
  --ink-soft: var(--fg-muted-rgb);      --ink-line: var(--border-hairline-rgb);
  --ember: var(--accent-rgb);           --moss-500: var(--correct-rgb);
}
```

Chúng giữ **19 chỗ đọc `rgb(var(--ember))` từ JavaScript** chạy đúng và lên màu mới ngay: `src/components/stats/charts.tsx` (15 prop recharts), `progress-bar.tsx:9`, `skeletons.tsx:10-11`, `settings-client.tsx:335` — cộng toàn bộ `.grammar-prose`. Key màu cũ trong `tailwind.config.ts` (`paper`/`ink`/`ember`/`moss`/`cefr`) cũng được **trỏ lại chứ không xoá**; xoá là chết class âm thầm ở ~500 chỗ chưa viết lại. Riêng `cefr.a1…c1` trỏ vào thang `--p-blue-200…800` → con dấu CEFR một hue của §2.3 có ngay, không tốn công component.

Cố ý **không** trỏ `ink → accent`: 41 nút primary thành navy — đúng bảng màu, đọc được, và trông rõ ràng là tạm — rồi thành xanh khi `<Button>` ra đời. Ép lớp tương thích đẻ ra thiết kế cuối cùng là cách chắc chắn nhất để có chữ thân bài màu xanh.

### 5.5 Vai trò màu (§3.2 kit — reviewer kiểm mục này)

| Token | Chỉ dùng cho |
|---|---|
| `--accent` xanh | hành động, link, focus, thanh tiến độ, tab đang chọn |
| `--due` hổ phách | số từ đến hạn, chuỗi ngày |
| `--mastered` tím | trạng thái "đã thuộc" |
| `--correct` bạc hà | phản hồi đúng — **chỉ trong phiên học** |
| `--wrong` san hô | phản hồi sai — **chỉ trong phiên học** |

Ngoài phiên học, màn hình chỉ được có xanh + hổ phách + tím.

---

## 6. Lưới an toàn (thay cho test component)

`vitest` chạy `environment: "node"` trên 45 file test thuần logic; không có jsdom, không có testing-library. **Không thêm jsdom** — nó không chạy Tailwind nên không thấy được đúng loại lỗi đợt này sinh ra (class chết, sai token, tương phản kém, bóng đổ bị bỏ), lại bắt 45 file test đang khoẻ phải khai pragma môi trường.

Ba lưới, **không thêm dependency runtime nào**:

1. **`src/styles/design-system.test.ts`** (node env, chạy trong `npm test` sẵn có):
   - cấm hex trong `src/components` + `src/app/**/*.tsx` (trừ 3 file ở §7 R20), cấm `100vh`, cấm `env(safe-area-` trần, cấm z-index tự nghĩ;
   - **dùng `tailwindcss/resolveConfig`**: rút mọi class `(bg|text|border|ring|fill|stroke|from|to|via|divide|shadow|accent)-<name>(/\d+)?` ra khỏi `src/**/*.tsx` và khẳng định `<name>` có thật trong `theme.colors`, **và** class mang `/N` phải trỏ tới chuỗi chứa `<alpha-value>`. Đây là thứ duy nhất bắt được class chết, vì `tsc` và `next build` đều xanh với nó;
   - khẳng định khối dark không có `--shadow-*: none`;
   - **bộ đếm ratchet** cho class legacy (`card-atelier`, `pill`, `display`, `bg-paper`, …), chỉ được giảm, cuối cùng về 0.
2. **Test thuần cho phần có logic**, đúng văn hoá 45 file hiện có: `intervalLabel()`, `cefrStampStyle()`, `pickVisual()`, `buttonClasses()`. Test `buttonClasses` như hàm thuần cho độ phủ ma trận biến thể bằng test render, với một phần mười chi phí.
3. **`/dev/ui` + `/dev/type` + `scripts/ui/shots.mjs`** dùng **`playwright@1.61.1` đã có sẵn trong devDependencies**: chụp 14 route × 2 theme × 375/768/1280 vào `data/ui-shots/<tag>/` (đã gitignore). Không phải cổng CI — là **hiện vật nghiệm thu của từng task**, diff với baseline chụp trước khi động vào gì.

Trang `/dev/*` phải `notFound()` khi `NODE_ENV === "production"` và `/dev` phải nằm trong `disallow` của `src/app/robots.ts`.

**Cổng của mọi task:**

```bash
npx prisma generate && npx tsc --noEmit && npm test && npm run build
npm run ui:shots -- --tag=<task>
<grep riêng của task>
```

`npm run lint` **không chạy được** (khai `next lint` nhưng repo không có eslint) — đừng đưa vào cổng. Muốn bắt import thừa thì `npx tsc --noUnusedLocals --noUnusedParameters` rồi so trước/sau.

---

## 7. Phán quyết

**R0 — `03-agent-prompts.md` đã lạc hậu, không được làm theo.** Nó nhắc "mục 15/17/7.1/11.2" không tồn tại trong v2 (v2 có 14 mục), bảo dùng font Bricolage và màu giấy `#F4F3EE`/`#121110` (hướng v1), thay 28 emoji bằng icon Lucide (v2 §4 bảo dùng 3D), và cấu hình `next/image` cho Pexels + Wikimedia để **giữ** ảnh (v2 §4.1 bảo bỏ ảnh chụp). Ràng buộc là `01-plan.md` + `02-tokens.css` + tài liệu này.

**R1** Token một nguồn hai dạng — §5.1.
**R2** `darkMode: ["selector", '[data-theme="dark"]']`. Tailwind 3.4 sinh `&:where([data-theme="dark"], [data-theme="dark"] *)` nên **7 chỗ `dark:` hiện có không phải sửa dòng nào**. Sửa đồng bộ: `globals.css` (`.dark {` → `:root[data-theme="dark"] {`, cộng 2 selector con), script chống FOUC, `theme-provider.tsx` (đọc/ghi `dataset.theme`). Khoá `localStorage` giữ nguyên tên `theme` với giá trị `light|dark` → không cần migrate.
**R3** `theme-color` phản ứng theo theme: export `viewport` của Next 14 là tĩnh nên chỉ diễn tả được *sở thích hệ điều hành*, không diễn tả được *lựa chọn trong app*; và không vá được bằng cách chèn meta từ JS vì trình duyệt lấy **thẻ `meta[name=theme-color]` khớp `media` đầu tiên theo thứ tự cây**, mà Next nâng metadata lên trên các con của `<head>`. Chốt: bỏ `themeColor` khỏi `viewport`, tự render đúng một thẻ `<meta>` **ngay trước** script boot, script sửa chính thẻ đó; `theme-provider.set()` làm y hệt hai thao tác đó. Thêm listener `matchMedia` chỉ áp lại khi **chưa** có lựa chọn lưu sẵn. `viewport` còn `width/initialScale/viewportFit: "cover"` — đây là chỗ sửa X2.
**R4** Tên class cũ chia ba nhóm: **sed ngay** `text-soft`→`text-fg-muted` (362), `text-ink`→`text-fg` (77), `border-line`→`border-hairline` (91); **giữ tên, định nghĩa lại** `.shell` (60); **alias tạm rồi xoá** `.card-atelier` (72), `.pill` (23), `.display` (~133), `.bg-paper` (31), `.surface`. Trạng thái cuối: `globals.css` chỉ còn `@layer components { .shell, .art3d*, .grammar-prose* }`.
**R5** Lớp tương thích v1 — §5.4.
**R6** Lưới an toàn — §6.
**R7** **Font: chỉ đổi một họ.** `--font-display` + `--font-body` → **Be Vietnam Pro** (400/500/600/700/800, subset `latin`+`vietnamese`; weight 800 là thứ §2.2 cần). **Giữ nguyên Noto Sans Mono** cho `--font-mono`, và `--font-ipa: var(--font-mono)`. Lý do: `ec6206e` (2026-08-15) vừa đổi cả ba họ chữ để sửa lỗi vỡ IPA — JetBrains Mono thiếu 14 ký tự phiên âm, Hanken Grotesk thiếu 15; IBM Plex Mono chưa được đo; Charis SIL tuy đủ IPA thật nhưng là **serif**, đặt phiên âm serif dưới từ khoá geometric sans là lệch chất. Tổng dung lượng font **giảm** (ba họ → hai). **Không được ship `--font-ipa` trỏ tới họ chữ không được nạp.** Cách chứng minh trước khi commit font: `/dev/type` đo **từng codepoint** bằng canvas — đo cùng ký tự hai lần với hai fallback khác metric (`monospace` và `serif`); **rộng bằng nhau ⇒ họ chữ có glyph, rộng khác nhau ⇒ đã rơi xuống fallback**. Nhìn mắt không phân biệt được hai trường hợp này. Bộ ký tự bắt buộc: `ˈ ˌ ː ɪ ʊ ʌ ɒ ɔ ɑ ɜ ɛ ɡ ʃ ʒ ð ŋ n̩` và `ệ ặ ỡ ữ ợ ẩ ẳ ỷ Ơ Ư Đ`.
**R8** Bóng đổ dark dùng `0 0 #0000`, không bao giờ `none` — §5.3.
**R9** **Service worker: không precache 8,7 MB.** `public/sw.js` hiện precache mỗi `/offline` và cap static cache ở `MAX_STATIC_ENTRIES = 150` FIFO. Nhồi 1.375 request vào `cache.addAll` lúc install trên 4G là đúng thứ §11 cấm. Chốt: precache ~120 vật thể (28 chủ đề + 6 trạng thái + vài cái hay dùng) vào **một cache `/3d/` riêng không bị cap** để không đẩy `/offline` ra; phần còn lại cache-first theo yêu cầu; thêm công tắc Cài đặt "Tải trọn bộ hình 3D để học ngoại tuyến". Bump `CACHE_VERSION`.
**R10** **Không cache HTML điều hướng.** `sw.js:63-72` cố ý không cache navigation, có ghi chú lý do AUTH SAFETY: người đã đăng xuất không được nhận vỏ đã-đăng-nhập từ cache. Giữ nguyên. Câu chuyện offline của đợt này dừng ở trạng thái `electric-plug` trung thực (§8.10) + asset đã cache. Học offline thật cần snapshot phiên trong IndexedDB — **tính năng, không phải re-skin**, ghi thành follow-up (§10).
**R11** **recharts: bỏ, nhưng xếp cuối.** §8.8 cấm thư viện biểu đồ; recharts ^2.13.3 đã là dependency và `stats/charts.tsx` đã dùng token. Vẽ tay 3 SVG và gỡ recharts, nhưng đặt ở **task cuối** để trục trặc biểu đồ không chặn re-skin. Đường lùi: giữ recharts + `next/dynamic`.
**R12** Pack không có `magnifying-glass-tilted-left` và `construction-sign` (§8.10) → dùng `left-pointing-magnifying-glass` và `construction`.
**R13** **`/me` là hub, không phải chỗ dọn nhà.** `/notebook` `/stats` `/leaderboard` `/settings` **giữ nguyên URL** (có link vào, có trong `robots.ts`, có deep-link từ nhắc học); `/me` chỉ liên kết tới chúng. Không nới `src/middleware.ts` (đang chỉ match `/study/:path*`).
**R14** Không đổi `/word/[word]` thành `[slug]`. Đổi URL tốn SEO, lợi ích bằng 0. Sửa spec kit, không sửa route.
**R15** **H2 sửa một lần ở Plan 3, không sửa ở Plan 0.** Cách sửa đúng của "nav 2 lần" là thanh viên thuốc 5 tab thay cả `nav.tsx`. Tiêu chí `document.querySelectorAll('nav').length === 1` thuộc Plan 3 và phải đúng ở **cả 375px lẫn 1280px**.
**R16** Thanh pill hiện ở **mọi bề rộng**. App bar desktop giữ brand + tìm kiếm + user menu, bỏ danh sách link. Một nav, một đường code.
**R17** **Chỉ nhóm chủ đề ở tầng hiển thị** — hai nhóm "Chủ đề đời sống" / "Chuyên ngành & Thi cử". **Không gộp slug**: gộp là mồ côi tag của các pack curated ở lần `db:topics` kế tiếp.
**R18** **Bỏ auto-advance ở chế độ chấm điểm.** `practice-shell.tsx:18-30` tự chuyển sau `REVEAL_MS` (1200ms cho quiz/typing/dictation) — vi phạm §14.11. Giữ 180ms của flashcard: lật thẻ không phải là trả lời; cập nhật luôn ghi chú ở đó.
**R19** **Mục tiêu tuần "4 ngày/tuần" của §9 cần cột `Settings` mới → hoãn.** §14.16 và quyết định DB chỉ cho thêm 2 cột vào `Word`. Ship phần thuần logic + đổi câu chữ (freeze tự động miễn phí; thông báo nói dữ liệu chứ không nói nỗi sợ; màn hình quay lại nói số từ đến hạn chứ không nói mất chuỗi), hard-code 4 ngày/tuần, ghi follow-up.
**R20** **Grep hex phải trừ đúng chỗ.** `src/lib/brand.ts` và `src/app/opengraph-image.tsx` không đọc được CSS var (`ImageResponse` rasterise ngoài trình duyệt); `src/app/global-error.tsx` render không có `globals.css`. `brand.ts` là **bản sao JS duy nhất được phép**, và `src/lib/brand.test.ts` đọc `src/styles/tokens.css` rồi khẳng định các hex khớp — trôi lệch thành CI đỏ thay vì thành báo lỗi của người dùng. `public/favicon.svg` sinh lại từ `MARK` trong `gen-icons.ts` để thôi là bản sao thứ tư viết tay.
**R21** **`art3d-float` một vật thể/màn hình phải cưỡng chế được** (§14.3). Không review tay nổi qua 60+ call site: `Art3D` giữ bộ đếm ở module scope và `console.warn` trong dev khi có instance float thứ hai.
**R22** **Không rebase nhánh dài.** `git merge main` sau mỗi lần Plan 0 (và các fix sau) vào `main`. Một lần sed 530 dòng phát lại qua rebase là cỗ máy đẻ xung đột. Xếp `nav.tsx`, `browse/library-client.tsx`, `topics/*` — đúng những file `main` hay đụng — vào **cuối** lịch viết lại.
**R23** **Bỏ `relative z-10` ở `layout.tsx:146` là giải phóng một stacking context.** Nó tồn tại để nội dung nằm trên lớp nhiễu `body::before`; lớp nhiễu bị xoá thì wrapper cũng đi theo, nhưng khi đó `pwa-install` (z-50) và `auth-gate` (z-[60]) — vốn là anh em của wrapper — đổi tương quan với nav. Kiểm đích danh ở task đổi màu, rồi triệt tiêu hẳn ở task token hoá z-index.

---

## 8. Lộ trình

1 spec (file này) + 9 plan, 67 task. Plan lớn nhất 9 task — bằng trần đã kiểm chứng của `2026-08-15-grammar-module-plan-2-core-loop.md`.

| # | Plan `docs/superpowers/plans/2026-08-16-ui-atelier-v2-…` | Phủ | Task | Nhánh |
|---|---|---|---:|---|
| 0 | `plan-0-baseline-and-blockers.md` | Phase 0 + 1 | 7 | `fix/ui-blocking-bugs` → **main, deploy ngay** |
| 1 | `plan-1-tokens-fonts-primitives.md` | Phase 2 | 9 | `feat/ui-atelier-v2` (tạo ở đây) |
| 2 | `plan-2-art3d-system.md` | Phase 2b + §8.3 | 8 | worktree |
| 3 | `plan-3-app-shell-and-brand.md` | Phase 3 + §8.7 | 8 | worktree |
| 4 | `plan-4-browse-and-word.md` | Phase 4 + §8.4 | 8 | worktree |
| 5 | `plan-5-session-shell-and-flashcard.md` | Phase 5a + 2 signature | 7 | worktree |
| 6 | `plan-6-study-modes-and-summary.md` | Phase 5b | 7 | tuần tự sau 5 |
| 7 | `plan-7-home-landing-grammar.md` | Phase 6 + §8.6 | 6 | worktree |
| 8 | `plan-8-stats-states-ship-gate.md` | Phase 7 + §13 | 7 | tuần tự, cuối cùng |

Plan 0 **chỉ** ôm các mục bảng 🔴 còn đúng và không phụ thuộc hướng thiết kế: T1, T2, H3, X2, X3. Ba mục 🔴 khác đi chỗ khác — H2 → Plan 3 (R15), B1 và B2 → Plan 4 — và **T3/T5 (preview 4 từ vô nghĩa, sắp xếp theo số từ) thuộc Plan 2**: chúng nằm ở bảng 🟠 chứ không phải 🔴, và cách sửa đúng theo §8.3 cần vòng tiến độ + số từ đến hạn, tức phải có `TopicCard` mới.

```
        dọn cây (xong, b9f220c) ──► Plan 0 ──► main ──► deploy
                                       │
                            (M-preview: xem preview.html trên điện thoại)
                                       │
                                    Plan 1
                                       │
                         ┌─────────────┴─────────────┐
                      Plan 2                      Plan 3      ◄ song song (worktree)
                 (3D · DB · /topics)       (shell · /me · brand)
                         ├───────────┬───────────────┘
                      Plan 4      Plan 5                      ◄ song song
                         │          │
                         │       Plan 6    ◄ bắt buộc sau Plan 5 (cùng sửa practice-shell)
                         └────► Plan 7 ◄───┘
                                       │
                                    Plan 8   ◄ cuối: xoá lớp tương thích, đo toàn bộ
                                       │
                            một lần deploy feat/ui-atelier-v2
```

Đường găng: 0 → 1 → 2 → 5 → 6 → 8. Plan 3, 4, 7 treo bên cạnh.

**Chứng minh song song được** (không đụng file):
- **2 ∥ 3** — P2 sở hữu `public/3d`, `prisma/schema.prisma`, `src/components/app/art3d*`, `topic-taxonomy.ts`, `src/app/topics/`, `next.config.js`, `public/sw.js`. P3 sở hữu `nav.tsx`→`app-bar`/`tab-bar`, `layout.tsx`, `manifest.ts`, `lib/brand.ts`, `opengraph-image.tsx`, `src/app/me/`, `/notebook`, `/settings`, `/leaderboard`. Merge P2 trước (task rà padding của P3 cần chiều cao TopicCard cuối cùng).
- **4 ∥ 5** — P4 sở hữu `src/app/browse/`, `src/app/word/`, `src/lib/vault/scope.ts`. P5 sở hữu `src/components/practice/`, `src/components/study/`, `src/lib/fsrs.ts`, `src/lib/utils.ts`.
- **6 ∥ 7** — với điều kiện Plan 5 đã merge (cả hai import `IntervalRibbon`).

**Bắt buộc tuần tự:** 0 → 1 (mọi thứ đọc token); 5 → 6 (cùng viết lại `practice-shell.tsx`); mọi thứ → 8.

### Cổng thủ công

| Cổng | Việc | Khi nào | Mặc định để chạy tiếp |
|---|---|---|---|
| **M-preview** | mở `preview.html` **trên điện thoại**, xác nhận hướng xanh | song song Plan 0 | Plan 0 chỉ sửa lỗi, không phụ thuộc hướng — nhưng **phải trả lời trước Plan 1**. Công tắc huỷ rẻ nhất của cả dự án |
| **M-logo** | duyệt logo | Plan 1 render 2–3 phương án vào `/dev/ui` rồi đi tiếp | mặc định **tô lại chữ "a" hiện có sang `#2C4EE8`**; vẽ mới thành task phụ ở Plan 8 |
| **M-3D** | duyệt 9 từ khớp mờ (điểm 70/85) | Plan 2 xuất CSV ngay ở task đầu | task đó chỉ ghi tier ≥ 95; tier mờ áp sau, chưa về kịp thì dời sang Plan 8 |
| **M-device** | iPhone + Android máy thật: cài PWA, tai thỏ/safe area, cử chỉ back, icon maskable, splash | ngay sau khi Plan 3 merge (deploy preview Vercel) | Plan 4/5 chạy song song không đụng vỏ app; phát hiện gì thành task phụ ở Plan 8. Tiêu chí Phase 3 của §12 được thoả ở Plan 8, không phải Plan 3 |
| **M-copy** | người bản ngữ soát câu chữ: 6 trạng thái §8.10, thông điệp streak §9, 6 blurb chủ đề | gộp một lần sau Plan 7 | chỉ sửa dictionary, gộp vào một task ở Plan 8 |

**Quy tắc cho controller: không bao giờ đỗ một task để chờ cổng thủ công.** Mỗi cổng có mặc định để đi tiếp và một task đích danh sau này để áp câu trả lời của người.

---

## 9. Ràng buộc chung của mọi plan

Khối này chép nguyên văn vào phần Global Constraints của cả 9 plan.

- Ràng buộc: `docs/files/atelier-ui-kit-v2/01-plan.md` + `02-tokens.css` + spec này. **`03-agent-prompts.md` đã lạc hậu — không bao giờ làm theo** (§7 R0).
- Repo **không có ESLint**; `npm run lint` không chạy được. Comment code production viết **tiếng Anh**; `*.test.ts` viết **tiếng Việt**; spec/plan/ledger viết tiếng Việt; commit message tiếng Anh dạng `type(scope): mô tả`.
- `vitest` chạy node-env trên `src/**/*.test.{ts,tsx}`, không jsdom, test **không** được import prisma hay `server-only`. Logic đáng test phải tách thành hàm thuần.
- Cổng mỗi task: `npx prisma generate && npx tsc --noEmit && npm test && npm run build` xanh trước khi commit, cộng `npm run ui:shots -- --tag=<task>`.
- **Schema**: chỉ được thêm `Word.imagePolicy` và `Word.art3dSlug` (§14.16). Đổi schema đi qua `prisma db push` — **repo KHÔNG có thư mục `prisma/migrations`, đừng tạo**. Chạy `npm run db:backup` trước mọi lần push. *(Lưu ý: `db:backup` chỉ phủ 13/25 model mà vẫn báo xanh — đừng coi nó là bản sao lưu đầy đủ.)*
- Logic FSRS đóng băng (§14.16). Sửa phần hiển thị / định dạng / truyền tham số thì được.
- `Word.topics/synonyms/antonyms/extraDefs` là mảng JSON **lưu dạng chuỗi**; lọc chủ đề bằng `{ contains: '"slug"' }` — **giữ nguyên dạng có dấu ngoặc kép**.
- `.env` có `AUTH_BYPASS=1` nên `npm run dev` chạy sẵn ở trạng thái đã đăng nhập (`local@atelier.app`). Muốn nghiệm luồng khách phải `export AUTH_BYPASS=0` cho riêng shell đó. **Không commit thay đổi `.env`.**
- `.vercelignore` loại `docs/` và `data/` — thứ gì runtime cần phải nằm ở `public/` hoặc `src/`.
- Sau khi merge nhánh có đổi `schema.prisma`, chạy `npx prisma generate`; `tsc` đỏ hàng loạt kiểu "Property X does not exist" là client cũ, không phải hồi quy.
- Quy tắc token §3.1: không hex trong `src/components`; không `100vh` (dùng `100dvh`); không `env(safe-area-*)` trần (dùng `--safe-t/--safe-b/--pad-bottom-nav`); không z-index tự nghĩ (dùng `--z-*`); `--bg-canvas` phải là gradient; bóng đổ ám xanh; dark mode qua `[data-theme="dark"]`.
- Vai trò màu §3.2 (§5.5 ở trên): `--correct`/`--wrong` **chỉ** trong phiên học.
- Danh sách cấm §14 (§10 dưới) là checklist của reviewer, chép đủ 16 mục vào mỗi plan.

---

## 10. Những điều KHÔNG được làm (§14 kit, nguyên văn)

1. Thêm mascot hoặc nhân vật hoạt hình có tính cách (vật thể 3D ≠ mascot)
2. Dùng vật thể 3D như icon nhỏ 24px ở góc — dùng icon line cho việc đó
3. Cho nhiều hơn **một** vật thể 3D `art3d-float` trên cùng màn hình
4. Dùng Poppins / Gilroy / Sora (vỡ dấu tiếng Việt)
5. Đặt `--bg-canvas` thành màu phẳng
6. Dùng bóng đổ xám trung tính
7. Dùng `--correct` / `--wrong` ngoài phiên học
8. Gán ảnh cho từ trừu tượng chỉ để lấp chỗ trống
9. Confetti, âm thanh chiến thắng, modal "Chúc mừng!"
10. Scroll-reveal / parallax trong app
11. Tự động chuyển câu sau khi trả lời
12. Font < 16px cho nội dung đọc hoặc ô nhập (iOS sẽ zoom)
13. Thư viện biểu đồ nặng cho 3 biểu đồ đơn giản
14. Bật âm thanh mặc định
15. Giấu việc đối thủ xếp hạng là bot
16. Đổi logic FSRS hay schema DB (trừ cột `imagePolicy` và `art3dSlug`)

---

## 11. Ngoài phạm vi — follow-up có tên

| Việc | Vì sao hoãn |
|---|---|
| Học offline thật (snapshot phiên trong IndexedDB) | §7 R10 — là tính năng, không phải re-skin; và cache HTML điều hướng thì vỡ AUTH SAFETY |
| Mục tiêu tuần tự chọn ("4 ngày/tuần") | §7 R19 — cần cột `Settings` mới, vượt phạm vi DB đã chốt |
| Dọn dữ liệu bẩn: từ loại sai (`about`/`above`/`abroad` đang là "Động từ"), nghĩa VI vỡ ngoặc, synonym rác (`accessibility` → "a11y"), giới hạn 25 từ định nghĩa trên thẻ | Người dùng loại khỏi phạm vi ở câu hỏi 4; là đợt data riêng cần WordNet/LLM |
| Gộp slug chủ đề trùng khái niệm (T4) | §7 R17 — chỉ nhóm hiển thị lần này; gộp thật sẽ mồ côi tag pack curated |
| Mở rộng bộ 3D (`@lobehub/fluent-emoji-3d`, Noto Emoji) để nâng độ phủ trên 8,2% | Đo được rồi mới đáng làm; giới hạn nằm ở chỗ emoji không có vật thể cho phần lớn danh từ học thuật |
| Trang cho `GrammarPracticeQuestion` / `GrammarConfusedPair` / `GrammarCommonMistake` | Đã import và dịch nhưng chưa có UI; thuộc "Plan 3" của module ngữ pháp, không phải đợt này |
