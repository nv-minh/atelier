# Data sources & attribution

Vocabulary content in `data/vocabulary.json` and `data/packs/*.json` is derived
from the sources below. Raw downloads live in `data/raw/` (gitignored); the
committed pack files are the build artifacts of `npm run packs:*`.

| Source | License | Used for | URL | Retrieved |
|---|---|---|---|---|
| Oxford 3000/5000 word list (via `winterdl/oxford-5000-vocabulary-audio-definition`) | Oxford University Press word list; community repo (also serves the app's runtime audio via `AUDIO_BASE`) | Base A1–B2 dataset, C1 pack (`oxford-c1`), CEFR levels, IPA, definitions, examples, UK/US audio | https://github.com/winterdl/oxford-5000-vocabulary-audio-definition | 2026-07-26 |
| NGSL-Spoken 1.2 — Browne, C., Culligan, B. & Phillips, J. | CC BY 3.0 (attribution required) | `conversation` pack word list + ranks | https://www.newgeneralservicelist.com/ngsl-spoken | 2026-07-26 |
| Business Service List (BSL) 1.2 — Browne, C. & Culligan, B. | CC BY 3.0 | `business` pack word list + ranks | https://www.newgeneralservicelist.com/business-service-list | 2026-07-26 |
| TOEIC Service List (TSL) 1.2 — Browne, C. & Culligan, B. | CC BY 3.0 | `toeic` pack word list + ranks | https://www.newgeneralservicelist.com/toeic-service-list | 2026-07-26 |
| `data/sources/it-terms.json` (project-authored, informed by the Computer Science Word List) | Project-authored | `it-programming` pack word list, categories, CEFR, jargon definitions | in-repo | 2026-07-26 |
| Free Dictionary API (dictionaryapi.dev, sourced from Wiktionary) | Wiktionary content is CC BY-SA 3.0 | Enrichment: IPA, definitions, examples, synonyms/antonyms, audio URLs (also the app's existing runtime fallback) | https://dictionaryapi.dev | 2026-07-26 |
| Wiktionary via kaikki.org machine-readable extracts (Tatu Ylonen) | CC BY-SA 3.0 (attribution) | Fallback definitions for jargon dictionaryapi.dev lacks | https://kaikki.org/dictionary/English/ | 2026-07-26 |
| Free Vietnamese Dictionary Project (Hồ Ngọc Đức) / OVDP Anh-Việt data, via `iamstevendao/superfast-dictionary` JSON conversion | Free for non-commercial use per FVDP terms — see swap path below | `definition_vi`/`type_vi` on pack words (`vi_source: "anhviet"`) | https://www.informatik.uni-leipzig.de/~duc/Dict/ | 2026-07-26 |
| Words-CEFR-Dataset (Maximax67; CEFR-J derived) | MIT | CEFR estimation for words outside Oxford 5000 (`cefr_source: "cefr-dataset"`) | https://github.com/Maximax67/Words-CEFR-Dataset | 2026-07-26 |
| Google Translate (unofficial gtx endpoint) | Best-effort, unofficial | Fallback `definition_vi` + all `example_vi` (`vi_source: "gtx"`); same endpoint as `prisma/translate-vi.ts` | — | 2026-07-26 |
| Wikimedia Commons (via Wikipedia PageImages API) | Varies by file, generally free-use/CC; `prisma/fetch-images.ts` only accepts `upload.wikimedia.org` thumbnails | `Word.imageUrl` for words with a matching Wikipedia article (`source: "wikimedia"` in `data/images.json`) | https://en.wikipedia.org/w/api.php | 2026-07-26 |
| Pexels API | Pexels License — free to use, no attribution required, hotlinking via `images.pexels.com` allowed: https://www.pexels.com/license/ | `Word.imageUrl` for the remaining words (`scripts/images/fetch-pexels.ts`, `source: "pexels"` in `data/images.json`); `photographer`/`pexelsUrl` recorded per entry for optional credit | https://www.pexels.com/api/ | 2026-08-08 |
| Princeton WordNet 3.0 | WordNet 3.0 License (BSD-style; reuse and commercial use permitted) | Word lists **and verbatim glosses** (`definition_en`), synonyms and the few examples in the 2026-08-13 domain packs: `medical`, `legal`, `finance`, `logistics`, `daily-life`, `social`, `travel`, `office-skills`, `daily-communication` | https://wordnet.princeton.edu/ | 2026-08-13 |
| `wordfreq` (Robyn Speer) | MIT (underlying corpora CC BY-SA / public domain) | Zipf frequency used to select and to **estimate CEFR** for the 2026-08-13 packs (`cefr_source: "inferred"`) | https://github.com/rspeer/wordfreq | 2026-08-13 |

## Commercialization note

The FVDP/OVDP Anh-Việt dictionary terms lean non-commercial. If this app is ever
commercialized, regenerate Vietnamese definitions for rows with
`vi_source: "anhviet"` using the gtx pipeline (or a licensed dictionary):
`npm run packs:translate` after clearing those fields — every pack word records
its `vi_source`, so the swap is mechanical.

## Rebuild from scratch

```
npm run packs:fetch      # download raw sources -> data/raw/
npm run packs:build      # normalize -> data/packs/*.json skeletons
npm run packs:build-crawl # convert an aggregated crawl file -> per-pack files (see below)
npm run packs:enrich     # dictionaryapi.dev + kaikki fallback (cached, resumable)
npm run packs:translate  # anhviet dictionary first, gtx fallback (cached)
npm run packs:import     # upsert into Word (add --dry-run first)
npm run db:translate-vi  # safety net for any definitionVi still null
npm run db:topics        # keyword topics (curated pack tags preserved)
npm run db:backfill-freq # Word.freqPct percentiles from the rank lists in data/raw/
npm run images:fetch-wikimedia  # Wikipedia PageImages, no key needed
npm run images:fetch     # Pexels for words still missing an image (needs PEXELS_API_KEY)
npm run images:apply     # push data/images.json into Word.imageUrl
npm run packs:verify     # counts + quality gates + samples + image coverage
```

Fresh-DB bootstrap order: `db:push → db:seed → packs:import → db:translate-vi → db:topics → db:backfill-freq → images:apply`.
`images:apply` alone is enough on a fresh DB if `data/images.json` is already committed — no re-crawl needed; only rerun `images:fetch-wikimedia`/`images:fetch` to backfill *new* words that have no entry yet.

## Crawl batches (`packs:build-crawl`)

`packs:build` normalizes the five original sources. A batch crawled outside the
repo arrives instead as one aggregated JSON array of `{ metadata, words }`, and
`scripts/packs/build-crawl-batch.ts` converts it into per-pack `PackFile`s —
mapping `freq_rank`→`rank`, keeping `source_ref`, and assigning taxonomy slugs.
It also applies that batch's dedupe/quality filter, and every word it removes is
recorded with a reason in `data/crawl-batches/<date>-dropped.json` so the call
can be reviewed or reversed. Input lives in gitignored `data/raw/incoming/`.

The 2026-08-13 batch: 2,996 words in → 2,930 out (66 dropped, 3 renamed to the
spelling already in the DB). Rationale for each decision is in
`docs/superpowers/plans/2026-08-13-crawl-batch-and-freq-migration.md`.

**A crawl batch does not carry frequency data.** `freq_rank` was null on all
2,996 rows, so those words keep `freqPct = null` and the selection engine scores
them neutrally. `db:backfill-freq` can only reach words present in NGSL-Spoken /
BSL / TSL; there is no *general* NGSL list in `packs:fetch`, so if you want
broad frequency coverage, add an NGSL 1.2 stats CSV as
`data/raw/NGSL_12_stats.csv` (picked up automatically as the top-priority
`ngsl` tier) or emit Zipf values from `wordfreq` during the crawl.

## Backups

`npm run db:backup` dumps every table (words + user data) to
`data/backups/<stamp>/` as JSON with a manifest; `npm run db:restore`
(optionally `-- --dir data/backups/<stamp>`) re-inserts rows idempotently
(`skipDuplicates` — existing rows untouched). Disaster recovery on an empty
database: `db:push → db:restore`. Backups contain user data and are
gitignored — copy the folder to external storage for real safety.
