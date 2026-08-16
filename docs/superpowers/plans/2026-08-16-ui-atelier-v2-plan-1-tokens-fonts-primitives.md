# Atelier v2 — Plan 1/9: Hệ token, font, và thư viện primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App chuyển sang bảng màu "Studio xanh" trong **một** commit mà không màn hình nào vỡ, dark mode chạy qua `[data-theme]`, chữ đổi sang Be Vietnam Pro **sau khi chứng minh được** không mất glyph IPA, và `src/components/ui/` có đủ primitive để 8 plan sau không phải copy-paste chuỗi class nữa. Kết thúc plan này, `/dev/ui` render mọi primitive × mọi biến thể × cả hai theme.

**Architecture:** Ba lớp, theo đúng thứ tự. **(1) Lưới an toàn trước tiên** — trang `/dev/*` và một test đọc `tailwindcss/resolveConfig` để bắt class Tailwind chết, vì `tsc` và `next build` đều xanh với chúng. **(2) Đổi nền** — token, `[data-theme]`, font; mỗi cái một commit riêng để ảnh chụp quy được trách nhiệm. **(3) Primitive** — mỗi nhóm primitive phải có **người dùng thật** ngay trong task tạo ra nó, không có primitive nào ra đời mà không ai gọi.

Chìa khoá khiến cú đổi màu là một commit chứ không phải một tuần: **lớp tương thích v1**. Bảy biến CSS cũ được trỏ sang token v2 dưới dạng triplet, và các key màu cũ trong `tailwind.config.ts` được trỏ lại chứ không xoá. Nhờ đó ~500 chỗ chưa viết lại vẫn render, và render **đúng bảng màu mới**, trong khi từng màn hình được nâng cấp dần. Lớp này chết ở task cuối của Plan 8.

**Tech Stack:** Next.js 14.2.18 App Router, React 18, Tailwind 3.4.19 (config JS cổ điển, **không phải v4**), `motion` v11, `lucide-react`, vitest 2.1.9 (node env), playwright 1.61.1 (đã có, chromium đã tải).

**Spec:** `docs/superpowers/specs/2026-08-16-ui-atelier-v2-design.md` — §5 hợp đồng token (đọc kỹ §5.1 và §5.3 trước khi gõ dòng đầu tiên), §6 lưới an toàn, §7 phán quyết R1–R8 và R20–R23, §9 ràng buộc chung, §10 danh sách cấm.

**Nhánh:** `feat/ui-atelier-v2`, tạo từ `main` **sau** khi Plan 0 merge. Đây là nhánh dài; mọi plan 2–8 nhánh ra từ đây và merge về đây. Deploy prod **một lần duy nhất** ở cuối Plan 8.

**Cổng M-preview: ĐÃ THÔNG** (2026-08-16) — người dùng xem `preview.html` trên điện thoại và chốt hướng xanh.

## Global Constraints

- Ràng buộc: `docs/files/atelier-ui-kit-v2/01-plan.md` + `02-tokens.css` + spec ở trên. **`03-agent-prompts.md` đã lạc hậu — không bao giờ làm theo** (spec §7 R0).
- **`git merge main` sau mỗi lần `main` đổi. TUYỆT ĐỐI KHÔNG rebase nhánh này** (spec R22): task 4 là một lần sed 530 chỗ, phát lại qua rebase là cỗ máy đẻ xung đột.
- Repo **không có ESLint**; `npm run lint` không chạy được — đừng đưa vào cổng. Comment code production viết **tiếng Anh**; `*.test.ts` viết **tiếng Việt**; commit message tiếng Anh dạng `type(scope): mô tả`.
- `vitest` chạy `environment: "node"` trên `src/**/*.test.{ts,tsx}`; **không có jsdom, không thêm jsdom** (spec §6 giải thích vì sao). Test không được import `prisma` hay module có `import "server-only"`. Logic đáng test phải tách thành hàm thuần trong `src/lib/ui/`.
- Cổng mỗi task: `npx prisma generate && npx tsc --noEmit && npm test && npm run build` xanh, cộng `npm run ui:shots -- --tag=<task>` rồi **so với ảnh của task liền trước**.
- **Chụp màn hình cần đăng nhập phải chạy trên `npm run dev`, không phải `npm start`** (spec §6.1): `AUTH_BYPASS=1` vô tác dụng dưới bản production vì Next inline `NODE_ENV` thành literal lúc build. Số liệu hiệu năng thì ngược lại — luôn đo trên bản production, luôn ở trạng thái khách. Ghi rõ chế độ đo trong mọi bảng số.
- Ảnh `fullPage` đôi khi vẽ lặp thanh nav `position: fixed` ở giữa trang — **hạn chế của công cụ chụp, không phải lỗi app** (spec §6.1). Đừng sửa bố cục vì nó.
- **Không đổi schema, không chạy `prisma db push`** trong plan này. Không đụng `prisma/`.
- **Không đụng `src/lib/brand.ts`, `public/favicon.svg`, `public/icons/`, `src/app/manifest.ts`, `src/app/opengraph-image.tsx`** — toàn bộ nhận diện thương hiệu thuộc Plan 3, làm cùng lúc với icon và splash để chúng không lệch nhau.
- **Không đụng `src/components/nav.tsx`, `src/app/browse/`, `src/app/topics/`, `src/app/home-view.tsx`, `src/app/landing-view.tsx`, `src/components/practice/`, `src/components/study/`** ngoài việc thay class do sed ở task 4 và thay nút/thẻ ở task 6–9. Thiết kế lại các màn hình đó thuộc Plan 3–7. Xếp chúng cuối lịch là có chủ đích (spec R22).
- Quy tắc token §3.1: không hex trong `src/components`; không `100vh` (dùng `100dvh`); không `env(safe-area-*)` trần; không z-index tự nghĩ; `--bg-canvas` phải là gradient có `background-attachment: fixed`; bóng đổ ám xanh; dark mode qua `[data-theme="dark"]`.
- Vai trò màu §3.2: `--correct` / `--wrong` **chỉ** dùng trong phiên học. Ngoài phiên học chỉ có xanh + `--due` hổ phách + `--mastered` tím.
- Danh sách cấm §14 của kit (16 mục, chép đủ trong spec §10) là checklist của reviewer.

