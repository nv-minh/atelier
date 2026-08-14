# Deployment — Vercel + Neon + Google OAuth

## Đổi hostname sang `atelier-lang.vercel.app`

`atelier-lang.vercel.app` là host chính thức từ 2026-08-14. Host cũ
`vocab-master-dusky.vercel.app` vẫn sống (project chưa đổi tên) và là đường lùi.

Hostname cũ đang **gánh 5 việc cùng lúc**: `NEXTAUTH_URL`, redirect URI của Google OAuth,
callback GitHub OAuth, secret `REMINDERS_CRON_URL`, và origin của mọi service worker +
push subscription. Vì vậy `vercel project rename` là bước **CUỐI**, không phải bước đầu —
đổi tên project trước khi chuyển các tham chiếu là sập toàn bộ đăng nhập và cron.

Thứ tự đã chạy (2026-08-14), giữ lại vì lần mua domain riêng sẽ lặp y hệt:

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Gán `atelier-lang.vercel.app` vào project (`vercel domains add`) — thuần cộng thêm | ✅ |
| 2 | Đổi tên repo → `nv-minh/atelier`, `git remote set-url` | ✅ |
| 3 | `NEXT_PUBLIC_SITE_URL` + `NEXTAUTH_URL` → host mới trên env production | ✅ |
| 4 | Deploy lại (env bind lúc deploy — không deploy thì bước 3 vô nghĩa) | ✅ |
| 5 | Google Cloud Console → Credentials → **THÊM** `https://atelier-lang.vercel.app/api/auth/callback/google`. **Giữ nguyên URI cũ** làm đường lùi. | ⬜ **tay, chủ repo** |
| 6 | GitHub OAuth App → Homepage + callback sang host mới (provider còn đăng ký nhưng nút đã gỡ khỏi `/login`, nên không chặn gì) | ⬜ tay, không gấp |
| 7 | `gh secret set REMINDERS_CRON_URL` → host mới | ✅ |
| 8 | `NEXT_PUBLIC_CONTACT_EMAIL` → hộp thư thật (xem `src/lib/legal.ts`) | ⬜ **chặn việc public** |
| 9 | `vercel project rename vocab-master atelier` — **để cuối cùng**, sau khi bước 5 xong và đăng nhập đã verify. Bước này khai tử `vocab-master-dusky.vercel.app`, tức là mất đường lùi. | ⬜ |

> Giữa bước 4 và bước 5, đăng nhập trên host mới trả `redirect_uri_mismatch`. Đó là
> hành vi đúng, không phải hỏng: `NEXTAUTH_URL` chỉ nhận một giá trị, còn Google thì
> chưa biết URI mới. Muốn lùi: trỏ `NEXTAUTH_URL` về `vocab-master-dusky.vercel.app`
> rồi deploy lại — URI cũ vẫn còn đăng ký nên chạy ngay.

