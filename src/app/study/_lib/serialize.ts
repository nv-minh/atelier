import type { StudyCard } from "@/lib/study-engine";
import type { PracticeCard } from "@/components/study/practice-session";

export function serializePractice(queue: StudyCard[]): PracticeCard[] {
  return queue.map((c) => ({
    cardId: c.cardId,
    wordId: c.id,
    word: c.word,
    cefr: c.cefr,
    typeEn: c.typeEn,
    typeVi: c.typeVi,
    ipaUk: c.ipaUk,
    ipaUs: c.ipaUs,
    definitionEn: c.definitionEn,
    definitionVi: c.definitionVi,
    example: c.example,
    exampleVi: c.exampleVi,
    synonyms: c.synonyms,
    audioUk: c.audioUk,
    audioUs: c.audioUs,
    state: c.state,
    reps: c.reps,
    lapses: c.lapses,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsedDays,
    scheduledDays: c.scheduledDays,
    due: c.due.toISOString(),
    lastReview: c.lastReview ? c.lastReview.toISOString() : null,
  }));
}
