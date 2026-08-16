# Atelier — Prompt cho AI agent theo từng phase

> Dùng với Claude Code / Cursor / Windsurf. Copy nguyên khối, dán vào agent.
> Đặt `01-plan.md` và `02-tokens.css` ở thư mục gốc repo trước khi bắt đầu.

---

## Prompt khởi động (chạy một lần, đầu mỗi session)

```
Bạn là frontend engineer làm việc trên Atelier — PWA học từ vựng tiếng Anh cho người Việt.

Đọc kỹ hai file ở gốc repo trước khi làm bất cứ việc gì:
- 01-plan.md        (spec thiết kế v2, đọc TOÀN BỘ)
- 02-tokens.css     (design tokens v2)
- preview.html    (mockup sống — MỞ TRƯỚC để thấy đích đến)
- assets/README-3d.md (bộ 1.375 vật thể 3D)

Quy tắc bắt buộc trong mọi phase:
1. Mọi màu/spacing/radius/font-size đọc từ token trong 02-tokens.css.
   Cần giá trị mới → thêm token vào file đó, KHÔNG hard-code trong component.
2. Không dùng 100vh (dùng 100dvh). Không dùng env(safe-area-*) trực tiếp
   (dùng var(--safe-t), var(--safe-b), var(--pad-bottom-nav)).
   Không dùng z-index số tự nghĩ (dùng var(--z-*)).
3. Mọi vùng chạm >= 44x44px. Mọi IconButton có aria-label tiếng Việt.
4. Mọi component có đủ trạng thái: default, loading, rỗng, lỗi, disabled.
5. Tôn trọng prefers-reduced-motion.
6. Đọc mục 17 "Những điều KHÔNG được làm" và tuân thủ tuyệt đối.
7. Không đổi logic FSRS, không đổi schema DB, không đổi API.

Ghi mọi quyết định, mọi chỗ spec mâu thuẫn với code thực tế, và mọi số liệu đo
được vào MIGRATION-NOTES.md.

Xác nhận bạn đã đọc xong bằng cách tóm tắt trong 5 gạch đầu dòng:
hướng thiết kế, 2 signature element, bảng màu, hệ font (kèm cảnh báo Poppins), và 5 tab điều hướng mới.
Chưa viết code.
```

---

## Phase 0 — Audit

```
Thực hiện Phase 0 trong 01-plan.md (mục 15).

1. Xác định stack thật: đọc package.json, next.config.*, tailwind.config.*,
   tìm thư mục i18n/messages, tìm cấu hình PWA/service worker, tìm cấu hình auth.
   Ghi kết quả vào MIGRATION-NOTES.md, đối chiếu với bảng giả định ở mục 1.1.

2. Chạy app local, đăng nhập, và audit 7 trang chưa xem được:
   /study và các chế độ con, /notebook, /stats, /leaderboard, /settings,
   /word/[slug], /onboarding.
   Với MỖI trang, điền đúng khung ở mục 2.7 của plan.
   Chụp màn hình ở 360px, 390px, 768px, cả light và dark nếu có.

3. Đo baseline:
   - Lighthouse mobile cho /, /browse, /topics, /grammar → ghi LCP, INP, CLS,
     điểm Performance/Accessibility/PWA
   - npx @next/bundle-analyzer → ghi kích thước bundle từng route
   - Tổng byte ảnh của /browse (DevTools Network, filter Img)

4. Liệt kê mọi chỗ hard-code màu: grep -rn "#[0-9a-fA-F]\{6\}" src app --include=*.tsx --include=*.ts --include=*.css

Output: MIGRATION-NOTES.md hoàn chỉnh + thư mục ./audit-screenshots/.
CHƯA sửa code gì.
```

---

## Phase 1 — Sửa lỗi chặn

