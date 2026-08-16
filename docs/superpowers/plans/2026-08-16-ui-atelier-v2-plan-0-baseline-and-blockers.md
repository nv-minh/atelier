# Atelier v2 — Plan 0/9: Đo nền + sửa lỗi chặn đang chạy trên prod Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Có đủ số liệu "trước" để so ở Plan 8, và dọn sạch bốn lỗi đang hiện trên production mà **không** phụ thuộc hướng thiết kế mới: `/topics` in raw i18n key ra mặt người dùng, thẻ chủ đề không có tín hiệu bấm được, trang chủ quảng cáo "Sắp có: Ngữ pháp" trong khi `/grammar` đã chạy với 33 chủ điểm, và `viewport` thiếu `viewport-fit=cover` khiến bốn chỗ `env(safe-area-inset-*)` luôn trả 0.

**Architecture:** Không đụng cấu trúc. Bốn sửa lỗi độc lập nhau, mỗi cái một task, cộng một task dựng công cụ đo (script Playwright + file ghi số liệu) và một task nút Back tạm cho chế độ standalone. Vì plan này merge thẳng vào `main` và deploy, nó **không được** thêm dependency, không được đụng token/màu/font, và không được viết gì đón đầu re-skin.

**Tech Stack:** Next.js 14.2.18 App Router, React 18, Tailwind 3.4.19, vitest 2.1.9 (node env), playwright 1.61.1 (đã có trong devDependencies, chromium đã tải sẵn ở `~/Library/Caches/ms-playwright`).

**Spec:** `docs/superpowers/specs/2026-08-16-ui-atelier-v2-design.md` — §2 bảng đối chiếu audit (chỉ những mục "còn đúng" mới được làm), §6 lưới an toàn, §7 phán quyết, §9 ràng buộc chung.

**Nhánh:** `fix/ui-blocking-bugs` tạo từ `main` (`b9f220c`). Merge vào `main` và deploy prod ngay khi xong. Nhánh dài `feat/ui-atelier-v2` được tạo ở Plan 1, **sau** khi plan này merge.

## Global Constraints

- Ràng buộc: `docs/files/atelier-ui-kit-v2/01-plan.md` + `02-tokens.css` + spec ở trên. **`03-agent-prompts.md` đã lạc hậu — không bao giờ làm theo** (spec §7 R0): nó nhắc các mục không tồn tại, bảo dùng font Bricolage và bảng màu giấy `#F4F3EE/#121110` của bản v1, thay emoji chủ đề bằng icon Lucide, và giữ ảnh Pexels qua `next/image`.
- **Plan này KHÔNG được**: thêm dependency, đổi màu/token/font, đụng `tailwind.config.ts` hay `globals.css`, sửa `src/components/nav.tsx`, sửa `/browse`, hay tạo `src/components/ui/`. Tất cả những thứ đó thuộc Plan 1–8 trên nhánh dài. Plan này phải revert được độc lập.
- **Không sửa H2 (nav render 2 lần) ở đây** (spec §7 R15). Cách sửa đúng là thanh 5 tab thay cả `nav.tsx` ở Plan 3; làm ở đây rồi làm lại là phí. Tiêu chí `querySelectorAll('nav').length === 1` thuộc Plan 3.
- **Không làm T3/T5** (preview 4 từ vô nghĩa, sắp xếp theo số từ). Chúng nằm ở bảng 🟠 của kit chứ không phải bảng 🔴, và cách sửa đúng theo §8.3 cần vòng tiến độ + số từ đến hạn → thuộc Plan 2.
- Repo **không có ESLint**; `npm run lint` không chạy được, đừng đưa vào cổng. Comment code production viết **tiếng Anh**; `*.test.ts` viết **tiếng Việt**; commit message tiếng Anh dạng `type(scope): mô tả`.
- `vitest` chạy node-env trên `src/**/*.test.{ts,tsx}`; test **không** được import prisma hay `server-only`. `src/lib/topics-data.ts` có `import "server-only"` ở dòng 1 → test không được chạm vào nó.
- Cổng mỗi task: `npx prisma generate && npx tsc --noEmit && npm test && npm run build` xanh trước khi commit.
- `.env` có `AUTH_BYPASS=1` nên `npm run dev` chạy sẵn ở trạng thái **đã đăng nhập** (`local@atelier.app`). Muốn nghiệm luồng khách phải `export AUTH_BYPASS=0` cho riêng shell đó. **Không commit thay đổi `.env`.**
- Không đổi schema, không chạy `prisma db push` trong plan này.
- Ảnh chụp đi vào `data/ui-shots/` (đã gitignore). **Không** commit ảnh vào repo.
- Danh sách cấm §14 của kit (16 mục, chép trong spec §10) là checklist của reviewer.

