# Plan A1 + lô crawl 2026-08-13 — thực thi

**Ngày:** 2026-08-13
**Spec gốc:** [`../specs/2026-08-13-level-aware-word-selection-design.md`](../specs/2026-08-13-level-aware-word-selection-design.md) — mục 2 (thay đổi dữ liệu) và mục 8 (plan A1)
**Nhánh:** `docs/level-aware-word-selection`
**Phạm vi:** plan **A1** của spec + nhập lô từ vựng đa lĩnh vực mới crawl. A2/A3/A4 (engine chọn từ, placement test, UI) **không** nằm trong lượt này.

---

## 1. Vì sao hai việc này đi cùng nhau

Spec mục 2.4 ghi một ràng buộc thứ tự: A1 phải land **trước** `packs:import` của lô crawl mới, vì `toCreateRow` không map `rank` nên mọi dữ liệu tần suất crawl về sẽ bị bỏ ở cửa import và phải backfill lại.

Lô này hoá ra **không có `rank`** (mục 4 dưới đây), nên ràng buộc đó không bị vi phạm dù có làm ngược. Nhưng nó vẫn đúng cho lô sau, và đường map giờ đã có sẵn.

---

## 2. Đã làm — thay đổi dữ liệu (spec mục 2)

| Việc | Chỗ |
|---|---|
| `Word.freqPct Float?` + `Word.freqSource String?` + `@@index([cefr, freqPct])` | `prisma/schema.prisma` |
| `WordMark.known Boolean @default(false)` + `@@index([userId, known])` | `prisma/schema.prisma` |
| `model LearnerProfile` + quan hệ `User.learnerProfile` | `prisma/schema.prisma` |
| `rank` → `freqPct`/`freqSource` lúc import (cả đường create và đường update fill-if-empty) | `prisma/import-packs.ts` |
| Công thức percentile, thuần + có test | `src/lib/freq.ts`, `src/lib/freq.test.ts` |
| `prisma/backfill-freq.ts` + `npm run db:backfill-freq`, idempotent, có `--dry-run`/`--force` | mới |
| Sửa predicate xoá trong `setWordMark` để `known` không bị xoá ngay sau khi ghi | `src/lib/notebook.ts` |
| `known` đi qua được API notebook (reversible: gửi `false` là bỏ dấu) | `src/app/api/notebook/route.ts` |

`prisma db push` đã chạy trên DB live (backup trước đó: `data/backups/2026-08-13T08-50-16`).

### Hai điều phát sinh ngoài spec

**`prisma/load-env.ts` (mới).** Không script `tsx` nào trong repo đọc được `.env`: `prisma` CLI tự load, nhưng `tsx prisma/*.ts` thì không và repo không có `dotenv`. Nghĩa là mọi `npm run db:*` / `packs:*` chỉ chạy được nếu người gọi tình cờ đã export `DATABASE_URL` trong shell. Thêm một file 30 dòng, không thêm dependency, import ở đầu `import-packs` / `assign-topics` / `translate-vi` / `backup-db` / `verify`. Env có sẵn vẫn thắng file.

**`src/lib/freq.ts` tách riêng.** Ban đầu công thức percentile nằm trong `import-packs.ts`, nhưng `backfill-freq.ts` cần đúng công thức đó — hai bản sao là hai chỗ để lệch thang. Giờ là module thuần, theo đúng nguyên tắc mục 3 của spec (quyết định nằm trong hàm thuần, phần chạm Prisma mỏng).

---

## 3. Lô crawl — hình dạng dữ liệu

Đầu vào: `files/vocab-all-packs.json` + `files/taxonomy-proposal.json` (đã copy vào `data/raw/incoming/`, gitignored). 9 pack, 2.996 từ, nguồn WordNet 3.0 + wordfreq.

Schema **gần** `PackFile` nhưng không trùng, nên có `scripts/packs/build-crawl-batch.ts` (`npm run packs:build-crawl`) để chuyển:

| Lệch | Xử lý |
|---|---|
| metadata có `part`/`word_count`/`cefr_distribution`/`sources`/`notes`, thiếu `topic_slugs`/`source`/`license`/`count` | dựng lại metadata theo `PackFile` |
| `freq_rank` thay cho `rank` | map sang `rank` (lô này toàn null nên bị bỏ) |
| `source_ref` — field mới | thêm `source_ref?: string \| null` vào `PackWord` |
| `cefr_source: "inferred"` — không có trong union | thêm `"inferred"` vào union |
| `PACK_NAMES` là union đóng | thêm 9 tên mới |