```
Thực hiện Phase 1 (mục 15). Đây là các lỗi đang hiện trên production.

1. [T1] Bổ sung 6 key i18n đang lộ raw ra UI ở /topics, cả vi và en:
   topics.blurbs.medical, topics.blurbs.legal, topics.blurbs.daily-life,
   topics.blurbs.finance, topics.blurbs.social, topics.blurbs.office-skills
   Viết mô tả ngắn 1 câu, giọng giống các blurb đã có.

2. [T1-b] Thêm script CI quét mọi key i18n được gọi trong code và fail build
   nếu thiếu bản dịch ở bất kỳ locale nào. Thêm vào package.json scripts.

3. [T2] Card "Tiếng Anh Thương mại" ở đầu /topics không có link. Sửa để trỏ
   đúng /topics/[slug].

4. [G1] Ở /grammar: section đầu tiên mất tiêu đề (phải là "Thì") và card đầu
   tiên mất tên chủ đề (chỉ còn "0/10 bài · 360 câu hỏi"). Tìm nguyên nhân và sửa.

5. [H3] Xóa section "Sắp có: Ngữ pháp / Đang xây, chưa hẹn ngày" ở trang chủ.
   /grammar đã chạy thật với 40+ chủ điểm. Thay bằng một section ngắn giới thiệu
   ngữ pháp có link thật, kèm số liệu đúng lấy từ dữ liệu.

6. [H2] Nav đang render 2 lần trong DOM (bộ 8 mục + bộ 6 mục). Giữ 1, xóa 1.
   Kiểm chứng: document.querySelectorAll('nav').length === 1

7. [X2] Trong app/layout.tsx:
   - viewport: thêm viewport-fit=cover
   - theme-color: tách theo prefers-color-scheme
     light #F4F3EE, dark #121110
   - thêm apple-mobile-web-app-capable và apple-mobile-web-app-status-bar-style

Nghiệm thu: chạy qua /, /topics, /grammar và xác nhận không còn raw i18n key,
mọi card click được, chỉ còn 1 nav. Chụp ảnh trước/sau.
```

---

## Phase 2 — Nền tảng thị giác

```
Thực hiện Phase 2 (mục 15) — dựng hệ thống thiết kế.

1. Copy 02-tokens.css vào src/styles/tokens.css, import ở đầu globals.css
   TRƯỚC @tailwind base. Nối token vào tailwind.config theo đúng mục 4.1 của plan.

2. Cài font theo mục 5.2 (next/font, subset 'vietnamese' BẮT BUỘC).
   Sau đó KIỂM TRA GLYPH — bước này bắt buộc, không được bỏ:
   - Tạo trang tạm /dev/type render:
     IPA:  /əbˈdʌk.ʃn̩/  /ˌækəˈdemɪk/  /ə.ˈbɹʌpt.li/  /æbˈdəʊ.mən/
     Việt: Ệ Ặ Ỡ Ữ ỷ ẫ ộ ằ Ề  (ở 16px, 24px và 48px)
   - Chụp màn hình. Nếu có ô vuông tofu ở IPA → chuyển phiên âm sang Charis SIL
     và tự host. Nếu dấu tiếng Việt bị cắt/chồng ở font display → dùng
     Be Vietnam Pro cho tiêu đề tiếng Việt, giữ Bricolage chỉ cho từ tiếng Anh.
   - Ghi kết quả kiểm tra vào MIGRATION-NOTES.md.

3. Dark mode: đặt data-theme trên <html>, đọc từ localStorage + prefers-color-scheme,
   không nhấp nháy khi load (inline script trong <head>). Cập nhật meta theme-color
   theo theme. Thêm công tắc 3 trạng thái (Sáng/Tối/Theo hệ thống) trong Cài đặt.

4. Xây primitive trong src/components/ui/ theo bảng 7.1:
   Button, IconButton, Chip, Card, Sheet, Dialog, Toast, Input, Switch,
   SegmentedControl, ProgressBar, Skeleton, EmptyState, Tabs
   Mỗi cái đủ biến thể và trạng thái như bảng mô tả.

5. Xây CefrStamp theo mục 3.5: A1/A2 viền, B1/B2 nền nhạt/đậm, C1 mực đặc.
   Một hue Indigo, 5 độ đậm. Font mono, uppercase, tracking .06em, cao 20px.

6. Tạo trang /dev/ui hiển thị toàn bộ component ở cả 2 theme.

7. Dọn hex hard-code: grep -rn "#[0-9a-fA-F]\{6\}" src/components phải ra 0 dòng.

Nghiệm thu: /dev/ui đầy đủ, /dev/type pass, grep sạch, build không lỗi.
```