---

### Task 1: Công cụ đo + số liệu nền + audit 7 trang sau đăng nhập

Không sửa một dòng code sản phẩm nào. Deliverable là một script tái dùng được cho cả 8 plan sau, cộng hai file ghi chép làm mốc so sánh ở Plan 8.

**Files:**
- Create: `scripts/ui/shots.mjs`
- Create: `docs/superpowers/notes/2026-08-16-ui-v2-baseline.md`
- Create: `docs/superpowers/notes/2026-08-16-ui-v2-audit-logged-in.md`
- Modify: `package.json` (thêm script `ui:shots`)
- Không đụng: bất kỳ file nào trong `src/`

**Interfaces:**
- Produces: `npm run ui:shots -- --tag=<tag>` ghi PNG vào `data/ui-shots/<tag>/<route>__<theme>__<width>.png`; mọi task sau của mọi plan dùng lệnh này làm hiện vật nghiệm thu.

- [ ] **Step 1: Viết `scripts/ui/shots.mjs`**

Yêu cầu:
- ESM thuần, `import { chromium } from "playwright"`. Không thêm dependency.
- Đọc `--tag=<tag>` (bắt buộc) và `--base=<url>` (mặc định `http://localhost:3000`) từ `process.argv`.
- Danh sách route cố định gồm 12 mục: `/`, `/topics`, `/topics/food`, `/browse`, `/study`, `/notebook`, `/stats`, `/leaderboard`, `/settings`, `/grammar`, `/onboarding`, `/login`. Thêm hai route **suy ra lúc chạy** để không hard-code slug sai: mở `/grammar`, lấy `href` đầu tiên khớp `^/grammar/[^/]+$` → chụp thêm trang đó và `<href>/lesson/1`.
- Với mỗi route: 3 bề rộng `375, 768, 1280` × 2 theme. Theme đặt bằng cách `addInitScript` ghi `localStorage.setItem('theme', 'dark'|'light')` **trước** khi điều hướng — script chống FOUC ở `layout.tsx:134` đọc đúng khoá này. Đặt `colorScheme` của context khớp theo.
- `deviceScaleFactor: 2`, `waitUntil: "networkidle"`, chờ thêm `document.fonts.ready`, rồi `fullPage: true`.
- Tên file: thay `/` trong route bằng `_`, route gốc là `root`.
- In ra stdout một dòng tổng kết: số ảnh, thư mục đích, và mọi route trả status ≠ 200.
- Bọc mỗi route trong `try/catch` — một route hỏng không được giết cả lượt chụp.

- [ ] **Step 2: Thêm script vào `package.json`**

```json
"ui:shots": "node scripts/ui/shots.mjs"
```

Đặt ngay trước `"postinstall"` để nhóm script công cụ nằm cạnh nhau.

- [ ] **Step 3: Chụp baseline**

`npm run build && npm start` ở một shell, rồi `npm run ui:shots -- --tag=t00-baseline`. Chạy trên bản build production, **không** phải `npm run dev` — dev có overlay và bundle khác hẳn.

- [ ] **Step 4: Ghi `2026-08-16-ui-v2-baseline.md`**

Nội dung bắt buộc:
- Bảng Lighthouse mobile cho `/`, `/topics`, `/browse`, `/grammar`: Performance / Accessibility / LCP / INP (hoặc TBT nếu Lighthouse không cho INP) / CLS. Chạy bằng `npx --yes lighthouse@12 <url> --preset=desktop=false --form-factor=mobile --only-categories=performance,accessibility --output=json --quiet`. Nếu không cài được thì ghi rõ "không đo được" cùng lý do — **đừng bịa số**.
- Bảng kích thước route lấy từ đầu ra của `npm run build` (cột Size và First Load JS), giữ nguyên đơn vị.
- Tổng byte ảnh của `/browse` trang 1: đếm bằng Playwright `page.on('response')` lọc `resourceType() === 'image'`, cộng `(await res.body()).length`.
- Ngày, commit SHA, và tag ảnh chụp tương ứng.