Trùng lặp: **0** trùng trong lô, **0** từ cần normalize. 1.311/2.996 từ đã có trong DB → đi đường merge (topics hợp, `cefr` không bao giờ bị ghi đè, field khác chỉ fill khi rỗng).

---

## 4. `freq_rank` null 100% — hệ quả

Cả 2.996 từ đều `freq_rank: null`, dù `notes` của pack nói việc chọn từ dựa trên dải rank. Rank không được ghi lại per-word.

Nên: **1.685 từ mới sẽ có `freqPct = null`**, và engine cho điểm trung tính (đúng tầng 3 của spec mục 2.1 — không bịa số).

`db:backfill-freq` cũng không cứu được nhiều: nó chỉ với tới từ nằm trong NGSL-Spoken / BSL / TSL, mà **`packs:fetch` không tải NGSL bản tổng quát** — spec mục 2.1 giả định có `data/raw/NGSL.json`, thực tế nguồn đó chưa bao giờ nằm trong pipeline. Script đã để sẵn tầng ưu tiên cao nhất: đặt file vào `data/raw/NGSL_12_stats.csv` là nó tự dùng.

**Việc còn treo:** muốn phủ tần suất rộng thì cần một trong hai — thêm URL NGSL tổng quát vào `fetch-sources.ts`, hoặc cho lô crawl sau xuất luôn Zipf từ `wordfreq` (nguồn nó đã dùng) thành `freq_rank`.

---

## 5. Taxonomy — bốn quyết định

`taxonomy-proposal.json` có 7 entry nhưng lô có 9 pack, và 1 entry đụng slug đang tồn tại.

| Vấn đề | Chốt | Vì sao |
|---|---|---|
| `travel` đã có sẵn (965 từ, keyword-based) mà proposal định nghĩa lại | Gộp vào entry cũ, thêm keyword của proposal, bật `curated: true` | Không tạo slug trùng, không vỡ 965 từ đang có |
| `daily-communication` (1.651 từ) không có entry | `topic_slugs: []`, để `db:topics` gán topic keyword | Nó **không phải lĩnh vực** — là dải tần suất chung (rank ~2.5k–25k: `abroad`, `achieve`, `acid`, `affair`). Đúng tiền lệ `oxford-c1` |
| `logistics` (15 từ) không có entry | Gộp vào topic `business` đã có | 15 từ quá mỏng để làm một chip riêng — bấm vào là hết từ |
| 4 entry của proposal đặt `curated: false` | Đổi hết thành `curated: true` | `assign-topics.ts` chỉ giữ slug `curated` khi chạy lại; để `false` thì mọi tag pack bị `db:topics` xoá sạch |

### Đã bỏ keyword của 6 topic lĩnh vực — có đo trước khi bỏ

Proposal cấp keyword cho medical/legal/finance/daily-life/social/office-skills. Đã chạy thử matcher trên 6.394 từ đang có trong DB: mỗi topic kéo thêm 18–79 từ, nhưng kèm loại nhiễu tệ hơn cả pool mỏng — `cat`/`act` vào legal, `html`/`auditorium` vào finance (stem `audit` khớp tiền tố), `television` vào medical.

Chốt: 6 topic này `keywords: []`, chỉ nhận tag tường minh lúc import — giống 4 curated pack đang có. Pool mỏng đã có đường nới của spec mục 3.5 lo. Giữ keyword rỗng cũng bảo toàn phân biệt boost ở mục 3.1: slug curated nghĩa là "được gán có chủ ý".

`travel` là **ngoại lệ duy nhất**: vừa curated vừa có keyword. Nên với riêng slug này, `travel` trên một từ *không* chứng minh từ đó được gán có chủ ý — A2 cần biết điều đó nếu dựa vào `Topic.curated` để chấm boost.

Cũng bỏ 3 keyword `corner`/`straight`/`opposite` proposal đề xuất cho travel (và không thêm lại `map`/`direction`/`distance`): chúng khớp bất kỳ định nghĩa nào có chứa từ đó.

---

## 6. Lọc trùng & chất lượng — 66 bỏ, 3 đổi tên

Toàn bộ ghi trong `data/crawl-batches/2026-08-13-dropped.json` kèm lý do từng từ.

### 3 từ đổi tên, không bỏ

`Word.word` là unique, nhưng ba từ này normalize khác row đã có trong DB nên sẽ tạo **row thứ hai cho cùng một từ** — unique index không chặn được:

| Lô | Đã có trong DB |
|---|---|
| `road map` | `roadmap` |
| `filmmaker` | `film-maker` |
| `makeup` | `make-up` |

Đổi sang chính tả của DB → đi đường merge, góp topic vào row cũ.

### 66 từ bỏ

| Số | Loại |
|---|---|
| 31 | Động/thực vật học từ cây hyponym WordNet trong pack medical (`book lung`, `dorsal fin`, `hoof`, `talon`, `haw` = "màng nháy của ngựa") |
| 21 | Trùng nghĩa-bên-lề của từ DB đã có: `boards` = "sân khấu nhà hát", `roads` = "vũng đậu tàu", `hooks` = "tay của võ sĩ", `eggs` = đúng nghĩa số nhiều của `egg` |
| 8 | Tính từ phân từ (`dated`, `edged`, `faced`, `famed`, `hired`, `ruled`, `tied`, `timed`) |
| 6 | Viết tắt / stub Latin tối nghĩa (`os`, `dug`, `ala`, `cos`, `gen`, `mac`) |

**Giữ lại có chủ ý** dù cùng hình dạng: `damages` (pháp lý), `glasses` (mắt kính), `piles` (bệnh trĩ), `aesthetics`, `humanities`, `savings`, `credits`, `channels`, `amenities`, `communications`, `morals`, `fundamentals`, `grounds`, `roots`, `riches`, `honours`, `blues`, `singles` — số nhiều của chúng thật sự mang nghĩa khác. Và `jaw`, `ham`, `hop`, `ma`, `rep`, `tic` là từ bình thường, không bỏ.

Với medical, các từ mà gloss chỉ *nhắc tới* động/thực vật thì giữ: `elbow`, `membrane`, `organ`, `cortex`, `placenta`, `vagina`, `pore`, `limb`, `root canal`, `primary tooth`, `respiratory/skeletal/vascular system`, `cocaine`, `castor oil`, `botanical`, `poison ivy`/`oak`, `blackwater`, `milk sickness`, `hippocampus`, `parity`.

---

## 7. CEFR "inferred" lệch nhẹ về phía dễ — cần biết khi làm A2

1.311 từ trong lô đã có trong DB; **1.000 từ trong đó có CEFR khác DB**, và lệch một chiều: pack đánh dễ hơn.

| Từ | Pack | DB |
|---|---|---|
| `syndrome`, `diagnosis`, `dose`, `vessel`, `pit` | B1 | C1 |
| `breast`, `tissue`, `specialist`, `wound`, `palm`, `fever` | B1 | B2 |
| `knee` | B1 | A2 |

Import không bao giờ ghi đè `cefr`, nên 1.311 từ đó giữ giá trị DB — an toàn. Nhưng **1.685 từ mới không có giá trị DB nào che**, nên nếu cùng độ lệch thì band thật của chúng khó hơn nhãn. 953 từ mới rơi vào C1.

Hệ quả cho A2: `bandFit` sẽ nhắm hơi thấp so với thực tế trên nhóm từ này. Không sửa ở đây (không có nguồn CEFR nào tốt hơn để so), chỉ ghi lại để lúc tune `σ`/skew biết là dữ liệu có bias, không phải engine sai.

Hai điểm chất lượng nhỏ khác: `blister` và `cortex` lấy gloss nghĩa thực vật (`blister` = "sưng trên cây"); giữ từ, nghĩa nên sửa tay sau. Và 314 từ mới là từ ghép mà mọi thành phần đã có trong DB (`root canal`, `nervous system`) — hợp lệ, chỉ là lô này nghiêng nhiều về danh từ ghép (2.545/2.996 là danh từ).

---

## 8. Thứ tự chạy

```
npm run packs:build-crawl                       # 2.996 → 2.930, ghi drop report
npm run packs:enrich -- --pack <mỗi pack mới>    # IPA/audio/example; multiword hay 502
npm run packs:translate -- --pack <mỗi pack mới> # definition_vi: anhviet rồi gtx
npm run packs:import --dry-run                   # xem trước
npm run packs:import
npm run db:translate-vi                          # lưới an toàn cho definitionVi còn null
npm run db:topics                                # tag curated được giữ
npm run db:backfill-freq
npm run packs:verify
```

`db:push` đã chạy. `packs:fetch` cần chạy trước `packs:translate` (cần `anhviet.json`).

---

## 8b. Kết quả chạy thật (2026-08-13)

**DB: 6.394 → 8.011 từ** (+1.617), khớp đúng con số dry-run.

