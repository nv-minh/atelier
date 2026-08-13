# Deployment — Vercel + Neon + Google OAuth

## Đã deploy
- **App**: https://vocab-master-dusky.vercel.app
- **DB**: Neon Postgres (project `sparkling-bird-30788729`, database `neondb`), đã seed 3.677 từ.
- **Env trên Vercel (production)**: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
- **Auth**: GitHub OAuth (NextAuth v4) — đang BẬT. `AUTH_BYPASS` đã tắt trên prod (mọi route yêu cầu đăng nhập).

> Local dev (`.env`) vẫn giữ `AUTH_BYPASS="1"` để chạy nhanh không cần login (GitHub OAuth app callback trỏ về prod, nên local sẽ mismatch — dùng bypass khi dev).


## Bước cuối — bật GitHub Sign-in (cần bạn làm, tôi không thể tạo credentials)

Đăng nhập GitHub đang **disabled** cho đến khi thêm credentials. Để bật:

### 1. Tạo GitHub OAuth App
1. Vào https://github.com/settings/applications/new (đăng nhập GitHub).
2. Điền:
   - **Application name**: `Atelier`
   - **Homepage URL**: `https://vocab-master-dusky.vercel.app`
   - **Authorization callback URL**: `https://vocab-master-dusky.vercel.app/api/auth/callback/github`
3. Register → copy **Client ID** + sinh **Client Secret**.

> Muốn dùng cả local: thêm callback thứ 2 `http://localhost:3000/api/auth/callback/github` (hoặc tạo 1 OAuth app riêng cho dev).

### 2. Thêm vào Vercel
```bash
printf '%s' 'PASTE_CLIENT_ID'     | vercel env add GITHUB_CLIENT_ID production
printf '%s' 'PASTE_CLIENT_SECRET' | vercel env add GITHUB_CLIENT_SECRET production
vercel --prod --yes
```
(Hoặc Vercel dashboard → project → Settings → Environment Variables.)

