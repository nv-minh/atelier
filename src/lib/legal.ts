// The address published on /privacy and /terms as the contact and
// account-deletion route.
//
// ⚠️ This MUST point at a mailbox someone actually reads before the site goes
// public. Two reasons, both hard: Google's OAuth consent review reads the
// privacy policy and expects a reachable contact, and /privacy promises to
// action deletion requests within 30 days — a promise nobody receives is worse
// than no promise at all.
//
// The default deliberately uses the RFC 2606 .invalid TLD so an unset value
// fails loudly in review rather than looking like a plausible real address.
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@atelier.invalid";

// Bumped by hand when the wording materially changes, not on every deploy.
export const LEGAL_UPDATED = { vi: "14/08/2026", en: "14 August 2026" } as const;

export type LegalDoc = {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};
