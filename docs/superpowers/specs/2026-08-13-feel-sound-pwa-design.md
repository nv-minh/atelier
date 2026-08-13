# Âm thanh, độ mượt mobile & lời mời cài PWA — Design

**Ngày:** 2026-08-13
**Trạng thái:** đã được duyệt (brainstorming), chờ lập kế hoạch thực thi
**Phạm vi:** phản hồi âm thanh/rung, tinh chỉnh mobile, `prefers-reduced-motion`, banner cài PWA
**Nhánh:** `feel-sound-pwa`, tách từ `main` tại `e35ebb2`

---

## 1. Bối cảnh

Đây là **gói B** trong ba gói của lượt việc này. Gói A (sàn từ mới + `REVEAL_MS` theo mode) đã merge vào `main`. Gói C (Google OAuth) làm sau.

Gói A sửa *hành vi*. Gói B sửa *cảm giác*: app hiện im lặng hoàn toàn, không tôn trọng `prefers-reduced-motion` ở bất kỳ đâu, có vài chỗ gợn trên mobile, và tuy đã là PWA cài được nhưng chưa bao giờ mời người dùng cài.

### Trạng thái hiện tại — đã kiểm, không phỏng đoán

| Sự việc | Bằng chứng |
|---|---|
| Không có bất kỳ âm thanh UI nào | `grep -rn 'new Audio\|AudioContext' src` chỉ ra `src/lib/tts.ts:102` (phát âm từ vựng) |
| Không có haptic | `grep -rn 'vibrate' src` → rỗng |
| Không xử lý `prefers-reduced-motion` ở đâu cả | `grep -rn 'prefers-reduced-motion' src` → rỗng, trong khi **17 file** import `motion/react` |
| Chưa reset tap-highlight | `globals.css` không có `-webkit-tap-highlight-color` |
| Chưa có `touch-action` | `globals.css` không có |
| `body { min-height: 100vh }` | `globals.css:43` |
| Lớp grain phủ toàn viewport | `globals.css:48-57`: `position: fixed` + `mix-blend-mode: multiply` |
| Chưa bắt `beforeinstallprompt` | `grep -rn 'beforeinstallprompt' src public` → rỗng |
| Đã là PWA hợp lệ | `src/app/manifest.ts` + `public/sw.js` + `SwRegister` |
| Theme/lang lưu bằng localStorage | `src/app/layout.tsx:58` (script chống FOUC) |

### Quyết định của người dùng (ghi lại để về sau không phải đoán lại)

| Câu hỏi | Chốt |
|---|---|
| Cách tạo âm | **Tổng hợp bằng WebAudio** — không file, không tải mạng, độ trễ ~0 |
| Âm thanh mặc định | **Bật**, có toggle tắt trong Settings |
| Phạm vi UI/UX | **Cả bốn**: tap polish mobile · `prefers-reduced-motion` · hiệu năng paint/scroll · haptic |
| Thời điểm mời cài PWA | **Sau khi user đã dùng thật** (hoàn thành ≥1 phiên), từ chối thì nhớ |
| Âm click chung | **Có** — nút/link thường cũng kêu nhẹ |
| Số plan triển khai | **Hai**: B1 = phần 2+3 (âm thanh/rung + mobile), B2 = phần 4 (PWA) |

### Tiêu chí thành công

1. Trả lời đúng/sai trong **cả 4 mode** đều có âm + rung, mà chỉ nối vào **một** chỗ trong code.
2. Người bật `prefers-reduced-motion` ở OS không thấy chuyển động nào chạy, **không** phải sửa 17 file để đạt được điều đó.
3. Chạm nút trên mobile không hiện ô xám nhấp nháy, không có delay tap.
4. User hoàn thành 1 phiên rồi mới thấy lời mời cài; từ chối một lần thì 30 ngày không hỏi lại; đang chạy ở chế độ đã cài thì không bao giờ thấy.
5. Không thêm dependency nào. Không đổi schema DB.

### Ngoài phạm vi

Combo bar, XP bay lên, hoạt cảnh tổng kết phiên (spec practice-modes §10 → Plan 4). Google OAuth (gói C). Không đụng `newCardsPerDay`/`reviewsPerDay`. Không đổi palette, typography, hay chất giấy của Atelier.

---

## 2. Âm thanh & rung

### 2.1 Ba module tách bạch

