// The one place that names where feedback goes. There is no form and no ticket
// system behind it — a mailto and a copyable address is the honest shape for a
// project this size, and it means the reply comes from a person.
//
// Deliberately NOT legal.ts's CONTACT_EMAIL, which is a different job: that one
// is the mailbox published on /privacy and /terms for account-deletion and
// data requests, it is env-driven (NEXT_PUBLIC_CONTACT_EMAIL), and it defaults
// to an .invalid sentinel so an unset production value fails the build. A
// feedback button pointing at hello@atelier.invalid on every local build would
// be worse than no button. The env var may override this once the two mailboxes
// are confirmed to be the same one.
export const FEEDBACK_EMAIL = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL || "nvminhhust@gmail.com";

// Hand-built instead of URLSearchParams: that encodes a space as "+", and per
// RFC 6068 a mail client reads "+" in a mailto query as a literal plus, so the
// subject line would arrive as "Góp+ý+cho+Atelier".
export function feedbackMailto(subject: string, body?: string): string {
  const q = [`subject=${encodeURIComponent(subject)}`];
  if (body) q.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${FEEDBACK_EMAIL}?${q.join("&")}`;
}