---

## Phase 3 — App shell & điều hướng

```
Thực hiện Phase 3 (mục 15) — biến website thành app.

1. TabBar 5 tab theo mục 6.1:
   Học (layers, /) · Chủ đề (library-big, /topics) · Ôn ngay (zap, /study, nút nổi
   giữa, nền accent, badge số từ đến hạn) · Ngữ pháp (book-open, /grammar) ·
   Tôi (circle-user, /me)
   Cao 56px + var(--safe-b). z-index var(--z-tabbar). Tab đang active dùng
   --accent, còn lại --fg-subtle.

2. AppBar 52px dính đỉnh, nền var(--bg-scrim-blur) + backdrop-filter: blur(12px),
   padding-top var(--safe-t).

3. Nút Back thông minh (mục 6.3): phát hiện standalone bằng
   matchMedia('(display-mode: standalone)') hoặc navigator.standalone.
   Khi standalone và không ở màn hình gốc của tab → hiện nút ← ở AppBar.

4. Safe area toàn cục: mọi màn hình dùng var(--pad-bottom-nav) cho padding đáy.
   Thay TẤT CẢ 100vh bằng 100dvh: grep -rn "100vh" src app

5. Vuốt từ mép trái để back trên màn hình con, ngưỡng 30% chiều rộng.

6. Ẩn TabBar khi ở trong /study/* (chế độ toàn màn hình).

7. Chuyển /notebook, /stats, /leaderboard, /settings thành mục con của /me
   theo layout ở 8.7. Giữ nguyên các route cũ (redirect hoặc vẫn truy cập được
   trực tiếp) để không vỡ link đã lưu.

8. Chuyển /browse thành nút tìm kiếm ở AppBar của tab Chủ đề.

Nghiệm thu BẮT BUỘC trên MÁY THẬT (không chỉ DevTools):
- Cài PWA lên 1 iPhone có tai thỏ/Dynamic Island và 1 Android có thanh gesture
- Xác nhận: không nội dung nào bị che ở trên hoặc dưới; back luôn dùng được;
  TabBar không bị thanh home đè
- Chụp ảnh cả 2 máy, đính vào MIGRATION-NOTES.md
```

---

## Phase 4 — /browse + hệ thống ảnh (tác động lớn nhất)

