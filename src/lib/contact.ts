import { CONTACT_EMAIL } from "@/lib/legal";

// Where feedback goes. There is no form and no ticket system behind it — a
// mailto and a copyable address is the honest shape for a project this size,
// and it means the reply comes from a person.
//
// Same mailbox as the one /privacy and /terms publish, so legal.ts stays the
// single owner of the env read (NEXT_PUBLIC_CONTACT_EMAIL). The only thing
// added here is a real fallback: legal.ts defaults to an .invalid sentinel so
// that an unset production value fails loudly, but a feedback button pointing
// at hello@atelier.invalid on every local build is worse than the literal
// address. Production can never reach the fallback — env.ts throws on the
// sentinel before a prod build finishes.
export const FEEDBACK_EMAIL = CONTACT_EMAIL.endsWith(".invalid")
  ? "nvminhhust@gmail.com"
  : CONTACT_EMAIL;

// Hand-built instead of URLSearchParams: that encodes a space as "+", and per
// RFC 6068 a mail client reads "+" in a mailto query as a literal plus, so the
// subject line would arrive as "Góp+ý+cho+Atelier".
export function feedbackMailto(subject: string, body?: string): string {
  const q = [`subject=${encodeURIComponent(subject)}`];
  if (body) q.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${FEEDBACK_EMAIL}?${q.join("&")}`;
}
