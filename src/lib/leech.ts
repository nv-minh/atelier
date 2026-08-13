// The leech predicate, pure and with no userId — so both the server module
// (study-engine, notebook) and the pure module (vault/scope) share one
// definition. No server-only here: adding it would make vault/scope.ts
// untestable.

// A "leech" is a word the learner keeps forgetting: enough lapses on a card
// that has left the New state. Derived, never stored.
export const LEECH_THRESHOLD = 4;

export function leechCardWhere() {
  return { lapses: { gte: LEECH_THRESHOLD }, state: { gte: 1 } };
}