**Đừng đụng vào:** `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (đổi là giết sạch push
subscription cùng lúc) và `CRON_SECRET` (phải giống hệt nhau ở Vercel và repo secret —
lệch là 401 mỗi giờ, im lặng). `CACHE_VERSION` trong `public/sw.js` cũng **không** bump vì
đổi domain: Cache Storage tách theo origin nên origin mới vốn đã bắt đầu rỗng.

**Push + PWA khi đổi origin:** subscription và bản cài PWA gắn chặt origin. Lúc cutover
2026-08-14, DB có 6 user và **0 push subscription** nên chi phí đúng bằng không. Nếu về sau đã có
người dùng thật, mỗi thiết bị phải: tắt nhắc học ở origin **cũ** (chỉ đường này mới xoá
được cả row lẫn subscription phía trình duyệt), rồi bật lại ở origin mới; iOS phải xoá icon
cũ và Add to Home Screen lại. Bỏ bước tắt ở origin cũ sẽ tạo **2 row → 2 push mỗi lần nhắc**.

> Cái giá này phải trả **lại một lần nữa** khi mua domain riêng. Nếu định mua trong 1–2
> tháng tới thì cân nhắc gộp làm một lần.

## Đã deploy
- **App**: https://atelier-lang.vercel.app — host cũ `vocab-master-dusky.vercel.app` vẫn sống làm đường lùi cho tới khi đổi tên project.
- **DB**: Neon Postgres (project `sparkling-bird-30788729`, database `neondb`), đã seed 3.677 từ.
- **Env trên Vercel (production)**: 14 biến — xem `.env.example` để biết đủ danh sách và ý nghĩa từng biến.
- **Auth**: GitHub OAuth (NextAuth v4) — đang BẬT. `AUTH_BYPASS` đã tắt trên prod (khách chưa đăng nhập xem được landing page, danh sách chủ đề và trang đầu thư viện; phần còn lại hiện màn hình yêu cầu đăng nhập — xem mục Kiến trúc).

> Local dev (`.env`) vẫn giữ `AUTH_BYPASS="1"` để chạy nhanh không cần login (GitHub OAuth app callback trỏ về prod, nên local sẽ mismatch — dùng bypass khi dev).


## Bước cuối — bật GitHub Sign-in (cần bạn làm, tôi không thể tạo credentials)

Đăng nhập GitHub đang **disabled** cho đến khi thêm credentials. Để bật:

### 1. Tạo GitHub OAuth App
1. Vào https://github.com/settings/applications/new (đăng nhập GitHub).
2. Điền:
   - **Application name**: `Atelier`
   - **Homepage URL**: `https://atelier-lang.vercel.app`
   - **Authorization callback URL**: `https://atelier-lang.vercel.app/api/auth/callback/github`
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
   - `https://<production-domain>/api/auth/callback/google` (prod — thay bằng domain thật, vd `atelier-lang.vercel.app`)
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
- **Cổng đăng nhập 2 lớp.** `middleware.ts` chỉ còn chặn `/study/*` → redirect `/login`.
  Các route còn lại tự gọi `getCurrentUser()` rồi render `<AuthRequired>` (hoặc phần
  công khai của trang) thay vì redirect: khách thấy nội dung giải thích tại chỗ, không
  bị đá về `/login` — trước đây bị đá về chính trang họ đang đứng nên thao tác trông
  như không có phản hồi. Công khai: `/`, `/topics`, `/browse` trang 1. Yêu cầu đăng
  nhập: `/topics/[slug]`, `/browse` từ trang 2, `/word/*`, `/notebook`, `/stats`,
  `/settings`. Thao tác chặn được ở client (mở chủ đề, sang trang 2, bấm sao) mở modal
  trong `components/auth-gate.tsx`.
- Cổng này là UX, không phải hàng rào dữ liệu: mọi route `/api/*` tự kiểm tra auth
  (`requireUserId`), middleware chưa bao giờ phủ `/api`.
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
2. **Application → Manifest**: thấy tên "Atelier — Studio học ngôn ngữ", 4 icon, `display: standalone`; nút cài đặt xuất hiện (Chrome/Android install prompt, iOS "Add to Home Screen").
3. Bật **Offline** (Network throttling = Offline) → điều hướng sang route bất kỳ → phải thấy trang `/offline` (không phải màn lỗi trình duyệt).
4. Đăng xuất → bật Offline → điều hướng: KHÔNG được thấy vỏ giao diện đã đăng nhập (chứng minh HTML điều hướng không bị cache).
5. Đổi `CACHE_VERSION`, deploy lại, reload 2 lần → cache version cũ bị xoá (kiểm tra **Application → Cache Storage**).
6. **Tab cũ xuyên deploy:** mở 1 tab, GIỮ nguyên (không reload), deploy phiên có bump `CACHE_VERSION`, rồi trong tab cũ đó điều hướng sang 1 route lazy (vd `/study/flashcard`) → nếu gặp ChunkLoadError thì reload là hết (đúng như cảnh báo trên); không bump version thì tab cũ vẫn chạy bình thường nhờ static cache còn nguyên.

## Nhắc học (Web Push + cron)

### 1. Năm biến môi trường mới
Sinh cặp VAPID một lần rồi dán vào Vercel → Project Settings → Environment Variables
(và `.env.local` để chạy máy mình):

```bash
npx web-push generate-vapid-keys
openssl rand -hex 32   # CRON_SECRET
```

| Biến | Ghi chú |
|---|---|
| `VAPID_PUBLIC_KEY` | từ lệnh trên |
| `VAPID_PRIVATE_KEY` | từ lệnh trên — **bí mật**, không commit |
| `VAPID_SUBJECT` | `mailto:<email của bạn>` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **cùng giá trị** với `VAPID_PUBLIC_KEY`; client phải đọc được |
| `CRON_SECRET` | endpoint cron chỉ nhận `Authorization: Bearer <giá trị này>` |

Đổi cặp VAPID sau khi đã có người đăng ký = mọi subscription cũ chết (push service từ chối),
và chúng chỉ bị dọn dần khi cron gặp 404/410. Sinh một lần rồi giữ nguyên.

### 2. `db:push` phải chạy TRƯỚC khi deploy
Code mới đọc ba cột mới của `Settings` (`remindHour`, `tz`, `nextRemindAt`) và bảng
`PushSubscription`. Deploy trước khi push schema = 500 trên `/` và `/settings`.

