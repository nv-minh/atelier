# Thêm đăng nhập Google, ẩn đăng nhập GitHub — Design

**Ngày:** 2026-08-13
**Trạng thái:** đã được duyệt (brainstorming), chờ lập kế hoạch thực thi
**Phạm vi:** `src/lib/auth.ts`, trang login, biến môi trường, tài liệu triển khai
**Nhánh:** `google-auth`, tách từ `main` tại `71df93b`

---

## 1. Bối cảnh

Đây là **gói C**, gói cuối trong ba gói của lượt việc này. Gói A (sàn từ mới + reveal theo mode) và gói B (âm thanh + mượt mobile + PWA install) đã merge vào `main`.

### Đính chính một giả định ban đầu

Yêu cầu ban đầu là "**mở lại** login OAuth với Google". Đã kiểm: `git log --all -S 'GoogleProvider'` trả về rỗng, và `grep -rniE 'google' src` chỉ khớp `next/font/google` với một link tìm ảnh. **Google OAuth chưa từng tồn tại trong repo này.** Đây là việc *thêm mới*, không phải khôi phục. Ghi lại để sau này không ai đi tìm code cũ không hề có.

### Trạng thái hiện tại — đã đo, không phỏng đoán

| Sự việc | Bằng chứng |
|---|---|
| Chỉ có một provider: GitHub, gate theo env | `src/lib/auth.ts:6-17` |
| Chiến lược session là JWT, adapter là Prisma | `src/lib/auth.ts:10-11` |
| Trang login chỉ có một nút GitHub | `src/app/login/page.tsx:27-38` |
| Cờ hiển thị nút đọc từ env công khai | `login/page.tsx:44`, `next.config.js:5` |
| `AUTH_BYPASS=1` cho dev dùng user local dùng chung | `src/middleware.ts:5,13` |
| **4 user, 3 Account đều là `github`** | truy vấn Prisma trực tiếp |
| **106 thẻ, 79 lượt ôn** đang gắn với các user đó | truy vấn Prisma trực tiếp |
| Email đều là địa chỉ thật (2× gmail, 1× monstar-lab, 1× atelier.app) | truy vấn Prisma, chỉ đọc domain |
| `User.email` là `@unique`; mọi dữ liệu học gắn vào `User.id` | `prisma/schema.prisma:12-30` |

### Cạm bẫy đã phát hiện trước khi viết code

`User.email` là `@unique`. Nếu thêm Google mà **không** liên kết tài khoản, thì một người đã có `User` tạo từ GitHub, nay đăng nhập Google bằng **đúng email đó**, sẽ đi vào nhánh này của NextAuth:

1. Tìm `Account` theo `(provider: "google", providerAccountId)` → không có.
2. Định tạo `User` mới với email đó → đụng ràng buộc `@unique`.
3. NextAuth ném `OAuthAccountNotLinked`.

Kết quả **không phải** "bắt đầu lại từ đầu" mà là **tắc hoàn toàn**: không vào được tài khoản cũ, cũng không tạo được tài khoản mới. Cộng thêm việc nút GitHub bị ẩn, người đó mất hẳn đường đăng nhập vào production.

Đây là lý do quyết định liên kết tài khoản bên dưới, và là lý do nó **không** phải chi tiết kỹ thuật vụn vặt.

### Quyết định của người dùng (ghi lại để về sau không phải đoán lại)

| Câu hỏi | Chốt |
|---|---|
| Đã có Google credentials chưa | **Chưa** — code gate theo env, điền sau, không phải sửa code |
| 3 tài khoản GitHub cũ xử lý sao | **Liên kết theo email** — `allowDangerousEmailAccountLinking: true` (chốt lại sau khi biết rõ hệ quả tắc đăng nhập) |
| "Ẩn login GitHub" ở mức nào | **Ẩn nút, giữ provider** đăng ký trong NextAuth |

### Tiêu chí thành công

1. Có `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` → nút "Tiếp tục với Google" hiện và đăng nhập được.
2. Thiếu biến đó → provider tự tắt, trang login không vỡ, không hiện nút chết.
3. Người đã có tài khoản GitHub, đăng nhập Google **cùng email**, vào **đúng** `User` cũ — nguyên thẻ, XP, huy hiệu. Không tạo user trùng.
4. Nút GitHub không còn trên trang login, nhưng provider vẫn đăng ký nên phiên đang đăng nhập không bị đá và 3 `Account` row cũ không thành mồ côi.
5. Không đổi schema, không thêm dependency.

### Ngoài phạm vi

Không đụng gamification, practice, PWA. Không thêm provider thứ ba. Không làm trang quản lý "tài khoản đã liên kết". Không xoá dữ liệu cũ.

---

## 2. Thêm Google provider

`src/lib/auth.ts` giữ nguyên khuôn hiện có — provider chỉ được nạp khi đủ credentials:

```ts
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

providers: [
  ...(googleId && googleSecret
    ? [
        GoogleProvider({
          clientId: googleId,
          clientSecret: googleSecret,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
  // GitHub stays registered (env-gated as before) even though its button is
  // gone from the login page — see §4.
  ...(ghId && ghSecret ? [GitHubProvider({ clientId: ghId, clientSecret: ghSecret })] : []),
],
```

`next-auth/providers/google` đã có sẵn trong `next-auth@4.24` — **không thêm dependency**.

### 2.1 Vì sao `allowDangerousEmailAccountLinking` là đúng ở đây