```
Thực hiện Phase 4 (mục 15, spec 8.4 và 10). Đây là phase thắng lớn nhất về hiệu năng.

1. [B1] Ô tìm kiếm dính đỉnh AppBar. Debounce 250ms. Tìm được cả từ tiếng Anh
   lẫn nghĩa tiếng Việt. font-size 16px (chặn iOS zoom). Có nút xóa.

2. [B2] BỎ HOÀN TOÀN thumbnail khỏi danh sách /browse.
   Ảnh chỉ còn ở /word/[slug] và trên thẻ học.
   Đây là thay đổi giảm ~95% băng thông trang này — không thương lượng.

3. [B3] Thay phân trang Trước/Sau bằng cuộn vô hạn + ảo hóa
   (@tanstack/react-virtual). Giữ vị trí cuộn khi back từ trang chi tiết.

4. [B4] WordRow 3 dòng, cao ~68px:
   dòng 1: từ (h3) + CefrStamp + nút phát âm
   dòng 2: phiên âm (mono, --fg-subtle)
   dòng 3: nghĩa Việt, 1 dòng, ellipsis
   Nghĩa EN, từ đồng nghĩa, từ loại chuyển hết sang trang chi tiết.

5. [B5] Bộ lọc vào bottom Sheet: 3 nút mở sheet (Chủ đề / CEFR / Trạng thái).
   Trong sheet hiện số kết quả trực tiếp khi đổi lựa chọn. Có nút "Xóa lọc".

6. [B7] Bỏ nhãn "US" lặp ở mỗi dòng. Chuyển thành SegmentedControl US/UK
   trong sheet cài đặt phát âm, lưu vào preference.

7. [B8] 5 trạng thái thành Chip lọc cuộn ngang:
   Tất cả · Chưa gặp · Đang học · Đã thuộc · Đã đánh dấu

8. Nhấn giữ một dòng → menu nhanh: phát âm, gắn sao, thêm vào phiên học.

9. Trạng thái rỗng khi tìm không ra (mục 8.10).

10. [Ảnh — mục 10] 
    - Cấu hình next/image remotePatterns cho images.pexels.com và
      upload.wikimedia.org
    - Mọi <img> chuyển sang next/image với sizes đúng và aspect-ratio 16/9
      trên khung để chống CLS
    - Thêm placeholder="blur" với blurDataURL 10px
    - Thêm trường image_policy ('photo' | 'typographic' | 'diagram') vào dữ liệu từ,
      mặc định 'typographic'. Áp quy tắc ở bảng 10.1: từ trừu tượng, từ chức năng,
      từ nhạy cảm KHÔNG hiện ảnh.
    - Dựng biến thể thẻ 'typographic': từ rất lớn bằng font display trên nền
      --bg-sunken có class .paper-grain, phiên âm mono bên dưới. Đây phải trông
      ĐẸP, không phải trạng thái lỗi.
    - Ghi nguồn ảnh dạng caption nhỏ ở trang chi tiết. Wikimedia bắt buộc ghi
      giấy phép.

11. Dựng /word/[slug] đầy đủ theo spec 8.4.

Nghiệm thu (đo trên throttle "Slow 4G" trong DevTools):
- /browse LCP < 2.0s
- Tổng byte ảnh của /browse < 150 KB
- Tìm và mở được từ "vocabulary" trong < 3 giây kể từ khi vào trang
- Cuộn 1000 item không giật (Performance panel: không long task > 200ms)
```

---

## Phase 5 — Phiên học (màn hình quan trọng nhất)

