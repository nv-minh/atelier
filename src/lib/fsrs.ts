import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  createEmptyCard,
  type Card as FSRSCard,
} from "ts-fsrs";

// Ratings
export const RATINGS = {
  Again: Rating.Again,   // 1
  Hard: Rating.Hard,     // 2
  Good: Rating.Good,     // 3
  Easy: Rating.Easy,     // 4
} as const;

export type RatingKey = keyof typeof RATINGS;

export const STATES = {
  New: State.New,
  Learning: State.Learning,
  Review: State.Review,
  Relearning: State.Relearning,
} as const;

let _f: ReturnType<typeof fsrs> | null = null;

export function getFsrs(requestRetention = 0.9) {
  if (!_f) {
    const params = generatorParameters({
      request_retention: requestRetention,
      maximum_interval: 36500,
      enable_fuzz: true,
    });
    _f = fsrs(params);
  }
  return _f;
}

// Convert a stored Card to an fsrs-runnable object
export function toFsrsCard(card: {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}): FSRSCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReview ?? undefined,
  };
}

export function newFsrsCard(): FSRSCard {
  return createEmptyCard(new Date());
}

// Compute the 4 scheduling options for a card given current time
export function previewCard(
  card: {
    due: Date;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    state: number;
    lastReview: Date | null;
  },
  now = new Date()
) {
  const f = getFsrs();
  const item = toFsrsCard(card);
  return f.repeat(item, now);
}

// Apply a rating and return the updated fields to persist
export function applyRating(
  card: {
    due: Date;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    state: number;
    lastReview: Date | null;
  },
  rating: Rating,
  now = new Date()
) {
  const f = getFsrs();
  const item = toFsrsCard(card);
  const sched = f.repeat(item, now) as unknown as Record<number, { card: any }>;
  const s = sched[rating].card;
  return {
    due: s.due,
    stability: s.stability,
    difficulty: s.difficulty,
    elapsedDays: s.elapsed_days,
    scheduledDays: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as number,
    lastReview: now,
  };
}

export { Rating, State };
