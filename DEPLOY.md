# Deployment — Vercel + Neon + GitHub OAuth

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

> Muốn dùng cả local: thêm callback thứ 2 `http://localhost:3939/api/auth/callback/github` (hoặc tạo 1 OAuth app riêng cho dev).

### 2. Thêm vào Vercel
```bash
printf '%s' 'PASTE_CLIENT_ID'     | vercel env add GITHUB_CLIENT_ID production
printf '%s' 'PASTE_CLIENT_SECRET' | vercel env add GITHUB_CLIENT_SECRET production
vercel --prod --yes
```
(Hoặc Vercel dashboard → project → Settings → Environment Variables.)

### 3. (Tùy chọn) Chạy local
Thêm cùng 2 giá trị vào `.env` (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`), rồi `npm run dev`.

Sau khi xong: nút **Đăng nhập với GitHub** trên `/login` sẽ active → đăng nhập → data học sync qua Neon trên mọi thiết bị.

## Kiến trúc
- NextAuth v4 (JWT session) + Prisma Adapter + GitHub provider.
- Mọi route học/ôn/thống kê bảo vệ bằng middleware → redirect `/login`.
- Data per-user (Card/ReviewLog/StudySession/DailyStat/Settings scope theo `userId`).
- Neon dùng chung cho dev + prod (đây chính là cơ chế sync).