```
Thực hiện Phase 5 (mục 15, spec 8.2). Đọc lại toàn bộ mục 8.2 trước khi code.

1. Vỏ phiên học toàn màn hình (8.2): ẩn TabBar, header 48px với ✕ + ProgressBar
   + đếm thẻ + ⋯. Vùng thẻ căn giữa dọc, vùng hành động cố định đáy trong 1/3
   dưới màn hình + var(--safe-b).
   ✕ mở sheet xác nhận nếu đã làm > 3 thẻ.
   ⋯ mở sheet: âm thanh, giọng US/UK, báo lỗi từ, gắn sao.

2. IntervalRibbon (mục 3.4) — ĐÂY LÀ SIGNATURE ELEMENT, làm cho tốt.
   Props: intervals[], currentIndex, animate.
   Chấm tròn trượt sang mốc mới 320ms với --ease-spring khi chấm điểm.
   Dùng lại ở 3 nơi: dưới RatingBar, ở /word/[slug], ở màn tổng kết.

3. RatingBar 4 nút FSRS, cao 56px, HIỂN THỊ KHOẢNG ÔN DỰ KIẾN dưới mỗi nút
   (Lại · 10ph / Khó · 2ng / Tốt · 5ng / Dễ · 12ng).
   Lấy giá trị này từ FSRS đã tính sẵn — không đổi logic, chỉ hiển thị ra.
   Màu: chỉ viền và text đổi màu, nền giữ trung tính.

4. Flashcard lật 3D 420ms: transform-style preserve-3d, backface-visibility hidden.
   Mặt trước và mặt sau theo đúng wireframe 8.2.1. Nghĩa Việt LÊN TRƯỚC nghĩa Anh.

5. 6 chế độ còn lại theo spec 8.2.2 → 8.2.7. Chú ý các điểm sau, đây là chỗ
   hay sai nhất:
   - Gõ từ: input font-size 16px, autocapitalize/autocorrect/spellcheck off,
     dùng visualViewport API để đẩy input lên trên bàn phím, có nút "Không nhớ"
   - Trắc nghiệm: KHÔNG tự chuyển câu, người dùng bấm Tiếp
   - Cram: banner "không ảnh hưởng lịch ôn" luôn hiện
   - Phát âm: xử lý đầy đủ trường hợp từ chối quyền mic / trình duyệt không hỗ trợ

6. Màn tổng kết (8.2.8). KHÔNG confetti, KHÔNG âm thanh chiến thắng.

7. Prefetch ảnh + audio của 2 thẻ kế tiếp.
   Khóa input 250ms sau mỗi lần chấm điểm (chống double-tap).

8. Haptics theo mục 9, chỉ khi navigator.vibrate tồn tại, có công tắc tắt.

Nghiệm thu:
- Làm hết 30 thẻ bằng MỘT TAY, không phải với ngón lên nửa trên màn hình
- INP < 200ms khi chấm điểm (đo bằng Performance panel)
- Không thẻ nào gây layout shift khi ảnh tải xong
- Quay video màn hình 30 giây một phiên học, đính vào PR
```

---

## Phase 6 — Dashboard, Chủ đề, Ngữ pháp

```
Thực hiện Phase 6 (mục 15, spec 8.1, 8.3, 8.5, 8.6, 8.7).

1. [H1] Tách / thành hai: khách thấy landing, người đã đăng nhập thấy dashboard.
   Dùng middleware hoặc render có điều kiện. Không tạo route mới nếu tránh được.

2. Dashboard theo wireframe 8.1b. RÀNG BUỘC CỨNG: thẻ "Hôm nay" với nút
   "Ôn ngay" phải nằm trọn trong màn hình đầu tiên trên iPhone SE (375x667),
   0 lần cuộn. Nếu không vừa, cắt phần khác.
   Trạng thái 0 từ đến hạn: đổi sang "Xong hết rồi. Học từ mới?" màu --mastered.

3. Landing rút từ 8 section xuống 5 theo 8.1a. Demo 3 thẻ lên hero, chạm được
   ngay không cần cuộn. [H6] 8 chip chủ đề phải link tới /topics/[slug] thật.

4. /topics theo 8.3:
   - [T6] Thay 28 emoji bằng icon Lucide theo bảng ánh xạ ở mục 11.2
   - [T3] Bỏ preview 4 từ alphabet, thay bằng thanh tiến độ + số từ đến hạn
   - [T5] Sắp xếp mặc định theo độ phù hợp (CEFR người dùng + đang học dở),
     có nút đổi sang A→Z / số từ
   - [T4] Chia 2 nhóm: "Chủ đề đời sống" và "Chuyên ngành & Thi cử"
     (xem đề xuất gộp ở mục 14.2 — hỏi người dùng trước khi gộp dữ liệu thật,
      giai đoạn này chỉ nhóm ở tầng hiển thị)

5. /grammar theo 8.5: thẻ "Tiếp tục" ở đầu, 4 section dạng accordion, mặc định
   mở section đang học dở.
   [G2] Audit lại số bài/câu hỏi. Chủ đề nào có 0 câu hỏi thì ẨN nhãn thay vì
   hiện "0 câu hỏi". Ghi lại các số liệu bất thường vào MIGRATION-NOTES.md.

6. Trang lesson theo 5.3 và 8.6 — đây là phần cần nhiều công nhất của phase này:
   - Component .term cho thuật ngữ tiếng Anh (mono trên nền accent-subtle),
     THAY cho markdown in nghiêng thô
   - ExampleBlock: variant neutral / correct (✓, viền correct) /
     wrong (✗, gạch ngang, mờ 0.7)
   - Callout thay ký tự ► thô, dùng icon lucide:info
   - Số thứ tự trong ô vuông mono (đây ĐÚNG là chuỗi nên được dùng số)
   - [G6] Thanh "Đã hiểu → Bài tiếp" DÍNH ĐÁY, không nằm cuối trang
   - Chiều dài dòng tối đa var(--content-max) trên tablet trở lên

7. /me theo 8.7.

Nghiệm thu: người đã đăng nhập mở app thấy nút "Ôn ngay" ngay, 0 lần cuộn,
trên iPhone SE.
```

