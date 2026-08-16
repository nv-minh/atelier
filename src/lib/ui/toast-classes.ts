// Pure class-string builder behind the Toast primitive's 3 forms (Plan 1
// "Atelier v2", Task 9). No DOM, no React — see toast-classes.test.ts.
//
// `info` reads --accent (spec §5.5: the general-purpose action/link role,
// safe on any screen). `success`/`error` read --correct/--wrong, which spec
// §5.5 and the plan's Global Constraints restrict to "trong phiên học"
// (inside a study session). Every real caller today — useAchievementToasts,
// which will use form="success" — fires from inside one: grep confirms its
// only 3 call sites are practice-shell.tsx, matching-game.tsx and
// pronunciation-session.tsx (all study/practice components), so this is
// spec-compliant, not an exception to it. Same reserved-for-session
// precedent as Button's `danger` variant in button-classes.ts: `error` ships
// here with no caller yet so /dev/ui can render all 3 forms the kit expects,
// but a future NON-session "success"/"error" toast caller must revisit the
// token before shipping.
//
// Returns an object (border/iconWrap/label), not one flat class string like
// buttonClasses()/cardClasses(): Toast has several differently-colored slots
// sharing one form (the card's border, the icon circle, the eyebrow label),
// so there's no single string worth handing back — same kind of divergence
// ProgressBar documented for its two structurally different forms.

export type ToastForm = "info" | "success" | "error";

export type ToastFormClasses = {
  border: string;
  iconWrap: string;
  label: string;
};

const FORM_CLASSES: Record<ToastForm, ToastFormClasses> = {
  info: { border: "border-accent/30", iconWrap: "bg-accent/12 text-accent", label: "text-accent" },
  success: { border: "border-correct/30", iconWrap: "bg-correct/12 text-correct", label: "text-correct" },
  error: { border: "border-wrong/30", iconWrap: "bg-wrong/12 text-wrong", label: "text-wrong" },
};

export function toastFormClasses(form: ToastForm = "info"): ToastFormClasses {
  return FORM_CLASSES[form];
}
