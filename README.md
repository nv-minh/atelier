# Atelier — Vocabulary Studio

A refined, full-stack web app for mastering English vocabulary (A1–B2) using **FSRS** spaced repetition. Built with Next.js, Prisma, and a warm editorial design system.

```
3,677 words · 4 study modes · FSRS scheduler · progress analytics
```

---

## ✨ Features

### 🧠 Spaced Repetition (FSRS)
Powered by the **Free Spaced Repetition Scheduler** — the same algorithm family now default in Anki (2024). It models each card on three variables — *stability*, *difficulty*, *retrievability* — and schedules reviews ~25% more efficiently than the classic SM-2. You rate every card on a four-point scale:

| Button | Meaning | Effect |
|---|---|---|
| 🔴 Again | You forgot | Re-queue soon |
| 🟠 Hard | Barely recalled | Short interval |
| 🟢 Good | Recalled with effort | Standard interval |
| 🔵 Easy | Instant recall | Long interval |

### 🎴 Four study modes
- **Flashcards** — the core SRS loop. Flip, rate, repeat.
- **Quiz** — pick the meaning from four same-level distractors.
- **Typing** — active recall; typos within one character are forgiven (Levenshtein).
- **Dictation** — hear the word (UK/US audio, adjustable speed), spell it back.

All modes feed the same schedule. Quiz/Typing/Dictation auto-rate (correct → Good, wrong → Again).

### 📈 Progress tracking
- Streak counter (consecutive active days)
- Cards due / learned / learning
- Mastery bars per CEFR level (A1–B2)
- 365-day activity heatmap
- 30-day review forecast
- Recall accuracy trend
- Per-day study breakdown (new vs. reviews, accuracy)

### 🎨 Design
An original "Atelier" aesthetic — warm paper surfaces, a characterful **Fraunces** display serif paired with **Hanken Grotesk**, saffron-ember and moss accents, a subtle paper-grain texture, and choreographed motion via **Motion**. Light & dark themes. Fully responsive (mobile bottom-tab nav).

---

## 🚀 Quick start

```bash
# 1. Install
npm install

# 2. The database + 3,677 words are already seeded in prisma/dev.db
#    (To re-seed from scratch: delete prisma/dev.db, run the steps below)
npm run db:push     # create SQLite schema
npm run db:seed     # load vocabulary.json → 3,677 words

# 3. Run
npm run dev         # http://localhost:3000
```

> **Note:** port 3000 may be busy on this machine — the dev server auto-increments, or run `npx next dev -p 3939`.

---

## 🏗️ Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Database | SQLite + Prisma ORM (zero-setup; swap datasource to Postgres for multi-device) |
| SRS | [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) |
| Styling | Tailwind CSS + custom design tokens |
| Animation | Motion (Framer Motion) |
| Charts | Recharts |
| Icons | lucide-react |

### Project structure
```
src/
├── app/
│   ├── page.tsx              # Dashboard / home
│   ├── study/                # Mode picker + 4 study pages
│   ├── stats/                # Progress analytics
│   ├── browse/               # Full vocabulary library (search/filter)
│   ├── settings/             # FSRS params, theme, daily limits
│   └── api/                  # study/queue, study/review, stats, words, settings
├── components/
│   ├── study/                # Flashcard, PracticeSession, RatingButtons
│   ├── stats/                # StatCard, CefrProgress, Heatmap, Charts
│   ├── nav.tsx, theme-*, audio-button, cefr-badge
├── lib/
│   ├── fsrs.ts               # FSRS wrapper
│   ├── study-engine.ts       # Queue building, rating, review recording
│   ├── stats.ts              # Dashboard aggregations
│   ├── db.ts, utils.ts
data/vocabulary.json          # 3,677 enriched words (source data)
prisma/schema.prisma          # Word, Card, ReviewLog, StudySession, DailyStat, Settings
```

---

## 🧠 How it works

1. **Queue** — on each study session, the engine fetches cards `due <= now` (reviews) plus new cards up to your daily limit (`newCardsPerDay`), defaulting to 20.
2. **Rate** — your rating runs through `ts-fsrs`, which recomputes the card's stability/difficulty and next due date.
3. **Persist** — the card is updated, a `ReviewLog` entry is written, and the `DailyStat` for today is incremented (which powers the heatmap & streak).
4. **Forecast** — the dashboard reads future `due` dates to predict tomorrow's workload.

### FSRS tuning
In **Settings** you can adjust:
- **Target retention** (0.80–0.99) — higher = stronger memory, more reviews
- **New cards per day** (5–100)
- **Reviews per day** cap (50–500)

---

## 📊 Data

The 3,677 words come from `cefr_a1_b2_vocabulary.json`, enriched with:
- IPA (UK + US), part of speech (EN + VI)
- English definitions + extra definitions
- Example sentences
- Synonyms & antonyms
- Audio (UK/US, hosted on the Oxford-5000 repo)
- Image search links (Google/Bing/Oxford)

| Level | Words |
|---|---|
| A1 | 898 |
| A2 | 792 |
| B1 | 690 |
| B2 | 1,297 |

---

## 🔧 Going further

- **Multi-device sync:** change `datasource` in `schema.prisma` from `sqlite` to `postgresql`, point `DATABASE_URL` at Neon/Supabase, run `prisma migrate`.
- **Auth:** a `userId` column already exists on every table (defaulting to `"local"`) — add NextAuth and scope queries by session user.
- **FSRS optimization:** ts-fsrs supports parameter optimization from review history for a personalized scheduler.

---

*Built as a single-user studio. Data lives in `prisma/dev.db`.*