---

## Phase 7 — Hoàn thiện

```
Thực hiện Phase 7 (mục 15).

1. /stats theo 8.8: đúng 3 biểu đồ (nhiệt đồ 12 tuần, đường số từ đã thuộc,
   phân bố CEFR) + 1 câu tóm tắt bằng chữ ở đầu.
   KHÔNG dùng Recharts/Chart.js — vẽ SVG thủ công hoặc visx module lẻ.
   Lý do: 3 biểu đồ này quá đơn giản để trả giá 100–200 KB.

2. /leaderboard theo 8.9: người dùng hiện tại sticky trong danh sách;
   nhãn nhỏ "Đối thủ luyện tập" cạnh tên bot (trung thực, đừng giấu);
   top 3 dùng số thứ tự mono lớn, không bục vàng-bạc-đồng.

3. Toàn bộ trạng thái rỗng/lỗi/offline theo bảng 8.10.
   Câu chữ theo nguyên tắc 14.4: nói cái gì hỏng và làm gì tiếp, không xin lỗi,
   không mơ hồ.
   Nâng cấp offline: cache 50 từ kế tiếp (ảnh + audio) để học tiếp được offline,
   đồng bộ khi có mạng.

4. Icon app & splash (11.6):
   npx pwa-asset-generator logo.svg ./public/icons --background "#F4F3EE" --padding "18%"
   Bắt buộc có icon-512-maskable.png với safe zone 40%.
   Logo: chữ A font display trên nền giấy + một dấu chấm Indigo góc dưới phải.

5. OG động cho /word/[slug] bằng next/og: từ + phiên âm + CefrStamp trên nền giấy.

6. Duyệt hết checklist mục 12 (accessibility). Chạy axe DevTools trên 6 trang chính.
   Chú ý riêng: <html lang="vi"> nhưng từ tiếng Anh phải bọc <span lang="en">.

7. Đạt ngân sách mục 13. Nếu chưa đạt:
   - npx @next/bundle-analyzer để tìm thủ phạm
   - next/dynamic cho biểu đồ, chế độ Phát âm, Lottie
   - Kiểm tra có moment/lodash/recharts lọt vào bundle không

8. Sửa lỗi dữ liệu mục 14.3:
   - Viết script phát hiện nghĩa tiếng Việt lỗi (chứa ')' không có '(' mở,
     độ dài < 3 ký tự, kết thúc giữa chừng) → xuất báo cáo CSV
   - Lọc synonym là viết tắt kỹ thuật (vd accessibility → "a11y")
   - Gán lại POS từ WordNet cho các từ sai (about/above/abroad/absolutely
     đang bị gắn "Động từ"), kiểm tra thủ công 200 từ A1–A2 phổ biến nhất
   - Giới hạn hiển thị định nghĩa 25 từ trên thẻ học, đầy đủ ở trang chi tiết

Nghiệm thu: bảng so sánh Lighthouse trước/sau cho 6 trang, checklist mục 12 và 13
tick hết, đính vào MIGRATION-NOTES.md.
```

---

## Prompt kiểm tra chéo (chạy cuối mỗi phase)