---

### Task 1: Lưới an toàn — trang `/dev/*` và test hệ thiết kế

Làm trước mọi thứ khác. `tsc` và `next build` **không** phát hiện được class Tailwind chết: bỏ key màu `ember` đi thì `bg-ember/12` vẫn compile xanh và vẽ ra không gì cả. Test ở task này là thứ duy nhất bắt được điều đó, nên nó phải tồn tại **trước** cú đổi token.

**Files:**
- Create: `src/app/dev/layout.tsx`, `src/app/dev/ui/page.tsx`, `src/app/dev/type/page.tsx`
- Create: `src/styles/design-system.test.ts`
- Modify: `src/app/robots.ts` (thêm `/dev` vào `disallow`)

**Interfaces:**
- Produces: `/dev/ui` và `/dev/type` chạy ở dev, trả 404 ở production. `src/styles/design-system.test.ts` chạy trong `npm test` sẵn có.

- [ ] **Step 1: `src/app/dev/layout.tsx`**

```tsx
import { notFound } from "next/navigation";

// The /dev routes are build-time development tools: a component gallery and a
// font-glyph probe. They ship in the bundle either way, so they must refuse to
// render in production — a public /dev/ui would leak every unfinished screen.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
```

- [ ] **Step 2: Hai trang stub**

`/dev/ui` và `/dev/type` chỉ cần khung: tiêu đề, và một chỗ để các task sau nhét vào. `/dev/ui` phải có công tắc theme ngay trên trang (đặt `data-theme` trên `<html>`) để xem hai bảng màu cạnh nhau mà không phải vào Cài đặt.

- [ ] **Step 3: `src/app/robots.ts`** — thêm `"/dev"` vào mảng `disallow`, cạnh `"/api/"`. Comment tiếng Anh: chúng đã 404 ở production, dòng này là lớp thứ hai cho môi trường preview.

- [ ] **Step 4: `src/styles/design-system.test.ts`** — comment và tên test **tiếng Việt**

Đọc cây file bằng `node:fs`, không import component nào. Sáu nhóm khẳng định:

1. **Không hex** trong `src/components/**` và `src/app/**/*.tsx`. Miễn trừ, đúng bốn chỗ, khai thành hằng số có comment giải thích từng cái: `src/lib/brand.ts` và `src/app/opengraph-image.tsx` (rasterise ngoài trình duyệt qua `ImageResponse`, không đọc được CSS var), `src/app/global-error.tsx` (render khi `globals.css` chưa có), và các fill của logo Google trong `src/app/login/page.tsx` + `src/components/auth-gate.tsx` (màu thương hiệu bên thứ ba, không được đổi theo theme).
2. **Không `100vh`** trong `src/**` (trừ đúng một dòng dự phòng có chú thích trong `globals.css`). Ban đầu con số này là 17 → khai thành ngân sách ratchet, không phải 0.
3. **Không `env(safe-area-` trần** trong `src/components/**`. Ban đầu 4 → ngân sách ratchet.
4. **Không z-index tự nghĩ**: không `z-[`, và mọi `z-<số>` phải nằm trong tập token. Ban đầu 14 → ngân sách ratchet.
5. **Class màu phải tồn tại** — đây là khẳng định quan trọng nhất:
   ```ts
   import resolveConfig from "tailwindcss/resolveConfig";
   ```
   Rút mọi chuỗi khớp `\b(bg|text|border|ring|fill|stroke|from|to|via|divide|shadow|accent|outline|decoration)-([a-z][a-z0-9-]*)(\/\d+)?\b` ra khỏi `src/**/*.tsx`, tra `<name>` trong `theme.colors` đã resolve (đi cả nhánh lồng như `fg.muted` ↔ `fg-muted`). Bỏ qua các từ khoá không phải màu của Tailwind (`bg-gradient-*`, `text-center`, `border-solid`, `shadow-none`, `text-xs`… — lập danh sách loại trừ và giải thích). **Và**: class nào mang `/N` thì giá trị màu tương ứng **phải** là chuỗi chứa `<alpha-value>`; nếu là `var()` trần thì fail với thông điệp chỉ đúng tên class và file.
6. **Bóng đổ dark không được là `none`** (spec §5.3): đọc `src/styles/tokens.css` (chưa tồn tại ở task này — khẳng định này viết sẵn và bỏ qua nếu file chưa có, task 3 sẽ kích hoạt nó).
7. **Ratchet class legacy**: một `Record<string, number>` khai số lần xuất hiện hiện tại của `card-atelier`, `pill`, `display`, `bg-paper`, `text-soft`, `text-ink`, `border-line`, `surface`; khẳng định số đếm thực tế **≤** ngân sách. Đo số thật rồi điền, đừng đoán.

- [ ] **Step 5: Chứng minh test có răng** — hạ một ngân sách ratchet đi 1, chạy `npm test`, xác nhận ĐỎ, rồi trả lại. Dán đầu ra vào report. Một test luôn xanh là một test chưa được nghiệm.

- [ ] **Step 6: Cổng**

```bash
npx prisma generate && npx tsc --noEmit && npm test && npm run build
npm start & curl -s -o /dev/null -w '%{http_code}' localhost:3000/dev/ui   # 404
npm run dev & curl -s -o /dev/null -w '%{http_code}' localhost:3000/dev/ui # 200
```

- [ ] **Step 7: Commit** — `chore(ui): thêm trang /dev và test hệ thiết kế làm lưới an toàn`

---

### Task 2: `.dark` → `[data-theme]`, giữ nguyên bảng màu

Tách khỏi cú đổi màu để mỗi diff nói được một chuyện. Sau task này **ảnh chụp phải giống hệt task 1** — nếu khác, có hồi quy.

**Files:**
- Modify: `tailwind.config.ts:4`, `src/app/globals.css` (khối `.dark` L28-46 và 2 selector con), `src/app/layout.tsx` (script boot L134-138, export `viewport`), `src/components/theme-provider.tsx`

**Interfaces:**
- Produces: `<html data-theme="light|dark">`; `<meta name="theme-color">` do app tự sở hữu và đổi theo lựa chọn trong app.

- [ ] **Step 1: `tailwind.config.ts`** — `darkMode: ["selector", '[data-theme="dark"]']`

Tailwind 3.4 sinh ra `&:where([data-theme="dark"], [data-theme="dark"] *)`, nên **7 chỗ `dark:` đang có không phải sửa dòng nào**. Đó chính là lý do chọn `selector` thay vì `variant`. Comment tiếng Anh nói rõ điều này.

- [ ] **Step 2: `globals.css`** — `.dark {` → `:root[data-theme="dark"] {`, và hai selector con `.dark body::before`, `.dark .card-atelier` đổi tương ứng.

- [ ] **Step 3: `layout.tsx` — sở hữu thẻ `theme-color`** (spec R3)

Export `viewport` của Next 14 là **tĩnh**: nó diễn tả được sở thích hệ điều hành nhưng không diễn tả được lựa chọn trong app. Và không vá được bằng cách chèn thêm meta từ JS, vì trình duyệt lấy **thẻ `meta[name=theme-color]` khớp `media` đầu tiên theo thứ tự cây**, mà Next nâng metadata lên trên các con của `<head>`.

Vì vậy: **bỏ `themeColor` khỏi export `viewport`** (Plan 0 vừa thêm nó — đây là nơi nó được thay, ghi rõ trong commit message), giữ lại `width` / `initialScale` / `viewportFit`. Rồi tự render đúng một thẻ trong `<head>`, **ngay trước** script boot:

```tsx
<meta name="theme-color" content={THEME_COLOR.light} />
<script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
```

`THEME_BOOT` làm ba việc trong một lần chạy trước khi vẽ: đặt `data-theme`, sửa `content` của chính thẻ meta trên, và đặt `document.documentElement.lang`. Giữ nguyên phần bắt `beforeinstallprompt` đang có.

Ở task này hai màu vẫn là bảng **đang chạy** (`#FDFBF6` / `#141210`); task 3 đổi sang xanh.

- [ ] **Step 4: `theme-provider.tsx`** — đọc `document.documentElement.dataset.theme` lúc mount; `set()` ghi `dataset.theme` **và** sửa `content` của thẻ meta, thay cho `classList.toggle("dark", …)`. Khoá `localStorage` giữ nguyên tên `theme` với giá trị `light|dark` → **không cần migrate dữ liệu người dùng**. Thêm listener `matchMedia('(prefers-color-scheme: dark)')` chỉ áp lại khi **chưa** có lựa chọn lưu sẵn.

- [ ] **Step 5: Cổng**

```bash
npx prisma generate && npx tsc --noEmit && npm test && npm run build
grep -rn "classList.*dark" src   # phải TRỐNG
npm run ui:shots -- --tag=p1t02-datatheme
```

Ảnh phải **giống hệt** `p1t01`. Bật/tắt theme trên máy thật: `<html data-theme>` đổi **và** `content` của meta đổi. Hard reload với mạng bóp còn 3G: không nháy theme (chụp khung hình đầu).

- [ ] **Step 6: Commit** — `refactor(theme): chuyển dark mode từ class .dark sang [data-theme]`

---

### Task 3: Cú đổi token — bảng màu Studio xanh trong một commit

Task lớn nhất plan này. Đọc spec §5 **toàn bộ** trước khi gõ.

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx` (thêm import + đổi 2 màu trong `THEME_COLOR`, bỏ wrapper `relative z-10` ở L146)

**Interfaces:**
- Produces: mọi token của `02-tokens.css` ở **hai dạng** (`--x-rgb` triplet và `--x` màu); các utility Tailwind mới (`bg-surface`, `text-fg-muted`, `rounded-xl`, `shadow-md`, `z-tabbar`, `pb-nav`, `min-h-screen` = `100dvh`, …); lớp tương thích v1 giữ ~500 chỗ chưa viết lại vẫn render.

- [ ] **Step 1: `src/styles/tokens.css`** — chép giá trị từ `docs/files/atelier-ui-kit-v2/02-tokens.css`, biến đổi theo spec §5:
  - **chỉ chứa khai báo custom property**, không selector phần tử nào (mục §6 BASE, §7 `.art3d*`, §8 reduced-motion của kit chuyển vào `globals.css` ở Step 2);
  - mỗi màu hai dạng, dark **chỉ** gán lại dạng `-rgb`;
  - **`--shadow-xs` và `--shadow-sm` ở dark phải là `0 0 #0000`, không phải `none`** — kit viết `none` và đó là lỗi sẽ giết focus ring (spec §5.3);
  - token đã pha sẵn alpha (`--bg-tint`, `--accent-soft`, mọi `*-subtle`, `--bg-glass`, `--bg-overlay`) và mọi gradient **không** có dạng `-rgb`; đánh dấu chúng bằng comment `Tier 2 — no /N`;
  - giữ nguyên 8 biến `--gr-*` của ngữ pháp (bảng màu chức năng, không phải trang trí) nhưng **chỉnh lại giá trị dark** cho nền navy `#111634` thay vì đen ấm;
  - mục cuối: lớp tương thích v1 (spec §5.4) với comment nói rõ nó chết ở task nào của Plan 8.

- [ ] **Step 2: `globals.css`** — xoá khối `:root`/`[data-theme="dark"]` v1; **xoá `body::before` và `--grain-opacity`** (lớp nhiễu giấy là chữ ký v1 và làm đục lavender); `body { background: var(--bg-canvas); background-attachment: fixed; }`; định nghĩa lại `.shell` / `.card-atelier` / `.pill` trên token mới; thêm mục §6 base + §7 `.art3d*` của kit vào `@layer`; và một khối `LEGACY — xoá ở Plan 8` chứa `.display`, `.bg-paper`, `.surface`, mỗi cái kèm số lần xuất hiện hiện tại.

