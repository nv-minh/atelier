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
npm run packs:enrich     # dictionaryapi.dev + kaikki fallback (cached, resumable)
npm run packs:translate  # anhviet dictionary first, gtx fallback (cached)
npm run packs:import     # upsert into Word (add --dry-run first)
npm run db:translate-vi  # safety net for any definitionVi still null
npm run db:topics        # keyword topics (curated pack tags preserved)
npm run packs:verify     # counts + quality gates + samples
```

Fresh-DB bootstrap order: `db:push → db:seed → packs:import → db:translate-vi → db:topics`.

## Backups

`npm run db:backup` dumps every table (words + user data) to
`data/backups/<stamp>/` as JSON with a manifest; `npm run db:restore`
(optionally `-- --dir data/backups/<stamp>`) re-inserts rows idempotently
(`skipDuplicates` — existing rows untouched). Disaster recovery on an empty
database: `db:push → db:restore`. Backups contain user data and are
gitignored — copy the folder to external storage for real safety.