### 3. Cron chạy bằng GitHub Actions, KHÔNG phải Vercel Cron
**Đã có câu trả lời dứt điểm (2026-08-14): tài khoản Hobby chỉ cho cron mỗi ngày một lần.**
Deploy với `vercel.json` chứa `"schedule": "0 * * * *"` bị từ chối thẳng:

> Hobby accounts are limited to daily cron jobs. This cron expression (0 * * * *) would
> run more than once per day. Upgrade to the Pro plan…

Đáng ghi lại vì `npx vercel crons ls` **nhận** lịch đó và liệt kê ở trạng thái `not deployed`
mà không cảnh báo gì, còn tài liệu Vercel chỉ nêu cú pháp (kể cả ví dụ `* * * * *`) chứ không
nói giới hạn theo plan. Chỉ deploy mới lộ ra.

**Cron mỗi ngày không dùng được ở đây**, nên đừng hạ tần suất cho vừa Hobby: người học tự chọn
giờ nhắc, còn endpoint gửi những gì đến hạn *tại thời điểm nó chạy* — trigger mỗi ngày một lần
sẽ nhắc tất cả mọi người vào đúng cái giờ đó thay vì giờ họ chọn.

Nên `vercel.json` **đã bị xoá** và trigger chuyển sang `.github/workflows/reminders.yml`.
**Không dòng code app nào phải đổi** — endpoint chỉ xác thực bằng `CRON_SECRET`.

Hai secret của repo (đã đặt bằng `gh secret set`):

| Secret | Giá trị |
|---|---|
| `REMINDERS_CRON_URL` | `https://atelier-lang.vercel.app/api/cron/reminders` |
| `CRON_SECRET` | **cùng giá trị** với biến `CRON_SECRET` trên Vercel — lệch là 401 mỗi giờ, im lặng |

Hai điểm yếu của scheduler GitHub, biết trước để khỏi truy nhầm:
- Nó là **best-effort**: chạy trễ vài phút là bình thường, và có thể bị bỏ hẳn khi hệ thống
  tải cao. Mất một lần chạy **không mất lời nhắc** — `nextRemindAt` vẫn nằm ở quá khứ và lần
  chạy sau vớt được.
- GitHub **tắt** scheduled workflow sau 60 ngày repo không có hoạt động nào. Nhắc học im
  lặng thì kiểm chỗ này trước khi nghi app.

Muốn quay lại Vercel Cron thì phải lên Pro; khi đó tạo lại `vercel.json` và xoá workflow —
đừng để cả hai cùng chạy.

Chạy tay một lần để kiểm workflow mà không phải đợi tới đầu giờ:

```bash
gh workflow run reminders.yml && sleep 20 && gh run list --workflow=reminders.yml --limit 1
```

### 4. Sau deploy: gọi tay một lần trước khi tin cron
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/reminders
```
Trả về `{"scanned":n,"sent":n,"silent":n,"skipped":n,"pruned":n}`. `scanned: 0` ngay sau khi
bật nhắc là **bình thường** — `nextRemindAt` mới đang ở tương lai.

### Nhắc học — test thủ công (KHÔNG test được headless)
Cả hai lý do: quyền thông báo phải do người thật cấp, và service worker chỉ đăng ký ở
production (`npm run dev` không đăng ký được push). Ngoài ra `.env` bật `AUTH_BYPASS=1` chỉ
có tác dụng khi `NODE_ENV !== "production"`, nên `npm start` ở máy sẽ đòi đăng nhập Google
thật — dễ nhất là test luôn trên bản deploy.

- [ ] iPhone/iPad: push CHỈ hoạt động sau khi thêm app vào Màn hình chính. Kiểm cả hai: chưa cài (không xin được quyền, hiện `remindIosHint`) và đã cài (nhận được thông báo).
- [ ] Thông báo khi app đã đóng hoàn toàn (không chỉ ẩn tab).
- [ ] Từ chối quyền → hiện `remindDenied`, không rác trong DB.
- [ ] Bấm thông báo lúc app đang mở → focus tab cũ, không mở tab thứ hai.
- [ ] Nhiều thiết bị cùng tài khoản → mỗi thiết bị một hàng `PushSubscription`, và một lần cron gửi tới tất cả.
- [ ] Cùng thiết bị đổi sang tài khoản khác → subscription CHUYỂN chủ, người mới không nhận nhắc của người cũ.

> Đã nghiệm được bằng script (không cần trình duyệt): cap 1 lần/ngày, đường im lặng vẫn đẩy
> con trỏ, dọn subscription chết khi push service trả 404/410, và việc chuyển chủ subscription.