`background-attachment: fixed` là chi phí repaint đã biết trên iOS Safari — **đo FPS cuộn `/browse` trên máy thật hoặc profile mobile** trong task này. Nếu giật, chuyển gradient sang một lớp `::before` cố định. **Không** được đặt màu phẳng (§14.5).

- [ ] **Step 3: `tailwind.config.ts`** — theo mẫu ở spec §5. Điểm bắt buộc:
  - giữ `opacity: { 8: ".08", 12: ".12" }` — thiếu là 204 chỗ `/8` `/12` biến mất;
  - `minHeight: { screen: "100dvh" }` ghi đè giá trị lõi → `min-h-screen` thành `100dvh` cho cả app trong một dòng;
  - `spacing: { nav: "var(--pad-bottom-nav)", "safe-t": …, "safe-b": … }` để thay 24 chỗ `pb-28 md:pb-*` viết tay;
  - key màu **legacy** (`paper`/`ink`/`ember`/`moss`/`cefr`) **trỏ lại, không xoá**; `cefr.a1…c1` trỏ vào thang `--p-blue-200…800`;
  - **không** đụng `fontSize` lõi `xs/sm/base`: `--text-xs` của kit là 13px còn Tailwind là 12px, đổi ngầm sẽ làm ảnh diff không đọc được. Chỉ thêm key mới (`hero`, `d1`, `h1`, `h2`, `h3`, `2xs`).

- [ ] **Step 4: `layout.tsx`** — thêm `import "@/styles/tokens.css";` **trước** `import "./globals.css";` (spec §5.2 giải thích vì sao không `@import` từ trong `globals.css`: repo không có `postcss-import`). Đổi hai giá trị trong `THEME_COLOR` sang `#F5F7FF` / `#0A0E22`. Bỏ `className="relative z-10"` ở wrapper L146 — nó tồn tại để nội dung nằm trên lớp nhiễu, mà lớp nhiễu vừa bị xoá.

- [ ] **Step 5: Kiểm đích danh rủi ro stacking context** (spec R23)

Bỏ `relative z-10` là **giải phóng một stacking context**. `pwa-install` (`z-50`) và `auth-gate` (`z-[60]`) vốn là anh em của wrapper đó; sau khi bỏ, tương quan của chúng với nav (`z-40`) đổi. Mở đồng thời: bottom sheet của `auth-gate`, một toast thành tựu, và thanh mời cài PWA. Xác nhận thứ tự chồng vẫn đúng. Ghi kết quả vào report.

- [ ] **Step 6: Cổng**

```bash
npx prisma generate && npx tsc --noEmit && npm test && npm run build
grep -rn "grain\|paper-grain" src   # chỉ còn trong tailwind.config nếu chưa gỡ backgroundImage
npm run ui:shots -- --tag=p1t03-swap
```

Duyệt **từng màn hình** trong bộ ảnh — đây là task duy nhất mà mọi ảnh đều đổi, nên không thể dựa vào diff tự động. Danh sách phải soi kỹ: `/grammar/*/lesson/*` (8 màu `--gr-*` trên nền navy), `/stats` (recharts đọc `rgb(var(--ember))` qua lớp tương thích), `/study/flashcard`, và mọi trạng thái rỗng.

- [ ] **Step 7: Commit** — `feat(design): chuyển toàn app sang bảng màu Studio xanh`

---

### Task 4: Đổi tên ba token 1:1 (530 chỗ)

Thuần cơ học, **không đổi gì về hình ảnh**. Tách riêng để diff của task 3 còn đọc được.

**Files:** ~48 file trong `src/`, cộng `src/app/globals.css` và `src/styles/design-system.test.ts`

- [ ] **Step 1: Sed ba cặp** — `text-soft` → `text-fg-muted` (362), `text-ink` → `text-fg` (77), `border-line` → `border-hairline` (91). Cẩn thận biên: `text-soft/70` phải thành `text-fg-muted/70`; **không** đụng `--ink-soft`, `--ink-line`, `divide-ink/10`, hay chuỗi `text-ink` nằm trong comment mô tả lịch sử.
- [ ] **Step 2: Xoá ba class đó khỏi khối LEGACY** trong `globals.css` và khỏi ratchet trong `design-system.test.ts` (ngân sách về 0).
- [ ] **Step 3: Cổng**
```bash
npx prisma generate && npx tsc --noEmit && npm test && npm run build
grep -rn "text-soft\|text-ink\|border-line" src   # phải TRỐNG
npm run ui:shots -- --tag=p1t04-rename
```
Ảnh phải **giống hệt** `p1t03`. Khác một pixel nào cũng là sed sai.
- [ ] **Step 4: Commit** — `refactor(design): đổi text-soft/text-ink/border-line sang token v2`

