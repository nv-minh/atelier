# Chọn từ theo trình độ & lĩnh vực — Design

**Ngày:** 2026-08-13
**Trạng thái:** đã được duyệt (brainstorming), **tạm hoãn** — chờ user crawl xong bộ từ vựng đa lĩnh vực rồi mới lập plan thực thi
**Phạm vi:** `fetchNewCards`, model `Word` / `WordMark`, model mới `LearnerProfile`, module mới `src/lib/selection/*` + `src/lib/placement/*`, route mới `/onboarding`
**Nhánh:** chưa tạo

---

## 1. Bối cảnh

User đặt vấn đề: người vào học có trình độ và vốn từ rất khác nhau, và họ chỉ muốn học từ trong lĩnh vực của họ hoặc từ họ chưa biết. Không thể gợi ý người C1 học `hello`.

Đây là **gói A** trong bốn gói được chốt cho lượt việc này:

| Gói | Nội dung | Trạng thái |
|---|---|---|
| **A (spec này)** | Đo trình độ + chọn lĩnh vực + engine chọn từ mới | spec này |
| B | Kho từ vựng đã học (view theo mức thành thạo, tìm/lọc) | chưa brainstorm |
| C | Nhắc học lại (nudge + push notification) | chưa brainstorm |
| D | Bảng xếp hạng có rival tổng hợp | chưa brainstorm |

Bốn gói độc lập, mỗi gói một chu trình spec → plan → thực thi riêng.

### Trạng thái hiện tại — đã kiểm, không phỏng đoán

**Cái đã có, không phải làm lại:**

- **FSRS đã hoàn chỉnh.** `ts-fsrs` qua `src/lib/fsrs.ts`; `Card` lưu `stability`/`difficulty`/`due`/`state`/`lapses`; có `/api/stats/forecast`. Gói C chỉ cần lớp *nhắc*, không cần thuật toán mới.
- **Nền kho từ vựng.** `Card` (state/reps/lapses), `WordMark` (starred + note), `/notebook`, `/browse`, export CSV/Anki.
- **Topic taxonomy.** 25 slug trong `src/lib/topic-taxonomy.ts`, trong đó 4 pack **curated** (`business`, `it-programming`, `toeic`, `conversation`) được gán topic tường minh lúc import; 21 slug còn lại gán bằng keyword matching (`prisma/assign-topics.ts`).
- **Gamification.** XP/level/badge (`gamification-defs.ts`), streak.

**Cái đang sai — gốc của vấn đề:**

`fetchNewCards` (`src/lib/study-engine.ts:187`) lấy từ mới bằng:

```ts
orderBy: [{ cefr: "asc" }, { word: "asc" }]
```

Nghĩa là user C1 không bấm filter sẽ nhận `a`, `abandon`, `ability`… — A1 trước, trong band thì theo alphabet. `buildStudyQueue` và `buildSessionPlan` (kể cả sàn từ mới) đều gọi qua hàm này, nên đây là **điểm nối duy nhất** cần thay.

Cùng chỗ đó còn một vấn đề hiệu năng: hàm load **toàn bộ** `wordId` user đã thấy rồi mới `id: { notIn: seenWordIds }`.

**Dữ liệu hiện có (đã đếm):**

| Nguồn | Số từ | Phân bổ CEFR |
|---|---|---|
| `data/vocabulary.json` (core) | 3.677 | A1 898 / A2 792 / B1 690 / B2 1.297 — **không có C1** |
| `data/packs/business.json` | 1.744 | B2 737 / C1 674 / B1 268 / A2 50 / A1 15 |
| `data/packs/toeic.json` | 1.250 | B2 563 / C1 261 / B1 252 / A2 117 / A1 57 |
| `data/packs/oxford-c1.json` | 1.314 | C1 1.314 |
| `data/packs/conversation.json` | 721 | A1 430 / A2 184 / B1 76 / B2 26 / C1 5 |
| `data/packs/it-programming.json` | 442 | B2 129 / B1 125 / C1 112 / A2 58 / A1 18 |