- [ ] **Step 5: Audit 7 trang sau đăng nhập**

Bảy trang kit chưa xem được: `/study` và các chế độ con, `/notebook`, `/stats`, `/leaderboard`, `/settings`, `/word/[word]`, `/onboarding`. Chạy với `AUTH_BYPASS=1` (mặc định của `.env`). Với mỗi trang, ghi vào `2026-08-16-ui-v2-audit-logged-in.md` một bảng: **cái gì hỏng / mức độ / phase nào sửa / file:line**. Chỉ ghi cái quan sát được, không suy đoán.

- [ ] **Step 6: Cổng**

```bash
npx prisma generate && npx tsc --noEmit && npm test && npm run build
git diff --stat src/    # phải TRỐNG — task này không sửa code sản phẩm
ls data/ui-shots/t00-baseline/*.png | wc -l   # ≥ 84 (14 route × 3 bề rộng × 2 theme)
```

- [ ] **Step 7: Commit** — `chore(ui): thêm bộ chụp ảnh giao diện và số liệu nền cho migration v2`

---

### Task 2: T1 — sáu blurb chủ đề đang lộ raw i18n key ra mặt người dùng

**Files:**
- Modify: `src/lib/i18n/dictionaries.ts` (khối `vi.topics.blurbs` ~L729-752, khối `en.topics.blurbs` ~L1558-1587)
- Modify: `src/components/i18n-provider.tsx` (hàm `resolve`, L20-28)
- Create: `src/lib/i18n/coverage.test.ts`

**Interfaces:**
- Consumes: `TOPICS` từ `src/lib/topic-taxonomy.ts` (28 mục, mỗi mục có `slug` và `blurb` tiếng Việt).
- Produces: `vi.topics.blurbs` và `en.topics.blurbs` đều đủ 28 khoá; `resolve()` không còn trả raw key ở production.

- [ ] **Step 1: Viết test TRƯỚC — `src/lib/i18n/coverage.test.ts`**

Comment và tên test viết **tiếng Việt**. Test không được import gì có `server-only`; `topic-taxonomy.ts` và `dictionaries.ts` đều thuần nên import trực tiếp được.

Ba khẳng định:
1. Với mọi `t` trong `TOPICS`: `dictionaries.vi.topics.names[t.slug]` và `dictionaries.vi.topics.blurbs[t.slug]` tồn tại và là chuỗi không rỗng; y hệt cho `en`.
2. Không giá trị nào bằng chính khoá của nó (bắt trường hợp dán nhầm `"office-skills"` làm nội dung).
3. `vi.topics.blurbs[slug] !== en.topics.blurbs[slug]` cho mọi slug — bắt trường hợp dán tên tiếng Anh vào cả hai bên.

- [ ] **Step 2: Chạy test, xác nhận ĐỎ** — phải fail đúng 6 slug ở khẳng định 1 (`medical`, `legal`, `finance`, `daily-life`, `social`, `office-skills`) và 6 slug ở khẳng định 3.

- [ ] **Step 3: Điền 6 blurb tiếng Việt**

Bản dịch **đã có sẵn nhưng chưa dùng** trong `src/lib/topic-taxonomy.ts` — chép nguyên văn trường `blurb` của 6 mục (`medical` ~L385, `legal` ~L394, `finance` ~L403, `daily-life` ~L412, `social` ~L421, `office-skills` ~L430). Nếu văn phong lệch so với 22 blurb đã có trong dictionary (một câu, kết thúc bằng dấu chấm, không viết hoa giữa câu) thì chỉnh cho khớp, giữ nguyên nghĩa.

- [ ] **Step 4: Viết lại 6 blurb tiếng Anh**

Sáu khoá này ở `en.topics.blurbs` hiện đang là **tên chủ đề dán nhầm** ("Medical & Healthcare"…), không phải mô tả. Viết một câu mô tả cho mỗi cái, giọng khớp 22 blurb tiếng Anh đã có.

- [ ] **Step 5: Sửa `resolve()` để lỗi thiếu khoá không bao giờ lộ ra người dùng nữa**

Đổi chữ ký thành `resolve(dict, key, fallbackDict?)`. Khi tra trong `dict` trượt:
- ở `process.env.NODE_ENV !== "production"`: `console.warn` một lần cho mỗi khoá (giữ một `Set` ở module scope để không spam), rồi trả về key — lập trình viên phải thấy ngay;
- ở production: thử `fallbackDict` (luôn là `dictionaries.en`), trả kết quả nếu có, không thì mới trả key.