| File | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `src/lib/sound.ts` | Engine WebAudio: tạo `AudioContext` lazy, tổng hợp và phát 6 âm | không import React |
| `src/lib/haptics.ts` | `vibrate(pattern)` có feature-detect | không import React |
| `src/lib/feedback-prefs.ts` | Đọc/ghi 2 cờ localStorage: `atelier.sound`, `atelier.haptic` | không import React |

Ba module đều thuần và không biết gì về React, nên test được và không kéo theo re-render. Component chỉ gọi `playSound("correct")` — không cần provider, không cần context.

### 2.2 `AudioContext` phải tạo lazy

iOS Safari (và Chrome autoplay policy) chỉ cho `AudioContext` chạy nếu nó được tạo/resume **bên trong** một cử chỉ người dùng. Tạo sẵn lúc load trang sẽ cho ra context ở trạng thái `suspended` và mọi âm sau đó im lặng.

Vì vậy `sound.ts` giữ context ở biến module, khởi tạo ở **lần gọi `playSound` đầu tiên** (luôn nằm trong một event chạm/bấm), và gọi `ctx.resume()` nếu state là `suspended`. Không tạo gì ở top level của module.

### 2.3 Bảng âm

Tổng hợp bằng oscillator + gain envelope. Tông mềm, ngắn, gain thấp — hợp chất giấy của Atelier và không đè lên TTS phát âm.

| Âm | Khi nào | Tổng hợp |
|---|---|---|
| `tap` | chạm nút/link bất kỳ | sine 880Hz, 40ms, gain đỉnh 0.05 |
| `correct` | trả lời đúng | hai nốt 660→880Hz, tổng 120ms, triangle |
| `wrong` | trả lời sai | 220Hz tắt nhanh, 150ms, sine — **không** phải buzzer gắt |
| `flip` | lật thẻ flashcard | nhiễu qua bộ lọc, 60ms — tiếng "giấy" |
| `complete` | xong phiên | arpeggio 3 nốt đi lên, ~350ms |
| `achievement` | mở khóa huy hiệu | 4 nốt ấm, ~450ms |

### 2.4 Chỗ nối vào — ít chỗ là cố ý

- **`PracticeShell.onAnswer`** → `correct`/`wrong` + haptic tương ứng. **Một chỗ này phủ cả 4 mode**, vì cả 4 đều báo kết quả qua `onAnswer` (hợp đồng shell↔mode của spec practice-modes §4). Đây là lợi tức trực tiếp của việc đã gom về shell ở Plan 1.
- **Effect hoàn thành phiên** trong `PracticeShell` → `complete`.
- **`useAchievementToasts.push`** → `achievement`.
- **`FlashcardMode`** chỗ lật thẻ → `flip`.

### 2.5 Âm click chung: một listener ủy nhiệm, không sửa hàng chục component

Thay vì thêm `onClick` vào từng nút, đăng ký **một** listener `pointerdown` ở root (trong `Providers`), khớp `el.closest('button, a, [role="button"]')` → phát `tap`.

Opt-out bằng thuộc tính `data-nosound` trên những control **đã có âm riêng**, để không kêu chồng hai tiếng:
- `RatingButtons` (đã phát `correct`/`wrong` qua `onAnswer`)
- Đáp án quiz (như trên)
- `AudioButton` / nút phát âm, nút replay của dictation (đang phát TTS — thêm tiếng `tap` sẽ đè lên)

Đặt listener ở giai đoạn capture với `{ passive: true }` để không cản cuộn.

### 2.6 Settings

Thêm một `<section>` "Âm thanh & rung" theo đúng khuôn `card-atelier` của các mục sẵn có, với **hai** toggle riêng — có người muốn rung mà không muốn tiếng, và trên iOS thì rung vô nghĩa nên gộp chung một cờ là sai.

Bật toggle âm thanh thì phát luôn `correct` một lần làm preview (phản hồi tức thì cho chính hành động vừa bấm).

Lưu bằng **localStorage**, không đụng model `Settings` trong Prisma — cùng lý do và cùng pattern với theme/lang: đây là sở thích theo thiết bị, không phải theo tài khoản.

### 2.7 Hạn chế phải nói rõ

- **`navigator.vibrate` không có trên iOS Safari.** Không vá được từ web app. Code phải feature-detect và no-op, không giả vờ thành công. (Spec practice-modes §10 đã ghi điều này.)
- **Công tắc im lặng của iPhone:** WebAudio vẫn có thể phát tiếng dù máy đang ở chế độ im lặng, tuỳ phiên bản iOS. Không có API web nào đọc được trạng thái công tắc đó. Đây là lý do nữa để toggle tắt âm phải dễ tìm.