**Cẩn thận khi đọc bảng trên: đó là số theo file, không phải số trong DB.** Cộng lại là 9.148, nhưng `packs:import` merge theo `word` unique (topics = union) nên DB thực tế là **6.394 từ, C1 là 1.367** — một từ có mặt ở nhiều pack chỉ thành một row. Mọi ngưỡng/quota trong spec này tính theo số DB.

Hệ quả phải thiết kế theo: **C1 chỉ tồn tại trong pack**, và C1 theo lĩnh vực thì rất mỏng (IT 112, TOEIC 261 theo file — sau merge còn ít hơn). Ô `(C1 × lĩnh vực chưa có)` **rỗng ngay hôm nay**, không phải rủi ro tương lai.

**Dữ liệu tần suất — đã có nhưng đang bị bỏ ở cửa import:**

`PackWord` đã có field `rank?: number` (`scripts/packs/lib/formats.ts:12`). Phủ:

| Pack | Nguồn rank | Coverage | Range | Từ có `rank = 1` |
|---|---|---|---|---|
| business | Business Service List 1.2 | 1744/1744 | 1–1744 | `mister` |
| toeic | TOEIC Service List 1.2 | 1250/1250 | 1–1250 | `mister` |
| conversation | NGSL-Spoken 1.2 | 721/721 | 0–721 | `be` |
| oxford-c1 | — | 0/1314 | — | — |
| it-programming | — | 0/442 | — | — |

**Hai kết luận cứng từ bảng này:**

1. `toCreateRow` trong `prisma/import-packs.ts` **không map `rank`** (đã grep, không có match) → rank hiện chỉ nằm trên disk, chưa bao giờ vào DB.
2. Rank là **per-source, không so sánh xuyên nguồn được**. `mister` là rank 1 của BSL/TSL; `be` là rank 1 của NGSL-Spoken. Nếu đổ thẳng vào một cột `freqRank` thì `mister` trở thành từ thông dụng nhất tiếng Anh, và mọi user chọn lĩnh vực business/TOEIC sẽ thấy nó ở đầu danh sách từ mới. Vì vậy spec này dùng **percentile chuẩn hoá**, không dùng rank thô.

**Guest:** repo vừa merge hướng "cho guest vào, hỏi login đúng lúc" — `src/middleware.ts` chỉ bounce `/study`; các route khác tự render `<AuthRequired>`; `src/components/auth-gate.tsx` có `AuthGateProvider` + `GateReason`.

### Quyết định của người dùng (ghi lại để về sau không phải đoán lại)

| Câu hỏi | Chốt |
|---|---|
| Làm gói nào trước | **A** (level + chọn từ) trước B/C/D |
| Đo trình độ thế nào | **Thang yes/no thích ứng** ~30–40 từ, 60–90s, có từ bẫy |
| Từ dưới trình độ user xử lý sao | **Hạ ưu tiên + suy rộng**, KHÔNG loại cứng, KHÔNG mất từ |
| Lĩnh vực ảnh hưởng mức nào | **Trọng số mềm**, giữ quota core để vốn từ không bị hẹp |
| Tần suất lấy từ đâu | **Thêm field vào `Word` + backfill** từ NGSL/BSL/TSL |
| Cập nhật trình độ sau test đầu | **Trôi ngầm theo dữ liệu FSRS** + nút làm lại test trong Settings |
| Onboarding đặt ở đâu | **Guest làm được**, kết quả giữ localStorage, login để lưu |
| `known` sống ở đâu | Trong **`WordMark`**, không tạo bảng riêng |
| Field tần suất | **`freqPct Float?` (percentile)**, không phải `freqRank Int?` |

### Tiêu chí thành công

1. User band C1 không filter gì: trong 20 từ mới đầu tiên, **không có từ A1 nào** ngoài quota probe (tối đa 1).
2. User band A2 vẫn nhận từ A1/A2, không bị đẩy sang C1.
3. User chọn `it-programming`: **≥60%** từ mới thuộc lĩnh vực đã chọn, nhưng **không phải 100%** (quota core còn sống).
4. User chọn một lĩnh vực chưa có từ ở band của họ (VD `C1 × medical`): vẫn nhận **đủ** số từ mới, không phải 0 — đường nới band đã chạy.
5. Filter `cefr`/`topic` user tự bấm trên URL **thắng** profile: bấm `cefr=A1` thì phải ra từ A1, kể cả user C1.
6. Từ bị đánh dấu `known` **không mất vĩnh viễn** — bỏ dấu được, và probe vẫn kéo lên lại được.
7. `vocabSizeEst` của một user **không đổi** khi DB được import thêm từ (đây là bất biến, có test).
8. Thang test kết thúc trong ≤35 item ở mọi đường đi.

