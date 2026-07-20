"use client";

import { fsrs, generatorParameters, Rating, State, createEmptyCard, type Card as FSRSCard } from "ts-fsrs";

let _f: ReturnType<typeof fsrs> | null = null;
function getF() {
  if (!_f) {
    _f = fsrs(
      generatorParameters({
        request_retention: 0.9,
        maximum_interval: 36500,
        enable_fuzz: true,
      })
    );
  }
  return _f;
}

function toFsrs(card: any): FSRSCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReview ? new Date(card.lastReview) : undefined,
  };
}

export function formatInterval(due: Date, now = new Date()): string {
  const diffMs = due.getTime() - now.getTime();
  const mins = diffMs / 60000;
  if (mins < 1) return "<1m";
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function getRatingPreviewsClient(card: any) {
  const f = getF();
  const now = new Date();
  const item = card.state === 0 && card.reps === 0 ? createEmptyCard(now) : toFsrs(card);
  const schedule = f.repeat(item, now);
  const labels: Record<number, { label: string; key: string }> = {
    [Rating.Again]: { label: "Again", key: "1" },
    [Rating.Hard]: { label: "Hard", key: "2" },
    [Rating.Good]: { label: "Good", key: "3" },
    [Rating.Easy]: { label: "Easy", key: "4" },
  };
  const sched = schedule as unknown as Record<number, { card: { due: Date } }>;
  return [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((r) => {
    const s = sched[r].card;
    return {
      rating: r,
      label: labels[r].label,
      key: labels[r].key,
      interval: formatInterval(s.due, now),
      due: s.due,
    };
  });
}