---

## 3. Độ mượt trên mobile

### 3.1 `prefers-reduced-motion`: hai chỗ sửa, không phải mười bảy

**Đã kiểm chứng:** `motion` v11.18.2 có `node_modules/motion/dist/react.d.ts` chỉ chứa `export * from 'framer-motion'`, và `framer-motion/dist/index.d.ts:1209,1235` khai báo `ReducedMotionConfig = "always" | "never" | "user"` cùng prop `reducedMotion`. Nên **`MotionConfig` dùng được ngay từ `motion/react`** mà không thêm dependency.

```tsx
// src/components/providers.tsx
<MotionConfig reducedMotion="user">{children}</MotionConfig>
```

Một dòng này làm **mọi** component `motion/react` trong 17 file tôn trọng thiết lập của OS, vì Motion đọc config qua context ở tầng `VisualElement`.

```css
/* src/app/globals.css — phủ nốt transition CSS thuần mà MotionConfig không với tới */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Đây là sửa spec practice-modes §10.** Spec đó yêu cầu "một hook `useMotionPrefs()` duy nhất bọc `useReducedMotion`, áp cho từng component". Ý định của điều luật ấy là *đừng rải `if (reducedMotion)` khắp component* — `MotionConfig` đạt đúng ý định đó tốt hơn hẳn: 2 chỗ sửa thay vì 17, và component mới viết sau này tự động được phủ mà không ai phải nhớ gọi hook. Hook chỉ thêm về sau nếu xuất hiện một component thật sự cần rẽ nhánh **logic** (không phải chỉ đổi thời lượng animation).

### 3.2 Tinh chỉnh chạm trên mobile

Bốn sửa nhỏ, đều trong `globals.css`:

| Sửa | Lý do |
|---|---|
| `-webkit-tap-highlight-color: transparent` trên `html` | Bỏ ô xám/xanh nhấp nháy khi chạm mọi Link/button |
| `touch-action: manipulation` trên `button, a, [role="button"]` | Bỏ delay ~300ms và double-tap-zoom trên control |
| `body { min-height: 100dvh }` (thay `100vh`) | `100vh` trên mobile Safari tính cả thanh địa chỉ → layout nhảy khi thanh ẩn/hiện |
| `padding-top: env(safe-area-inset-top)` cho header | Bottom nav đã có `env(safe-area-inset-bottom)` (`nav.tsx:91`); header thì chưa |

`100dvh` được hỗ trợ từ Safari 15.4 / Chrome 108 — an toàn ở 2026. Vẫn giữ `100vh` làm dòng fallback ngay trước nó cho trình duyệt cổ.

### 3.3 Hiệu năng: đo trước, sửa sau

Lớp grain (`globals.css:48-57`) là `position: fixed`, phủ toàn viewport, có `mix-blend-mode: multiply` (dark mode: `screen`). Một lớp blend toàn màn buộc trình duyệt hợp thành lại vùng lớn mỗi khung hình khi cuộn — đây là **nghi phạm**, chưa phải kết luận.

**Quy trình bắt buộc:** profile scroll trên `/browse` (trang dài nhất) bằng browser automation, có grain và không grain, ghi lại số liệu. **Chỉ sửa nếu đo ra chênh lệch thật.** Grain là chất nhận diện của Atelier — không đánh đổi nó cho một cải thiện tưởng tượng.

Nếu đo ra vấn đề thật, xếp hạng phương án theo mức độ giữ được thẩm mỹ: (1) bỏ `mix-blend-mode` chỉ trên mobile, giữ opacity; (2) hạ `--grain-opacity` trên mobile; (3) tắt hẳn grain dưới một ngưỡng bề rộng. Quyết định sau khi có số, ghi số vào plan.

---

## 4. Lời mời cài PWA

### 4.1 Một component

`src/components/pwa-install.tsx`, render trong `layout.tsx` cạnh `SwRegister`.

### 4.2 Luật hiển thị

Banner chỉ hiện khi **tất cả** đúng:

1. Không đang chạy standalone — `matchMedia('(display-mode: standalone)').matches === false` **và** `navigator.standalone !== true` (cờ riêng của iOS).
2. Người dùng đã **hoàn thành ≥1 phiên học**. Đếm trong localStorage (`atelier.sessionsDone`), tăng đúng một chỗ: nơi `PracticeShell` chuyển sang trạng thái `done`.
3. Chưa từng bị từ chối trong **30 ngày** gần đây (`atelier.installDismissedAt`).
4. Đã bắt được sự kiện `beforeinstallprompt` (Android/Chrome), **hoặc** phát hiện là iOS Safari (nhánh hướng dẫn thủ công).

Nghe `appinstalled` → dọn state và không bao giờ hiện lại.

### 4.3 Hai nhánh, vì iOS không có `beforeinstallprompt`

- **Android / Chrome desktop:** bắt `beforeinstallprompt`, gọi `preventDefault()`, giữ event lại. Nút "Cài đặt" gọi `event.prompt()`. Sự kiện chỉ dùng được **một lần** — dùng xong phải bỏ tham chiếu.
- **iOS Safari:** không có sự kiện nào để bắt. Hiện sheet hướng dẫn: "Bấm ⎋ Chia sẻ → Thêm vào MH chính", kèm icon minh hoạ. Không có nút cài tự động — không có API nào cho phép.

### 4.4 Hình thức

Banner nổi phía trên thanh nav dưới (`bottom-20 md:bottom-6`), dùng `card-atelier` sẵn có, **không** phải modal che màn — người đang học không bị chặn. Hai nút: "Cài đặt" và "Để sau". Chuỗi chữ vào `dictionaries.ts` cả `vi` lẫn `en` theo đúng pattern i18n hiện có.

---

## 5. Chia plan triển khai

| Plan | Nội dung | Vì sao tách |
|---|---|---|
| **B1** | Mục 2 (âm thanh & rung) + mục 3 (mượt mobile) | Cùng chạm vào `providers.tsx`/`globals.css`, cùng là "cảm giác dùng". Có phần đo hiệu năng cần chạy thật. |
| **B2** | Mục 4 (PWA install) | Độc lập hoàn toàn, một component + i18n. Nghiệm cần thiết bị/trình duyệt thật, khác hẳn cách nghiệm của B1. |

B1 làm trước. B2 dựa vào cùng nhánh nhưng không phụ thuộc code của B1.

---

## 6. Test & nghiệm

Codebase này cố ý không có test component (spec practice-modes §12). Ba module thuần ở mục 2.1 thì **có** test được, và nên có:

| Đối tượng | Cách kiểm |
|---|---|
| `feedback-prefs.ts` | Vitest: mặc định là bật khi localStorage rỗng; ghi rồi đọc lại ra đúng; giá trị rác trong localStorage không làm vỡ (về mặc định) |
| `haptics.ts` | Vitest: không có `navigator.vibrate` → no-op không ném lỗi; có thì gọi đúng pattern |
| `sound.ts` | Vitest: `playSound` khi cờ tắt thì **không** tạo `AudioContext`; context tạo lazy đúng một lần. (Không test chất âm — không kiểm được tự động.) |
| Nối vào 4 mode | Chạy thật: mỗi mode trả lời đúng và sai, nghe âm + cảm rung (Android) |
| `prefers-reduced-motion` | Bật Reduce Motion ở OS → mở phiên học, xác nhận không còn chuyển động |
| Tap polish | Chạy thật trên điện thoại: chạm nút không thấy ô xám, không có delay |
| Hiệu năng grain | Profile scroll `/browse` có/không grain, ghi số vào plan |
| PWA | Chrome Android: hoàn thành 1 phiên → banner hiện; từ chối → không hiện lại; cài xong → không hiện. iOS Safari: thấy sheet hướng dẫn. Đang standalone: không bao giờ thấy |

---

## 7. Giả định do tác giả spec quyết, không do người dùng chọn

1. **Khoá localStorage có tiền tố `atelier.`** (`atelier.sound`, `atelier.haptic`, `atelier.sessionsDone`, `atelier.installDismissedAt`) để không đụng khoá `theme`/`lang` đang dùng trần.
2. **Ngưỡng 30 ngày** cho việc nhớ từ chối cài PWA — con số quy ước, không phải kết quả đo.
3. **Mặc định khi localStorage rỗng là BẬT** cho cả âm thanh lẫn haptic, khớp với quyết định "mặc định bật".
4. **Listener `tap` đặt ở `Providers`**, không phải `layout.tsx`, vì `Providers` đã là client component còn `layout.tsx` là server component.
5. **Không thêm hook `useMotionPrefs()`** ở gói này, vì `MotionConfig` đã phủ. Nếu Plan 4 (combo/XP bay) cần rẽ nhánh logic thì lúc đó mới thêm.