### Ngoài phạm vi

- Gói B (view kho từ vựng), C (nhắc học/push), D (bảng xếp hạng).
- Curate thứ tự "lộ trình" cho từng pack (đã loại ở bước brainstorm — chọn trọng số mềm).
- Sửa nội dung 5 pack đang có, thêm entry taxonomy mới, crawl dữ liệu (việc của pipeline `packs:*`, có prompt riêng).
- Slider tỉ lệ lĩnh vực/core trong Settings (YAGNI — trọng số mềm đã đủ, thêm nút là thêm chỗ để sai).
- Rate-limit cho endpoint item bank mở-cho-guest (xem mục 8).

---

## 2. Thay đổi dữ liệu

### 2.1 `Word` — hai field tần suất

```prisma
freqPct    Float?   // percentile 0..1, 1 = thông dụng nhất. Chuẩn hoá, so sánh xuyên nguồn được.
freqSource String?  // "ngsl" | "ngsl-spoken" | "bsl" | "tsl" — biết percentile này từ thang nào

@@index([cefr, freqPct])
```

Dùng percentile chứ không phải rank thô vì rank per-source không so sánh được (mục 1). Công thức: `freqPct = 1 − rank / sourceSize`.

Thứ tự ưu tiên khi một từ có nhiều nguồn:

1. **NGSL general** (`data/raw/NGSL.json`, band 1000/2000/3000, dùng luôn bảng inflection trong file để khớp biến thể) — thang tổng quát, uy tín nhất cho tần suất chung.
2. `rank` sẵn có trong pack JSON (BSL / TSL / NGSL-Spoken), chuyển thành percentile theo `metadata.count` của pack đó.
3. `null` — engine cho điểm trung tính, **không bịa số**.

Percentile-trong-pack và percentile-NGSL không cùng nghĩa, và đó là chấp nhận được: khi từ được chọn qua đường có `topicBoost`, "từ trung tâm của list lĩnh vực này" chính là tín hiệu muốn có. `freqSource` giữ lại để về sau debug được mà không phải đoán.

### 2.2 `WordMark` — thêm `known`

```prisma
known Boolean @default(false)

@@index([userId, known])
```

Không tạo bảng mới: `WordMark` đã đúng là "ý kiến của user về một từ" (`starred` + `note`, unique `[userId, wordId]`).

**Phải sửa kèm:** predicate xoá-khi-không-còn-signal trong `setWordMark` (`src/lib/notebook.ts:44`) hiện xoá row khi `!starred && note === ""`. Thiếu `known` trong điều kiện đó thì mọi dấu "đã biết" đơn thuần sẽ bị xoá ngay sau khi ghi.

### 2.3 `LearnerProfile` — model mới