---

### Task 5: Font — Be Vietnam Pro, sau khi chứng minh không mất glyph IPA

**Files:** `src/app/dev/type/page.tsx`, `scripts/ui/check-type.mjs`, `package.json`, `src/app/layout.tsx` (L24-58), `src/styles/tokens.css` (`--font-*`)

**Bối cảnh bắt buộc đọc:** commit `ec6206e` (2026-08-15) vừa đổi **cả ba** họ chữ để sửa lỗi vỡ IPA — JetBrains Mono thiếu 14 ký tự phiên âm, Hanken Grotesk thiếu 15. Bẫy: subset `latin-ext` của Google khai `unicode-range` bao khối IPA nhưng file woff2 thật lại **không chứa glyph**; trình duyệt khớp dải, tải font, không thấy glyph, rồi âm thầm rơi xuống font hệ thống. **Thêm subset không cứu được.** Vì vậy kit đề xuất IBM Plex Mono + Charis SIL là đề xuất **chưa được đo**, và spec R7 chốt: giữ Noto Sans Mono.

- [ ] **Step 1: Dựng `/dev/type` thành công cụ đo thật**, không phải trang xem chữ

Ba phần:
1. Chuỗi tra tấn cho mỗi họ × weight × cỡ: IPA `/əbˈdʌk.ʃn̩/ /ˌækəˈdemɪk/ /ˈθɜːrəfɔːr/ ʒ ð ŋ ɒ ɑː ɔɪ eə ʊə ɡ ʃ ɪ ʊ ʌ ɔ ɜ ː ˈ ˌ` và tiếng Việt `Học tiếng Anh và nhớ được lâu — ệ ặ ỡ ữ ợ ẩ ẳ ỷ Ơ Ư Đ` ở 16px, 24px, 48px.
2. **Bảng phủ từng codepoint** — đây mới là bằng chứng. Sau `await document.fonts.ready`, với mỗi codepoint đo bề rộng trên canvas **hai lần**: `font = '16px "Be Vietnam Pro", monospace'` và `font = '16px "Be Vietnam Pro", serif'`. **Rộng bằng nhau ⇒ họ chữ cung cấp glyph. Rộng khác nhau ⇒ đã rơi xuống fallback, tức thiếu.** Hai fallback có metric khác nhau là thứ làm phép đo này phân biệt được. Vẽ một ô xanh/đỏ cho mỗi codepoint × mỗi họ.
3. Dung lượng woff2 thật của từng họ đọc từ `performance.getEntriesByType("resource")`, đối chiếu ngân sách 120 KB của §11.

- [ ] **Step 2: `scripts/ui/check-type.mjs`** — playwright mở `/dev/type`, khẳng định **không ô đỏ nào**, exit non-zero nếu có. `package.json`: `"check:type": "node scripts/ui/check-type.mjs"`. Chạy local, **không** đưa vào CI (runner không có browser).

- [ ] **Step 3: Chạy `npm run check:type` TRƯỚC khi đổi font.** Nếu Be Vietnam Pro trượt bất kỳ ký tự tiếng Việt nào → dừng, báo cáo, đừng đổi. Nếu Noto Sans Mono trượt bất kỳ ký tự IPA nào → có hồi quy từ trước, báo cáo.

- [ ] **Step 4: Đổi font** — `layout.tsx` L24-58: thay `Literata` và `Fira_Sans` bằng `Be_Vietnam_Pro` (weights `["400","500","600","700","800"]`, `subsets: ["latin","vietnamese"]`), **giữ nguyên `Noto_Sans_Mono` từng chữ một** kể cả subset `latin-ext` và comment giải thích ở L50-53. Trong `tokens.css`: `--font-display` và `--font-body` trỏ Be Vietnam Pro; `--font-ipa: var(--font-mono)`.

- [ ] **Step 5: Vá lại thứ bậc chữ đã mất.** `--font-display` và `--font-body` giờ là **một họ**; `.display` và `.grammar-prose h2` vốn tương phản serif–sans. Dựng lại thứ bậc bằng **weight (800 vs 500) và cỡ**, không bằng họ chữ. Chụp riêng `/grammar/[topic]/lesson/[order]` và duyệt bằng mắt.

- [ ] **Step 6: Cổng**
```bash
npm run check:type                # không ô đỏ
npx prisma generate && npx tsc --noEmit && npm test && npm run build
npm run ui:shots -- --tag=p1t05-fonts
```
Tổng byte font < 120 KB (đọc từ đầu ra `check:type`). Soi mọi dòng IPA: `/browse`, `/word/[word]`, flashcard, dictation, `try-cards` của landing.