### 3. (Tùy chọn) Chạy local
Thêm cùng 2 giá trị vào `.env` (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`), rồi `npm run dev`.

> **Lưu ý:** phần GitHub ở trên giờ là **lịch sử**. Nút GitHub đã gỡ khỏi `/login`, nên cấu hình hai biến này **không** làm hiện nút nào cả — provider vẫn đăng ký chỉ để 3 `Account` row cũ không thành mồ côi. Đường đăng nhập hiện tại là Google, xem mục dưới.

## Bước cuối — bật Google Sign-in (cần bạn làm, tôi không thể tạo credentials)

Đăng nhập Google đang **disabled**: nút Google trên `/login` hiển thị nhưng bị khoá (disabled), kèm thông báo, cho tới khi cả `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` đều được cấu hình. Để bật:

### 1. Tạo Google OAuth Client
1. Vào Google Cloud Console → **APIs & Services → Credentials** → **Create Credentials → OAuth 2.0 Client ID** → chọn loại **Web application**.
2. Thêm **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://<production-domain>/api/auth/callback/google` (prod — thay bằng domain thật, vd `vocab-master-dusky.vercel.app`)
3. Create → copy **Client ID** + sinh **Client Secret**.

> Thiếu redirect URI production là nguyên nhân phổ biến nhất của lỗi `redirect_uri_mismatch` — local chạy được nhưng prod báo lỗi.

### 2. Thêm vào Vercel
```bash
printf '%s' 'PASTE_CLIENT_ID'     | vercel env add GOOGLE_CLIENT_ID production
printf '%s' 'PASTE_CLIENT_SECRET' | vercel env add GOOGLE_CLIENT_SECRET production
vercel --prod --yes
```
(Hoặc Vercel dashboard → project → Settings → Environment Variables.)

Không cần set `NEXT_PUBLIC_GOOGLE_ENABLED` bằng tay — biến này được `next.config.js` tự suy ra từ `GOOGLE_CLIENT_ID` **và** `GOOGLE_CLIENT_SECRET` lúc build (thiếu 1 trong 2 là tắt), set tay sẽ không có tác dụng và có thể khiến hai biến lệch nhau.

### 3. (Tùy chọn) Chạy local
Thêm cùng 2 giá trị vào `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), rồi `npm run dev`.

Sau khi xong: nút **Tiếp tục với Google** trên `/login` sẽ active. Nhờ `allowDangerousEmailAccountLinking`, tài khoản Google sẽ gắn vào đúng User đã tạo qua GitHub trước đó (theo email đã verify), giữ nguyên card/XP thay vì tạo user mới.

> GitHub provider vẫn được đăng ký trong `authOptions` dù nút đã gỡ khỏi `/login` — `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` có thể giữ nguyên hoặc xoá khỏi env mà không phá gì, vì không còn nút nào gọi tới provider đó nữa.

## Kiến trúc
- NextAuth v4 (JWT session) + Prisma Adapter + Google provider.
- Mọi route học/ôn/thống kê bảo vệ bằng middleware → redirect `/login`.
- Data per-user (Card/ReviewLog/StudySession/DailyStat/Settings scope theo `userId`).
- Neon dùng chung cho dev + prod (đây chính là cơ chế sync).

## PWA (cài đặt được + chống mất mạng)

Mục tiêu là **installability + resilience**, KHÔNG phải học offline đầy đủ. Các file:
`src/app/manifest.ts` (→ `/manifest.webmanifest`), `public/icons/*`, `public/sw.js`,
`src/app/offline/page.tsx`, `src/components/sw-register.tsx`.

### Service worker cache gì
- **Precache (lúc install):** chỉ `/offline`.
- **Static cache-first:** `/_next/static/*` (gồm cả font next/font self-host), `/icons/*`, `/fonts/*` — tên file có hash nên bất biến. Cache static bị **giới hạn FIFO ~150 entry** (`MAX_STATIC_ENTRIES`, ≈2 lần deploy) — không thì mỗi deploy dồn thêm một lát asset content-hash mới, phình dần và trên mobile bị storage pressure xoá Cache Storage kiểu ALL-OR-NOTHING (mất luôn precache `/offline`).
- **Navigations:** network-first; mất mạng → trả trang `/offline` đã cache. **KHÔNG bao giờ cache HTML điều hướng.**
- **KHÔNG bao giờ đụng `/api/*`** (đặc biệt `/api/auth/*`) — request đi thẳng ra mạng.

### Quy tắc chống "vỏ đăng nhập cũ" (logged-out-stale-shell)
HTML điều hướng phụ thuộc session, nên SW không được phép cache nó. Nếu cache, một
người **đã đăng xuất** có thể thấy lại vỏ giao diện của phiên đã đăng nhập trước đó.
Vì vậy fetch handler chỉ dùng network cho navigations và chỉ fallback sang `/offline`
(trang tĩnh, không auth) khi mạng lỗi.

### Bump `CACHE_VERSION` khi nào
Sửa `const CACHE_VERSION = "atelier-v1"` trong `public/sw.js` (ví dụ `atelier-v2`) mỗi khi
đổi tập precache hoặc quy tắc caching. Activate sẽ xoá mọi cache không khớp prefix version
mới rồi `clients.claim()`, nên client cũ được dọn sạch ở lần điều hướng kế tiếp.

> ⚠️ Bump `CACHE_VERSION` có thể gây **ChunkLoadError** ở các tab mở xuyên suốt lúc deploy:
> `skipWaiting` + xoá cache cũ + `claim()` xảy ra giữa phiên, nên chunk lazy cũ mà tab đang
> tham chiếu có thể biến mất. **Reload là hết.** (Đây là lý do KHÔNG bump version mỗi deploy —
> chỉ bump khi thật sự đổi precache/quy tắc caching.)

### SW chỉ chạy ở production
`SwRegister` chỉ `register("/sw.js")` khi `NODE_ENV === "production"` — dev không cache để
lặp code không bị kẹt asset cũ.

### Test thủ công (KHÔNG test được headless)
Hành vi service worker không kiểm thử được bằng build tĩnh. Sau khi deploy prod:
1. Mở app trên Chrome → DevTools → **Application → Service Workers**: xác nhận `sw.js` activated.
2. **Application → Manifest**: thấy tên "Atelier — Vocabulary Studio", 4 icon, `display: standalone`; nút cài đặt xuất hiện (Chrome/Android install prompt, iOS "Add to Home Screen").
3. Bật **Offline** (Network throttling = Offline) → điều hướng sang route bất kỳ → phải thấy trang `/offline` (không phải màn lỗi trình duyệt).
4. Đăng xuất → bật Offline → điều hướng: KHÔNG được thấy vỏ giao diện đã đăng nhập (chứng minh HTML điều hướng không bị cache).
5. Đổi `CACHE_VERSION`, deploy lại, reload 2 lần → cache version cũ bị xoá (kiểm tra **Application → Cache Storage**).
6. **Tab cũ xuyên deploy:** mở 1 tab, GIỮ nguyên (không reload), deploy phiên có bump `CACHE_VERSION`, rồi trong tab cũ đó điều hướng sang 1 route lazy (vd `/study/flashcard`) → nếu gặp ChunkLoadError thì reload là hết (đúng như cảnh báo trên); không bump version thì tab cũ vẫn chạy bình thường nhờ static cache còn nguyên.