| Kiểm | Kết quả |
|---|---|
| `definitionVi` | **100%** — `db:translate-vi` báo "0 words remaining", bất biến giữ nguyên qua import |
| `type_vi` | 100% trên cả 9 pack |
| Nguồn nghĩa tiếng Việt | anhviet 1.313 / gtx 1.297 |
| Từ có ≥1 topic | 7.530/8.011 (94,0%) |
| Tag curated sống qua `db:topics` | ✅ medical 464, legal 261, daily-life 194, finance 125, social 124, office-skills 65 — **đúng bằng số từ trong pack** |
| `travel` hybrid | 965 → **1.197** (nhận cả keyword lẫn tag pack) |
| `logistics` → `business` | 1.744 → **1.757** |
| `daily-communication` | không thành chip nào; **1.329/1.622 (81,9%)** nhận topic keyword thật (body 267, sports 233, education 223…) |

**Enrichment (2.930 từ): IPA 72%, audio 52%, example 58%.** Phải chạy **pass 2** mới đạt: pass 1 dính 384 lỗi 429 + 109 lỗi 502. Pass 2 gặp **0 lỗi 429** và kéo `daily-communication` từ 14% → **90% IPA**.

Trần IPA của từng pack tỉ lệ nghịch gần như tuyệt đối với tỉ lệ từ ghép — `daily-communication` 0% từ ghép → 90% IPA; `office-skills` 50% từ ghép → 41%. Nghĩa là **41–58% ở các pack lĩnh vực là trần thật của dictionaryapi.dev**, không phải do rate limit: `root canal`, `abortion pill` đơn giản là không có mục từ. Chạy thêm pass nữa không cải thiện.

Một lưu ý vận hành: `db:topics` bị kill giữa chừng ở lần chạy đầu (2.800/8.011). Chạy lại là an toàn — nó tính lại topic từ đầu cho mọi từ và chỉ giữ slug curated, nên không có trạng thái nửa vời nào tồn tại sau lần chạy hoàn chỉnh.

## 9. Nghiệm

- `src/lib/freq.test.ts` — percentile: đỉnh list ≈ 1, cuối list = 0, rank 0 clamp về 1, input vô dụng ra `null` chứ không bịa số; `mister` rank 1 ở cả BSL và TSL ra hai percentile theo hai thang riêng; pack không có nguồn rank ra null ở **cả hai** field.
- `src/lib/topic-taxonomy.test.ts` — không slug trùng; 6 topic mới có mặt và `curated`; `logistics`/`daily-communication` **không** là topic; topic keyword rỗng không khớp mọi thứ (bẫy `\b()`); keyword `corner`/`straight` không kéo travel về.
- Tổng: 91 test cũ + 20 test mới, tất cả xanh.
- Kiểm bằng tay sau import: `definitionVi` phải giữ phủ 100%, và tag topic phải sống qua `db:topics`.

---

## 10. Còn treo sau lượt này

1. **Tầng tần suất tổng quát** — xem mục 4. Đây là việc còn lại lớn nhất của A1.
2. `blister`/`cortex` sai nghĩa (gloss thực vật) — sửa tay hoặc `--refresh definitionEn`.
3. A2 phải quyết `topicBoost` theo từng từ, không đọc `Topic.curated`, vì `travel` là hybrid (mục 5).
4. Ảnh cho từ mới: `images:fetch-wikimedia` / `images:fetch` chưa chạy cho 1.617 từ này (phủ ảnh tụt 100% → 79,6%).
5. **Nhiễu keyword có sẵn của topic `travel`** — `packs:verify` lôi ra `optic radiation` nằm trong "Travel & Transport". Nguyên nhân: stem là **tiền tố không có biên cuối**, nên `path` khớp `pathway`, `drive` khớp `hard drive`/`flash drive`, `visit` khớp `website`. Đây là hành vi **có từ trước**, không phải do lô này sinh ra — chỉ là import thêm từ y khoa có "pathway" nên nhìn thấy rõ. Đo cụ thể: mỗi keyword lỏng kéo 6–17 từ (`path` 14, `visit` 17, `drive` 12, `park` 11, `guest` 11), tổng ~40/1.197 từ của travel. Chưa sửa vì phải đụng keyword cũ và có nguy cơ làm lệch 965 từ đang có; muốn sửa thì viết `path\b` (matcher nối chuỗi vào regex nên `\b` nhúng được).

   Chuyện này chính là lý do 6 topic lĩnh vực mới để `keywords: []` (mục 5) — nó cho thấy chi phí thật của việc gán topic bằng keyword.