- [ ] **Step 7: Commit** — `feat(type): đổi chữ hiển thị và thân bài sang Be Vietnam Pro`

---

### Task 6: `Button` + `IconButton`, và di trú 41 nút primary

Primitive nào cũng phải có người dùng thật **ngay trong task tạo ra nó**.

**Files:** Create `src/lib/ui/button-classes.ts`, `src/lib/ui/button-classes.test.ts`, `src/components/ui/button.tsx`, `src/components/ui/icon-button.tsx`; Modify `src/app/dev/ui/page.tsx` + ~30 file gọi

- [ ] **Step 1: `buttonClasses(variant, size)` là hàm thuần** trong `src/lib/ui/`, test node-env với comment tiếng Việt phủ đủ ma trận biến thể × cỡ. Test hàm thuần cho độ phủ bằng test render với một phần mười chi phí — đó là lý do tách.
- [ ] **Step 2: `Button`** — 4 biến thể `primary | secondary | ghost | danger` × 3 cỡ cao `40 | 48 | 56`; `primary` mang `shadow-accent`; nhấn `active:scale-[.97]` trong `--dur-instant`; có `loading` và `disabled`; `:focus-visible` thấy được. `IconButton` 44/48, **bắt buộc** prop `aria-label` (kiểu TS làm nó không optional).
- [ ] **Step 3: Render toàn bộ ma trận vào `/dev/ui`** ở cả hai theme.
- [ ] **Step 4: Di trú 41 chỗ** dùng chuỗi `rounded-full bg-ink text-paper px-… py-…` (giờ là `bg-fg text-…` sau task 4) sang `<Button variant="primary">`. Đây là task đổi hình ảnh lớn nhất của plan — nút chuyển từ navy sang xanh.
- [ ] **Step 5: Cổng** — `grep -rc "bg-fg text-paper\|bg-ink text-paper" src` → 0; mọi biến thể có chiều cao tính được ≥ 44px; `npm run ui:shots -- --tag=p1t06-button`.
- [ ] **Step 6: Commit** — `feat(ui): thêm primitive Button/IconButton và di trú 41 nút primary`

---

### Task 7: `Chip`, `SegmentedControl`, `CefrStamp`

**Files:** Create `src/components/ui/chip.tsx`, `segmented-control.tsx`, `src/lib/ui/cefr-stamp.ts` (+test), `src/components/ui/cefr-stamp.tsx`; Delete `src/components/cefr-badge.tsx`; Modify các chỗ gọi + `/dev/ui`

- [ ] **Step 1: `Chip`** 3 biến thể `filter | tag | choice`, cao 34, bo `--r-pill`. Di trú 23 chỗ `.pill`.
- [ ] **Step 2: `SegmentedControl`** cao 40 — người dùng thật đầu tiên là công tắc giọng US/UK trong Cài đặt.
- [ ] **Step 3: `CefrStamp`** theo §2.3: A1 viền mờ → A2 viền rõ → B1 nền nhạt → B2 nền đậm → C1 mực đặc, **một hue xanh, năm độ đậm**, mono, uppercase, tracking `.06em`, cao 20. `cefrStampStyle(level)` là hàm thuần có test. Xoá `cefr-badge.tsx` và chuyển hết chỗ gọi.
- [ ] **Step 4: Cổng** — `grep -rn "cefr-badge" src` → 0; khẳng định tương phản ≥ 4.5:1 cho cả 5 mức ở **cả hai** theme, đo bằng màu tính được trong playwright chứ không ước lượng; `npm run ui:shots -- --tag=p1t07-chip`.
- [ ] **Step 5: Commit** — `feat(ui): thêm Chip, SegmentedControl và con dấu CEFR một hue`

---

### Task 8: `Card`, `ProgressBar`, `Skeleton`, `EmptyState`, `Tabs` — và di trú 72 `.card-atelier`

**Files:** Create 5 file trong `src/components/ui/`; Rename `src/components/progress-bar.tsx` → `src/components/route-progress.tsx`; Modify ~40 file gọi + `layout.tsx` + `/dev/ui`