Sửa call site ở `t` (L54) truyền `dictionaries.en` làm fallback. Comment tiếng Anh giải thích: hiện chuỗi tiếng Anh cho người Việt là dở, nhưng hiện `topics.blurbs.medical` thì tệ hơn hẳn; và test ở Step 1 làm cho cả hai đường không bao giờ chạy tới.

- [ ] **Step 6: Cổng**

```bash
npx tsc --noEmit && npm test && npm run build
# dựng prod, mở /topics ở 375px, khẳng định không còn chuỗi nào khớp /^topics\./
```

Chụp `/topics` trước/sau ở 375px, đính vào PR.

- [ ] **Step 7: Commit** — `fix(i18n): điền blurb tiếng Việt còn thiếu cho 6 chủ đề`

---

### Task 3: T2 — mọi thẻ chủ đề phải có tín hiệu bấm được

**Files:**
- Modify: `src/app/topics/topics-grid-view.tsx` (khối preview L63-72)

**Interfaces:**
- Consumes: `TopicSummary.preview` từ `src/lib/topics-data.ts` (`string[]`, có thể rỗng).

- [ ] **Step 1: Xác minh nguyên nhân trước khi sửa**

Kit nói "card Tiếng Anh Thương mại không có link". **Điều đó sai** — mọi thẻ đều là `<Link href={/topics/${tp.slug}}>` (`topics-grid-view.tsx:44-50`). Ghi vào ledger nguyên nhân thật quan sát được: cả hàng đáy (chip preview + mũi tên `→`) nằm sau điều kiện `{tp.preview.length > 0 && …}` ở L63, nên thẻ nào `preview` rỗng thì mất luôn tín hiệu bấm được.

Chạy `npm run dev` và xác nhận bằng mắt thẻ nào rỗng. Nếu **không** thẻ nào rỗng thì T2 không tái hiện được ở `main` — ghi vào ledger, vẫn làm Step 2 (mũi tên phải luôn có, không phụ thuộc dữ liệu), rồi đóng task.

- [ ] **Step 2: Tách mũi tên ra khỏi điều kiện preview**

Hàng đáy luôn render: mũi tên `→` (hoặc `ArrowRight` của lucide, nhất quán với các thẻ khác trong app) căn phải, có `aria-hidden`; các chip preview chỉ render khi `preview.length > 0`. Đường kẻ `border-t border-line` giữ nguyên để đáy thẻ không đổi chiều cao giữa hai trường hợp.

**Không** đổi cách tính preview và **không** đổi thứ tự sắp xếp — T3/T5 thuộc Plan 2.

- [ ] **Step 3: Cổng**

```bash
npx tsc --noEmit && npm test && npm run build
```

Bằng Playwright trên bản prod: `page.locator('main a[href^="/topics/"]').count()` = 28, và số thẻ có mũi tên cũng = 28.

- [ ] **Step 4: Commit** — `fix(topics): giữ mũi tên trên thẻ chủ đề không có từ preview`

---

### Task 4: H3 — trang chủ đang quảng cáo "Sắp có: Ngữ pháp" trong khi /grammar đã chạy

**Files:**
- Modify: `src/app/page.tsx` (`getGuestLandingData`, L66-73; chỗ render `<LandingView>`, L81-89)
- Modify: `src/app/landing-view.tsx` (section "next", L272-281; props, L29-37)
- Modify: `src/lib/i18n/dictionaries.ts` (khoá `landing.next` ở cả `vi` ~L675-679 và `en` ~L1505)

**Interfaces:**
- Produces: `LandingView` nhận thêm `grammar: { topics: number; lessons: number }`.
- Consumes: `prisma.grammarTopic.count()` và `prisma.grammarLesson.count()`.

- [ ] **Step 1: Lấy số liệu thật, trong cùng cache đã có**

Trong `getGuestLandingData`, thêm hai `count()` vào `Promise.all` đang có. Cache `["landing-guest-v1"]` `revalidate: 3600` giữ nguyên — nhưng **phải bump khoá cache thành `landing-guest-v2`**, nếu không bản cache cũ (không có trường `grammar`) sẽ được phục vụ tiếp và render `undefined`. Comment tiếng Anh nói rõ lý do bump.