```prisma
model LearnerProfile {
  id               String    @id @default(cuid())
  userId           String    @unique
  band             Float     @default(2)      // thang liên tục A1=0 → C1=4
  vocabSizeEst     Int       @default(0)
  topics           String    @default("[]")   // JSON array slug, cùng convention Word.topics
  source           String    @default("declared") // "test" | "drift" | "declared"
  estimatorVersion Int       @default(1)
  lastTest         String?                    // JSON items + đáp án lần test gần nhất
  placedAt         DateTime?
  driftedAt        DateTime?                  // chặn drift chạy quá 1 lần/ngày
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Model riêng chứ không nhét vào `Settings`, theo đúng split repo đang có: `Settings` = user tự đặt, `UserProgress`/`LearnerProfile` = hệ thống suy ra và tính lại được.

`band` là **float** để drift trôi được nửa bậc thay vì giật nguyên bậc. `lastTest` giữ để sau này tune lại estimator mà không phải bắt user test lại. `estimatorVersion` để khi đổi hằng số tham chiếu (mục 4.3) thì biết số cũ và số mới là hai thang khác nhau — thiếu nó thì so sánh sẽ âm thầm sai.

`topics` chứa slug; đọc ra phải **bỏ qua slug không còn tồn tại** trong `TOPICS`, vì crawl sẽ thêm/đổi taxonomy.

### 2.4 Migration & backfill

- Repo dùng `db:push` (không có thư mục `migrations`) → `prisma db push`.
- Script mới `prisma/backfill-freq.ts`, thêm `db:backfill-freq` vào `package.json`. **Idempotent**, chạy lại được.
- **Thêm 1 dòng vào `toCreateRow`** (`prisma/import-packs.ts`) map `rank` → `freqPct` + `freqSource`, chuẩn hoá theo `metadata.count` của pack. Thiếu dòng này thì mỗi lô pack import về sau lại phải chạy lại backfill.

> **Thứ tự quan trọng:** mục 2.1 + 2.4 nên land **trước** `packs:import` của lô crawl mới. Nếu import trước, toàn bộ `rank` crawl về bị bỏ ở cửa và phải backfill lại.

---

## 3. Engine chọn từ

Module mới `src/lib/selection/`. Nguyên tắc: **mọi quyết định nằm trong hàm thuần, phần chạm Prisma mỏng** — theo tiền lệ `session-limits.ts` (thuần, có test) / `session-plan.ts` (mỏng).

| File | Loại | Việc |
|---|---|---|
| `constants.ts` | thuần | mọi con số tune được, một chỗ duy nhất |
| `score.ts` | thuần | chấm điểm 1 ứng viên |
| `sample.ts` | thuần | weighted sampling + chia slot, nhận `rng` injectable |
| `widen.ts` | thuần | chính sách nới khi pool rỗng |
| `candidates.ts` | server | query pool, gọi 3 module trên |
| `drift.ts` | thuần | tính delta band (mục 5) |

### 3.1 Hàm điểm

```
score = bandFit × topicBoost × freqScore × knownPenalty
```

| Thành phần | Công thức | Giá trị khởi điểm |
|---|---|---|
| `bandFit` | `exp(−(idx − target)² / (2σ²))`, `target = band + 0.3` | `σ = 0.8` |
| `topicBoost` | khớp topic curated / khớp topic keyword / không khớp | `2.6` / `1.8` / `1.0` |
| | *một từ khớp cả hai loại → lấy **max**, không nhân dồn* | |
| `freqScore` | có `freqPct`: `0.25 + 0.75 × freqPct`; `null`: trung tính | `null → 0.6` |
| `knownPenalty` | `known === true` → hằng số; ngược lại `1.0` | `0.02` |

- `+0.3` skew là chủ ý: nhắm **hơi trên** trình độ hiện tại. Với user C1 (`band = 4.0`, `target = 4.3`), từ A1 (`idx = 0`) ra `bandFit ≈ exp(−18.5/1.28) ≈ 5e-7`. Đây là chỗ `hello` chết.
- `topicBoost` của topic curated cao hơn topic keyword vì 21/25 slug gán tự động nên nhiễu — boost một tín hiệu nhiễu bằng với tín hiệu sạch là đang khuếch đại lỗi gán.
- `knownPenalty = 0.02` **chứ không phải 0**: đúng quyết định "hạ ưu tiên, không loại". Từ 0 là loại, và loại thì không bao giờ dò lại được lỗ hổng.
- `freqScore` không bao giờ về 0 (sàn 0.25) để một từ hiếm nhưng đúng band/đúng lĩnh vực vẫn có cơ hội.

### 3.2 Chọn bằng weighted sampling, không argmax

Argmax thì mọi user cùng band + cùng lĩnh vực nhận **đúng một** danh sách, và thứ tự lại thành tất định — tức là đổi một kiểu tất định (alphabet) sang một kiểu tất định khác. Sampling không hoàn lại, weight = `score`, `rng` truyền vào được nên test vẫn tất định.

### 3.3 Chia slot

Trên ngân sách từ mới `b` (mặc định `newCardsPerDay = 20`):

```
probe = floor(0.05 × b)                  // 0 thì rút thăm Bernoulli(0.05 × b)
core  = round(0.25 × b)
topic = b − probe − core
```

| `b` | probe | core | topic |
|---|---|---|---|
| 20 | 1 | 5 | 14 |
| 10 | 0 hoặc 1 (p = 0.5) | 3 | 6–7 |
| 3 | 0 hoặc 1 (p = 0.15) | 1 | 1–2 |

- **topic**: chấm **có** `topicBoost`.
- **core**: chấm **không** `topicBoost` → quota giữ cho vốn từ không bị hẹp lại quanh một lĩnh vực.
- **probe**: cố tình lấy từ **dưới** band. Đây là cơ chế dò lỗ hổng, và probe bị `Again` là tín hiệu drift mạnh nhất (mục 5). Bernoulli cho `b` nhỏ là để `b = 3` không biến thành 33% probe.

### 3.4 Pool ứng viên

Chấm trong request trên pool có giới hạn, **không** dựng bảng queue tính trước: bảng đó phải invalidate mỗi lần user học / đổi topic / band trôi — đúng loại state dễ lệch — mà repo chưa có hạ tầng job nào. Nếu về sau pool query thành cổ chai thì mới cache.

Ba query slim (chỉ `id`, `cefr`, `freqPct`, `topics`):

| Pool | Filter | Take |
|---|---|---|
| topic | `cefr in` cửa sổ band, `topics` khớp slug đã chọn | 300 |
| core | `cefr in` cửa sổ band | 300 |
| probe | `cefr` **dưới** `band − 1` | 100 |

Chung cho cả ba:

- Loại từ đã có card bằng `where: { cards: { none: { userId } } }` — thay cho việc load toàn bộ `seenWordIds` rồi `notIn` (mục 1). Bỏ được một round-trip và một mảng vài nghìn id.
- `orderBy: { freqPct: { sort: "desc", nulls: "last" } }` — Postgres mặc định để NULL **trước** khi DESC, không chỉ định `nulls: "last"` thì cả pool sẽ toàn từ không có tần suất.
- Dedupe theo `id` sau khi gộp (một từ có thể xuất hiện ở cả topic pool và core pool).

### 3.5 Nới khi pool rỗng — bắt buộc, không phải phòng xa

Ô `(C1 × lĩnh vực chưa crawl)` rỗng **hôm nay**. `widen.ts` là hàm thuần `widenPlan(attempt) → { bandWindow, useTopicBoost, requireBandWindow }`:

| Lần | Hành động |
|---|---|
| 0 | cửa sổ band `[target − 1, target + 1]`, có `topicBoost` |
| 1 | nới cửa sổ `[target − 1.5, target + 1.5]` |
| 2 | **bỏ** `topicBoost` (chấp nhận ra ngoài lĩnh vực) |
| 3 | bỏ cửa sổ band, xếp theo `freqPct` giảm dần |

Nới cho tới khi đủ số slot hoặc hết bậc. Lần 3 luôn ra kết quả nếu DB còn từ user chưa thấy.

**Cửa sổ band → tập CEFR level**: `band` là float nhưng `Word.cefr` là 5 giá trị rời rạc, nên cửa sổ `[lo, hi]` chuyển thành tập level có `idx` thoả `round(lo) ≤ idx ≤ round(hi)`, clamp `[0, 4]`, và **luôn có tối thiểu 1 level** (`round(target)`) kể cả khi cửa sổ suy biến.

### 3.6 Điểm nối vào code cũ

Chỉ **một** hàm: `fetchNewCards` (`src/lib/study-engine.ts:187`). `buildStudyQueue` và `buildSessionPlan` (kể cả sàn từ mới của spec `practice-session-tuning`) gọi qua nó nên không phải sửa.

Hai bất biến **phải giữ**:

1. Filter `cefr`/`topic` user tự bấm trên URL **thắng** profile. Họ muốn học A1 thì cho học A1.
2. Path `scope === "starred"` giữ nguyên hành vi — bao gồm cả cái intersect "starred ∩ chưa thấy" đang có.

**Không có profile** (guest, hoặc user cũ chưa test): fallback = xếp theo `freqPct` giảm dần. Tự nó đã tốt hơn alphabet, nên người skip onboarding không bị bỏ rơi.

---

## 4. Placement test

Module mới `src/lib/placement/`.

### 4.1 Item bank

`GET /api/placement/items` — **mở cho guest** (không thêm vào `middleware` matcher), chỉ trả `id` / `word` / `cefr`, không có dữ liệu user nào.

- Chỉ lấy từ có `definitionEn` (màn kết quả cần hiện được nghĩa).
- **Phân tầng theo tercile `freqPct` trong mỗi band.** Không phân tầng thì một block B2 có thể toàn từ thông dụng, user pass band quá dễ và band bị đo cao lên.

### 4.2 `ladder.ts` — state machine thuần

| | |
|---|---|
| Bắt đầu | B1 (`idx = 2`) — giữa thang, tối thiểu số bước tới bất kỳ biên |
| Block | 5 từ thật cùng band |
| ≥ 4/5 "biết" | lên 1 band |
| ≤ 2/5 | xuống 1 band |
| = 3/5 | biên đã kẹp → dừng |
| Dừng | đã **đảo chiều** (lên rồi xuống, hoặc ngược lại), hoặc 35 item, hoặc ra biên thang (A1 fail / C1 pass) |
| Trap | ~1 mỗi 8 item (~4 trap/lượt), **không tính** vào điểm block |

**Sàn 3 block (15 item thật).** Điều kiện dừng có thể xảy ra ngay block đầu (`= 3/5` ở B1), lúc đó chỉ có dữ liệu của **một** band và mục 4.3 không nội suy được. Nên: khi gặp điều kiện dừng mà chưa có ≥ 2 band có dữ liệu, chạy tiếp block ở band lân cận cho đủ.

### 4.3 `estimate.ts` — thuần

Hiệu chỉnh đoán bừa theo công thức chuẩn của vocabulary testing:

```
corrected_rate = (hit_rate − false_alarm_rate) / (1 − false_alarm_rate)
```

`false_alarm_rate` = tỉ lệ trả lời "biết" trên trap. Trap-yes 100% → estimate về sàn, tự động, không cần luật riêng.

- `band` = nội suy tuyến tính chỗ `corrected_rate` cắt `0.5` giữa hai band kẹp → float liên tục, clamp `[0, 4]`.
- `vocabSizeEst = Σ (corrected_rate[b] × REFERENCE_BAND_SIZE[b])`

```
REFERENCE_BAND_SIZE = { A1: 600, A2: 900, B1: 1500, B2: 2500, C1: 3500 }
```

**Band không được test thì lấy rate ở đâu** (thang adaptive nên luôn có band bị bỏ qua): band **dưới** band thấp nhất đã test → dùng `corrected_rate` của band thấp nhất đó (giả định đơn điệu: biết B2 thì biết A1 không ít hơn). Band **trên** band cao nhất đã test → `0`. Không có luật này thì tổng ở trên không xác định.

**Đây là hằng số ngoài, và hàm này không nhận DB làm input.** Nếu ước lượng tính theo "biết 40% số từ B2 *trong DB*" thì mỗi lần import thêm 2.000 từ B2, con số "vốn từ ~4.200" của mọi user tự đổi dù họ không học gì thêm, và `band` đã lưu cũng đổi nghĩa theo. Đổi bộ hằng số này là đổi thang cho mọi user → phải bump `estimatorVersion`.

### 4.4 `traps.ts`

~24 pseudoword viết tay, đúng hình thái tiếng Anh nhưng không phải từ thật (`flimper`, `reguble`, `cortiate`, `blenture`…).

Kèm test quét `data/vocabulary.json` + 5 pack + `data/raw/NGSL.json` để chắc chắn **không trap nào vô tình là từ thật**. Một trap là từ thật sẽ đẩy `false_alarm_rate` lên sai, kéo `corrected_rate` của mọi user xuống — hỏng toàn bộ hiệu chỉnh mà không có triệu chứng gì nhìn thấy được.

### 4.5 `known` chỉ ghi tín hiệu tường minh

Ghi `WordMark.known = true` cho: đáp án "biết" trong test (**chỉ item thật, không bao giờ trap**), và user tự bấm "Tôi đã biết từ này".

**Suy rộng dưới band không bao giờ ghi vào DB** — nó nằm trong `bandFit`. Nghĩa là band trôi thì suy rộng tự trôi theo, không để lại rác vĩnh viễn trong `WordMark`.

### 4.6 Luồng guest → login

1. `storage.ts` giữ draft trong localStorage key `vm.placement.v1` (theo pattern `src/lib/pwa-prefs.ts`): `{ version, takenAt, items: [{ wordId, known }], traps: [...], topics: [...], estimate }`.
2. Màn kết quả mời login qua `AuthGateProvider.open()` với `GateReason` mới `"placement"` + copy i18n tương ứng.
3. Sau login: một lần `POST /api/placement/result` → upsert `LearnerProfile` + seed `known` → xoá draft.
4. **Idempotent**: upsert theo `userId`; draft có `takenAt` **cũ hơn** `placedAt` đang có thì bỏ qua (chống apply lại khi mở 2 tab).

### 4.7 Route API

| Route | Auth | Việc |
|---|---|---|
| `GET /api/placement/items` | **mở** | item bank + trap, chỉ field công khai |
| `POST /api/placement/result` | có | apply draft hoặc kết quả test lại |
| `PATCH /api/profile` | có | đổi `topics` |

---

## 5. Drift — cập nhật band ngầm

`src/lib/selection/drift.ts`, thuần.

- **Input**: 100 review gần nhất gom theo band (join `Card` → `Word.cefr`), profile, ngày hôm nay.
- **Cổng dữ liệu**: < 30 review trong cửa sổ → delta `0`. Thiếu cổng này thì 3 review đầu tiên làm giật band.
- **Luật**: `Again` > 35% ở band quanh `target` → delta âm; `Easy` ≥ 45% và lapse thấp → delta dương.
- **Probe weight cao hơn**: review của card dưới band mà bị `Again` là tín hiệu mạnh nhất ("suy rộng đã biết là sai"). Probe **suy ra** từ `cefrIndex < band − 1`, không cần cột mới.
- **Clamp ±0.25 mỗi lần, tối đa 1 lần/ngày** (`driftedAt`).
- **Gọi từ `endSession`** — đã là write path, đã có pattern best-effort `try/catch` như `awardForSessionEnd`. Không cần cron. Drift fail **không được** làm chết session.
- Sau khi trôi: `source = "drift"`, `placedAt` giữ nguyên.

---

## 6. UI

| Chỗ | Nội dung |
|---|---|
| `/onboarding` | Guest vào được. intro ngắn → test 1 từ/màn, 2 nút Biết/Không biết, phím `1`/`2` → kết quả → chọn lĩnh vực → CTA. Progress **không** hiện "còn bao nhiêu câu" (adaptive nên không biết trước) |
| Màn kết quả | band + `vocabSizeEst` + vài từ mẫu "đã biết"/"sắp học". Trap-yes cao → một dòng nhẹ "mình đã hạ ước lượng một chút", không buộc tội |
| Settings | Section mới "Trình độ & lĩnh vực": band dạng `B2+`, vocab est, nút **Làm lại test**, multi-select lĩnh vực |
| Home | Một dòng "Đang học quanh **B2** · IT & Business", link Settings — thứ chống cảm giác "app phát từ ngẫu nhiên" |
| Word detail + trong phiên học | Nút "Tôi đã biết từ này" → `setWordMark` qua `/api/notebook` đã có; trong phiên thì bỏ luôn card khỏi queue hiện tại |
| Notebook | Filter "Đã biết" để xem lại và **bỏ** dấu. `known` bắt buộc reversible — bấm nhầm mà không undo được thì mất từ đó vĩnh viễn |
| i18n | Cả `vi` và `en` trong `src/lib/i18n/dictionaries.ts` |

---

## 7. Test & nghiệm

Vitest thuần, theo pattern `grading.test.ts` / `session-limits.test.ts`. Repo chưa có infra mock Prisma → giữ phần chạm Prisma mỏng để không cần.

| File | Khẳng định chính |
|---|---|
| `score.test.ts` | user C1 → từ A1 điểm ≈ 0; `known` → ×0.02 **chứ không** 0; curated boost > keyword boost; `freqPct` null trung tính |
| `sample.test.ts` | `rng` seeded → tất định; không trùng; `b = 20` → 14/5/1; `b = 3` → probe theo Bernoulli, không thành 33% |
| `widen.test.ts` | đường nới band → bỏ `topicBoost` → `freqPct`; test bằng ô `(C1 × medical)` rỗng |
| `ladder.test.ts` | đường lên / xuống / kẹp biên; dừng đúng ở A1-fail và C1-pass; trap không tính điểm block; ≤ 35 item |
| `traps.test.ts` | không trap nào là từ thật (quét vocab + 5 pack + NGSL) |
| `estimate.test.ts` | hiệu chỉnh hit − false-alarm; trap-yes 100% → sàn; band nội suy liên tục; **`vocabSizeEst` không nhận DB làm input** (tiêu chí 7) |
| `drift.test.ts` | < 30 review → 0; clamp ±0.25; 1 lần/ngày; probe-`Again` weight cao hơn |

Nghiệm bằng tay: 5 tiêu chí đầu ở mục 1 cần chạy thật với một user band C1 và một user band A2.

---

## 8. Chia plan triển khai

| Plan | Nội dung | Ghi chú |
|---|---|---|
| **A1** | `freqPct`/`freqSource` + `known` + `LearnerProfile` + `backfill-freq.ts` + 1 dòng `toCreateRow` | **Nên land trước `packs:import` của lô crawl mới** |
| **A2** | `src/lib/selection/*` + nối vào `fetchNewCards` + test | Phần lõi; xong A2 là tiêu chí 1–5 nghiệm được |
| **A3** | `src/lib/placement/*` + 3 route API + `/onboarding` | Phụ thuộc A1 |
| **A4** | `known` UI + Settings + dòng ở Home + drift + i18n | Phụ thuộc A2, A3 |

A1 độc lập hoàn toàn với engine, nên làm được ngay trong lúc crawl vẫn đang chạy.

**Rollout**: `prisma db push` → `npm run db:backfill-freq`. User cũ không có `LearnerProfile` → fallback `freqPct`, kèm nudge ở Home mời làm test 90 giây, **không chặn**.

---

## 9. Giả định do tác giả spec quyết, không do người dùng chọn

1. **Mọi con số tune được nằm trong `selection/constants.ts`** — `σ = 0.8`, skew `+0.3`, boost `2.6`/`1.8`, `knownPenalty = 0.02`, tỉ lệ slot, ngưỡng drift. Chúng là giá trị **khởi điểm**, không phải kết quả đo. Đặt một chỗ để tune sau mà không phải đi tìm.
2. **`REFERENCE_BAND_SIZE` là ước lượng bậc độ lớn**, không phải số liệu công bố. Đủ để hiện "~4.200 từ" cho user thấy tiến bộ, không đủ để so với nghiên cứu học thuật. Đổi thì bump `estimatorVersion`.
3. **Danh sách trap do người viết tay**, không sinh bằng thuật toán — 24 từ thì viết tay rẻ hơn dựng generator, và test đã chặn cái rủi ro duy nhất (trap là từ thật).
4. **`GET /api/placement/items` mở cho guest, không rate-limit.** Nó chỉ trả dữ liệu tham khảo công khai (`id`/`word`/`cefr`) nên rủi ro là chi phí query, không phải rò dữ liệu. Nếu bị abuse thì mới thêm — không phải việc của v1.
5. **Probe nhận diện bằng suy luận** (`cefrIndex < band − 1`) chứ không đánh dấu lúc phát card. Đổi lại: nếu band trôi giữa lúc học, một card phát ra như probe có thể không còn tính là probe lúc review. Sai lệch nhỏ, và tránh được một cột mới trên `Card`.
6. **Ngưỡng leech hiện tại (`LEECH_THRESHOLD = 4`) không đổi.** Leech và `known` là hai khái niệm khác nhau (quên nhiều vs. đã biết) và spec này không trộn chúng.