- [ ] **Step 1: Xử lý va tên trước** — `src/components/progress-bar.tsx` hiện là thanh nprogress **của chuyển trang**, không phải primitive. Đổi tên thành `route-progress.tsx` và cập nhật `layout.tsx`, **trước** khi tạo `src/components/ui/progress-bar.tsx`.
- [ ] **Step 2: `Card`** 3 biến thể `flat | raised | interactive`, bo `--r-xl`, bóng `--shadow-sm`. Di trú **72 chỗ** `.card-atelier` ở 40 file, rồi xoá class đó khỏi `globals.css` và khỏi ratchet.
- [ ] **Step 3: `ProgressBar`** hai dạng `line | ring` (dạng ring thay `gamification/goal-ring.tsx` nếu khớp; nếu không thì để nguyên và ghi lý do).
- [ ] **Step 4: `Skeleton`** 3 dạng `text | card | art3d`, shimmer 1.4s, **tắt hẳn** khi `prefers-reduced-motion`. Gộp `src/components/skeletons.tsx` vào đây.
- [ ] **Step 5: `EmptyState`** — chỗ dành sẵn cho vật thể 3D 120px (Plan 2 lắp vào), một câu, một nút. Người dùng thật đầu tiên: `src/components/study/empty-study.tsx`, vốn đang hard-code chuỗi nút ở `:11`.
- [ ] **Step 6: `Tabs`** dạng pill cao 44, cuộn ngang có scroll-snap. Người dùng thật đầu tiên: các tab `/notebook` (starred / leeches / known).
- [ ] **Step 7: Cổng** — `grep -rc "card-atelier" src` → 0; chụp hai khung hình cách nhau 1,4s của shimmer với `prefers-reduced-motion: reduce`, hai ảnh phải **giống hệt byte**; `npm run ui:shots -- --tag=p1t08-card`.
- [ ] **Step 8: Commit** — `feat(ui): thêm Card/ProgressBar/Skeleton/EmptyState/Tabs và di trú 72 thẻ`

---

### Task 9: `Sheet`, `Toast`, `Input` — và `/dev/ui` hoàn chỉnh

**Files:** Create `src/components/ui/sheet.tsx`, `toast.tsx`, `input.tsx`; Modify `src/components/auth-gate.tsx`, `src/components/gamification/achievement-toast.tsx`, `/dev/ui`

- [ ] **Step 1: `Sheet`** — rút ra từ `auth-gate.tsx:149-164` (bottom sheet duy nhất của app hiện nay). Vuốt xuống để đóng, tay cầm 36×4, `--safe-b`, focus trap đúng, ESC đóng. Rồi cho `auth-gate` dùng lại nó — **đây là chỗ `z-[60]` chết**.
- [ ] **Step 2: `Toast`** — rút ra từ `gamification/achievement-toast.tsx`. 3 dạng `info | success | error`, nổi **trên** nav, tự tắt 3,2s, có nút Hoàn tác. Cho hệ thành tựu dùng lại.
- [ ] **Step 3: `Input`** — dạng `text | search`, cao 48, **`font-size: 16px` bắt buộc** (nhỏ hơn là iOS tự zoom, §14.12). Người dùng thật đầu tiên: ô tìm kiếm `/browse` hiện có (chỉ thay vỏ, **không** đụng logic tìm kiếm — đó là Plan 4).
- [ ] **Step 4: `/dev/ui` hoàn chỉnh** — mọi primitive × mọi biến thể × mọi trạng thái (default / loading / disabled / rỗng / lỗi), hai theme cạnh nhau.
- [ ] **Step 5: Cổng**
```bash
npx prisma generate && npx tsc --noEmit && npm test && npm run build
grep -rn 'z-\[' src        # phải TRỐNG
npm run ui:shots -- --tag=p1t09-overlay
```
Mở sheet rồi Tab 12 lần: tiêu điểm **không** thoát ra ngoài. ESC đóng. Mọi `Input` có `font-size` tính được ≥ 16px.
- [ ] **Step 6: Commit** — `feat(ui): thêm Sheet/Toast/Input và hoàn thiện thư viện /dev/ui`

---

## Nghiệm thu cả plan

- `/dev/ui` render mọi primitive ở hai theme; `/dev/type` không ô đỏ; cả hai 404 ở production.
- `npm test` xanh với `design-system.test.ts`, và các ngân sách ratchet của `text-soft`/`text-ink`/`border-line`/`card-atelier`/`pill` đã về **0**.
- Toàn app một bảng màu; không màn hình nào còn hổ phách trừ đúng vai trò `--due`.
- Tổng dung lượng font < 120 KB, không ký tự IPA nào rơi xuống fallback.
- Lighthouse không tụt so với baseline của Plan 0.

## Sau plan này

Plan 2 (3D + DB + `/topics`) và Plan 3 (app shell + `/me` + nhận diện) chạy **song song** trong hai worktree — đã chứng minh không đụng file ở spec §8. Merge Plan 2 trước.