- [ ] **Step 2: Thay nội dung section**

Đổi cụm khoá `landing.next` (label "Sắp tới" / title "Sắp có: Ngữ pháp" / body "Đang xây, chưa hẹn ngày") thành `landing.grammar` với label / title / body nói đúng sự thật, có tham số `{topics}` và `{lessons}`, ở **cả hai** ngôn ngữ. Ví dụ tiếng Việt: title "Ngữ pháp, đã chạy"; body "{topics} chủ điểm, {lessons} bài lý thuyết song ngữ, cùng bộ máy nhắc lại." Xoá hẳn cụm khoá `landing.next`.

Trong `landing-view.tsx`, section đó trở thành một `<Link href="/grammar">` (nó đang là `<div>` chết) và hiển thị số liệu truyền vào. Giữ nguyên vị trí và cấu trúc bố cục — task này chỉ sửa sự thật, không thiết kế lại (thiết kế lại landing là Plan 7).

Cập nhật luôn ghi chú tiếng Anh ở `landing-view.tsx:272-274` và `dictionaries.ts:672-674` — nó đang giải thích "nêu đúng MỘT tính năng chưa xây"; sau task này không còn tính năng chưa xây nào được nêu, và ghi chú cũ sẽ dẫn người đọc sau đi sai.

- [ ] **Step 3: Cổng**

```bash
npx tsc --noEmit && npm test && npm run build
grep -rn "landing.next" src   # phải TRỐNG
```

Với `AUTH_BYPASS=0`, mở `/` và khẳng định số chủ điểm/bài học khớp `prisma.grammarTopic.count()` / `prisma.grammarLesson.count()`, và ô đó điều hướng được tới `/grammar`.

- [ ] **Step 4: Commit** — `fix(landing): thay lời hứa "sắp có ngữ pháp" bằng số liệu thật`

---

### Task 5: X2 — `viewport-fit=cover` và `theme-color` theo chế độ sáng/tối

**Files:**
- Modify: `src/app/layout.tsx` (export `viewport`, L110-112; `metadata`, L69-106)

**Interfaces:**
- Produces: `env(safe-area-inset-*)` trả giá trị thật ở iOS, kích hoạt 4 chỗ đang dùng nó: `nav.tsx:42`, `nav.tsx:103`, `auth-gate.tsx:164`, `pwa-install.tsx:153`.

- [ ] **Step 1: Mở rộng export `viewport`**

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without viewport-fit=cover every env(safe-area-inset-*) resolves to 0 on
  // iOS, which silently disables the notch and home-bar padding that nav.tsx,
  // auth-gate.tsx and pwa-install.tsx already ask for.
  viewportFit: "cover",
  // Paired values instead of one dark ink for both schemes: a dark status bar
  // over the paper background read as a rendering fault. This follows the OS
  // preference only — an in-app theme override still shows the OS colour. That
  // limitation is fixed together with the [data-theme] migration.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBF6" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};
```

Hai giá trị màu lấy từ palette **đang chạy**: `--paper` sáng `253 251 246` = `#FDFBF6`, `--paper` tối `20 18 14` = `#141210` (`globals.css:7` và `:29`). **Không** dùng màu xanh v2 ở đây — plan này đi vào prod trước khi re-skin.

- [ ] **Step 2: Thêm khối `appleWebApp` vào `metadata`**

```ts
appleWebApp: {
  capable: true,
  title: "Atelier",
  statusBarStyle: "default",
},
```

`"default"` chứ không phải `"black-translucent"`: black-translucent kéo nội dung lên dưới thanh trạng thái, mà bố cục hiện tại chưa bù cho việc đó — Plan 3 sẽ đổi khi app shell mới có `--safe-t` thật.

- [ ] **Step 3: Cổng**

```bash
npx tsc --noEmit && npm test && npm run build
curl -s http://localhost:3000 | grep -c 'viewport-fit=cover'          # 1
curl -s http://localhost:3000 | grep -c 'name="theme-color"'          # 2
curl -s http://localhost:3000 | grep -c 'apple-mobile-web-app-capable' # 1
```

Trong Playwright với profile iPhone có tai thỏ, khẳng định `getComputedStyle(document.documentElement).getPropertyValue('padding-top')` của header nav khác 0 — hoặc đơn giản hơn: chụp `/` ở profile đó trước/sau và cho thấy nội dung không còn nằm dưới tai thỏ.