Cờ này cho phép NextAuth gắn một `Account` mới vào `User` đã tồn tại **khi email trùng**. Tên nó có chữ "dangerous" vì nó **tin vào việc provider đã xác minh email**: nếu dùng với một provider cho phép đặt email tuỳ ý mà không xác minh, kẻ tấn công có thể tạo tài khoản mang email nạn nhân rồi chiếm tài khoản.

Google **có** xác minh email trước khi phát hành `email_verified`. Rủi ro thực tế vì vậy thấp, và đây là cách xử lý tiêu chuẩn cho Google. Đổi lại, nó xoá bỏ hoàn toàn kịch bản tắc đăng nhập ở §1.

Cờ này **chỉ** đặt trên Google. Không đặt trên GitHub — không có nhu cầu, và mỗi cờ như vậy là một bề mặt tin cậy thêm vào.

### 2.2 Điều cờ này không làm

Nó **không** gộp hai `User` row đã tồn tại. Nếu ai đó lỡ tạo sẵn một `User` thứ hai bằng email khác thì hai tài khoản vẫn tách rời — cờ chỉ tác dụng lúc `Account` mới được gắn vào `User` trùng email. Với dữ liệu hiện tại (4 user, không trùng email) điều này không phát sinh.

---

## 3. Biến môi trường & thiết lập Google Cloud

Không có credentials thì không test được. Spec ghi hẳn ra để khỏi phải mò:

| Biến | Dùng ở đâu |
|---|---|
| `GOOGLE_CLIENT_ID` | `src/lib/auth.ts` (server) |
| `GOOGLE_CLIENT_SECRET` | `src/lib/auth.ts` (server) |
| `NEXT_PUBLIC_GOOGLE_ENABLED` | trang login, suy ra trong `next.config.js` từ `GOOGLE_CLIENT_ID` — **không** phải biến khai báo tay |

`next.config.js` hiện đã làm đúng thủ thuật này cho GitHub (`next.config.js:5`): suy `NEXT_PUBLIC_*` từ biến server, nên chỉ cần khai báo **một** biến trên Vercel thay vì hai, và không bao giờ lệch nhau.

**Redirect URI phải khai báo trong Google Cloud Console** (OAuth 2.0 Client ID, loại Web application):
- `http://localhost:3000/api/auth/callback/google`
- `https://<domain-production>/api/auth/callback/google`

Thiếu URI production là lỗi hay gặp nhất khi deploy: local chạy ngon, production báo `redirect_uri_mismatch`.

---

## 4. Ẩn nút GitHub

Trang login (`src/app/login/page.tsx`) bỏ nút GitHub, thay bằng nút Google. **Provider GitHub vẫn ở lại trong `auth.ts`.**

Lý do giữ provider dù giấu nút:
- Phiên đang đăng nhập bằng GitHub không bị đá ra.
- 3 `Account` row `github` không thành mồ côi.
- Bật lại chỉ tốn một nút, không phải viết lại provider.
- Nếu Google credentials có vấn đề lúc deploy, còn đường vào bằng cách tạm thêm lại nút.

`hasGithub` / `NEXT_PUBLIC_GITHUB_ENABLED` giữ nguyên trong `next.config.js` — không dọn, vì dọn là thay đổi không phục vụ mục tiêu nào của gói này.

Trạng thái "chưa cấu hình" của trang login nay bám theo **Google**: không có `NEXT_PUBLIC_GOOGLE_ENABLED` thì nút Google hiện dạng vô hiệu kèm dòng chú thích, đúng như GitHub đang làm (`login/page.tsx:29,36-38`).

---

## 5. Test & nghiệm

Repo cố ý không có test component (spec practice-modes §12), và không thể test tự động một luồng OAuth thật. Nhưng phần **quyết định provider nào được nạp** là logic thuần và nên có test:

| Đối tượng | Cách kiểm |
|---|---|
| Danh sách provider theo env | Vitest: đủ cả 2 cặp biến → 2 provider · chỉ Google → 1 · không biến nào → 0, và `authOptions` không ném lỗi |
| Cờ liên kết | Vitest: provider Google có `allowDangerousEmailAccountLinking === true`; provider GitHub **không** có |
| Trang login | Chạy thật: có env → nút Google bấm được; không env → nút vô hiệu + chú thích, không vỡ layout |
| Nút GitHub | Chạy thật: không còn trên trang login |
| Liên kết tài khoản | Chạy thật, **cần credentials**: đăng nhập Google bằng email trùng một `User` GitHub cũ → vào đúng user đó; kiểm `Account` có thêm row `google` cùng `userId`, và số thẻ giữ nguyên |
| Không hồi quy | `npx vitest run` (57 test hiện có) + `npx tsc --noEmit` + `npm run build` |

Mục "liên kết tài khoản" **không nghiệm được nếu chưa có credentials**. Plan phải nói rõ đây là bước người dùng tự làm sau, chứ không được báo cáo là đã xong.

---

## 6. Giả định do tác giả spec quyết, không do người dùng chọn

1. **Nút Google đặt trên, nơi nút GitHub đang đứng** — không đổi bố cục, chữ, hay phong cách trang login ngoài việc thay nút.
2. **Chuỗi chữ vào i18n cả `vi` lẫn `en`** theo đúng lệ của repo; khóa `login.github` cũ giữ lại (không dùng nữa nhưng xoá đi không được gì).
3. **Không thêm màn hình chọn provider.** Một nút Google là toàn bộ trang login.
4. **Không đụng `AUTH_BYPASS`.** Nó vẫn là đường dev local và không liên quan tới gói này.
5. **Icon Google vẽ inline bằng SVG**, cùng cách `GithubIcon` đang làm — không thêm asset, không thêm thư viện icon.