```
Review lại toàn bộ thay đổi của phase vừa xong, đối chiếu với:
- Definition of Done (mục 16 trong plan)
- Danh sách "Những điều KHÔNG được làm" (mục 17)

Chạy các lệnh kiểm tra:
  grep -rn "#[0-9a-fA-F]\{6\}" src/components src/app     # phải rỗng
  grep -rn "100vh" src app                                  # phải rỗng
  grep -rn "env(safe-area" src/components                   # phải rỗng
  grep -rn "z-index: [0-9]" src/components                  # phải rỗng
  grep -rn "localStorage" src/components                    # xem lại từng chỗ

Sau đó:
1. Chụp màn hình ở 360 / 390 / 768, light và dark
2. Chạy Lighthouse mobile, so với baseline Phase 0
3. Liệt kê mọi chỗ bạn đã lệch khỏi spec và lý do
4. Liệt kê mọi thứ còn nợ

Nếu có mục nào chưa đạt, sửa trước khi sang phase tiếp theo.
```

---

## Prompt xử lý mâu thuẫn

```
Bạn vừa gặp chỗ spec trong 01-plan.md mâu thuẫn với code thực tế
hoặc không khả thi.

Đừng tự quyết. Làm theo thứ tự:
1. Ghi vào MIGRATION-NOTES.md: spec nói gì, code thực tế thế nào, vì sao xung đột
2. Đề xuất 2 phương án, mỗi phương án nói rõ đánh đổi
3. Nêu phương án bạn nghiêng về và lý do
4. DỪNG LẠI và hỏi người dùng

Tuyệt đối không âm thầm bỏ tính năng đang có để cho khớp spec.
```

---

## Phase 2b — Tích hợp bộ 3D (thay Phase 2b cũ)

```
Thực hiện mục 4 của 01-plan.md — hệ thống hình ảnh.

1. Copy assets/3d/ (1.375 file webp) vào public/3d/.
   Cấu hình Cache-Control: public, max-age=31536000, immutable.

2. Tạo component Art3D theo mẫu ở assets/README-3d.md.
   Các class .art3d, .art3d-stage, .art3d-float, .art3d-enter đã có sẵn
   trong 02-tokens.css mục 7 — dùng lại, đừng viết CSS mới.

3. Tạo WordVisual: chọn giữa Art3D và TypographicCard theo cột image_policy.
   TypographicCard KHÔNG PHẢI trạng thái lỗi — từ đặt rất lớn (--text-hero,
   weight 800) trên nền --bg-tint, phiên âm mono dưới, con dấu CEFR góc trên phải.
   Nếu nó trông như thẻ bị thiếu ảnh thì bạn đã làm sai.

4. Thêm 2 cột vào bảng từ vựng: image_policy ('art3d' | 'typographic')
   và art3d_slug (nullable).

5. Xuất toàn bộ từ vựng ra words.json dạng [{"word":..., "pos":...}],
   chạy:  python3 assets/map-vocab-to-3d.py words.json > vocab-3d-map.json
   Đọc tỉ lệ phủ in ra stderr, ghi vào MIGRATION-NOTES.md.

6. TRƯỚC KHI ghi vào DB: xuất riêng danh sách từ có score = 70 (khớp mờ),
   kiểm tra thủ công 200 từ đầu. Đây là nhóm dễ sai nhất. Báo cáo cho
   người dùng những từ khớp sai rồi mới ghi.

7. Thay 28 emoji chủ đề bằng Art3D, dùng bảng assets/3d-topics.json.

8. Đăng ký vật thể 3D cho 6 trạng thái rỗng/lỗi theo bảng 8.10 của plan.

9. Service worker precache toàn bộ /3d/ (6 MB) để học offline đầy đủ.

Nghiệm thu: /topics không còn emoji nào; thẻ học hiện đúng 2 loại visual;
không thẻ nào layout shift khi ảnh tải (kích thước cố định 192x192);
tắt mạng vẫn học được 30 thẻ có đủ hình.
```