- [ ] **Step 4: Commit** — `fix(pwa): bật viewport-fit=cover và theme-color theo chế độ sáng/tối`

---

### Task 6: X3 — nút Back tạm cho chế độ standalone

Ở chế độ standalone không có thanh địa chỉ, nên không có đường lùi nào ngoài cử chỉ vuốt — mà iOS PWA không cho vuốt back. Đây là bản **tạm, cố ý vứt đi**: Plan 3 thay bằng nút Back trong AppBar mới cộng cử chỉ vuốt mép trái.

**Files:**
- Create: `src/components/standalone-back.tsx`
- Modify: `src/app/layout.tsx` (mount cạnh `<Nav />`)

**Interfaces:**
- Produces: `<StandaloneBack />`, client component, không nhận prop.

- [ ] **Step 1: Viết component**

Yêu cầu, comment tiếng Anh:
- `"use client"`. Phát hiện standalone bằng `matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true`, chạy trong `useEffect` để server render và client render đầu tiên khớp nhau (tránh hydration mismatch — cùng lý do đã ghi ở `i18n-provider.tsx:31`).
- Không render khi: không standalone, hoặc `window.history.length <= 1`, hoặc `usePathname()` là `/`, hoặc bắt đầu bằng `/study/` (phiên học chiếm trọn màn hình và có nút `✕` riêng).
- Nút tròn 44×44 tối thiểu, `aria-label` tiếng Việt lấy từ i18n (thêm khoá `nav.back` ở cả hai từ điển), icon `ArrowLeft` của lucide, đặt cố định góc trên trái, dưới `--safe-t`. Dùng đúng các class đang có của app (`card-atelier`/`pill`/`border-line`) — **không** tạo class mới, **không** hard-code hex.
- `onClick={() => router.back()}`.
- Thêm một comment đầu file nói rõ đây là bản tạm và Plan 3 sẽ xoá, kèm tên plan.

- [ ] **Step 2: Mount** — trong `layout.tsx`, ngay sau `<Nav />`.

- [ ] **Step 3: Cổng**

```bash
npx tsc --noEmit && npm test && npm run build
```

Trong Playwright, `addInitScript` ghi đè `matchMedia` cho `(display-mode: standalone)` trả `matches: true`; điều hướng `/` → `/topics` → khẳng định nút hiện và bấm vào thì quay lại `/`; khẳng định nút **không** hiện ở `/` và ở `/study/flashcard`.

- [ ] **Step 4: Commit** — `feat(pwa): thêm nút quay lại tạm thời cho chế độ standalone`

---

### Task 7: Chụp lại, mở PR, merge, deploy

**Files:** không sửa code.

- [ ] **Step 1:** `npm run build && npm start`, rồi `npm run ui:shots -- --tag=t01-plan0`.
- [ ] **Step 2:** So với `t00-baseline`. Đúng bốn màn hình được phép đổi: `/topics` (blurb + mũi tên), `/` khách (ô ngữ pháp), và mọi trang ở profile có tai thỏ (safe area). Bất kỳ khác biệt nào ngoài danh sách đó là hồi quy — điều tra trước khi mở PR.
- [ ] **Step 3:** Mở PR `fix/ui-blocking-bugs` → `main`. Thân PR: bảng "trước/sau" gồm ảnh chụp, dẫn `docs/superpowers/notes/2026-08-16-ui-v2-baseline.md`, và nêu rõ những mục kit gọi là lỗi chặn nhưng **không** làm ở đây kèm lý do: H2 (→ Plan 3, spec R15), B1/B2 (→ Plan 4), X1/X5/G1/G2/H1 (đã cũ hoặc đã tự khỏi, spec §2).
- [ ] **Step 4:** Merge, deploy prod, rồi mở lại `/topics` và `/` trên **máy thật** để xác nhận. `db:push` không cần chạy — plan này không đổi schema.
- [ ] **Step 5:** Ghi vào ledger: SHA đã merge, giờ deploy, và mọi khác biệt còn nợ.

---

## Sau plan này

- Chờ cổng **M-preview** (mở `docs/files/atelier-ui-kit-v2/preview.html` trên điện thoại, xác nhận hướng "Studio xanh") — bắt buộc trả lời trước khi Plan 1 bắt đầu.
- Tạo `feat/ui-atelier-v2` từ `main` **sau** khi PR này merge, rồi viết Plan 1.
