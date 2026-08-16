// Pure class-string builder behind the Button/IconButton primitives (Plan 1
// "Atelier v2", Task 6). No DOM, no React — kept trivially unit-testable,
// see button-classes.test.ts for the full variant × size matrix.
//
// Color roles follow the design spec's §5.5 table: outside a study session a
// screen may only show accent (blue) + due (amber) + mastered (purple), so
// `danger` — the one variant that reaches for `--wrong` — is reserved for
// study-session call sites per spec §3.2/§5.5. No call site in this
// migration needs it yet; it still exists so /dev/ui can render all 4
// variants the kit expects.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg"; // 40 / 48 / 56 px tall

// Shared by every variant/size combination.
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-colors duration-instant active:scale-[.97] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-fg-on-accent shadow-accent hover:bg-accent-hover active:bg-accent-active",
  // Card-level background + hover per the secondary role in spec §5.5 — the
  // same token every other input/card in the app already reads, not a new
  // color introduced by this primitive.
  secondary: "border border-hairline bg-surface text-fg hover:bg-sunken",
  ghost: "text-fg-muted hover:bg-sunken hover:text-fg",
  danger: "bg-wrong text-white",
};

// Fixed heights (not padding alone) so button height is computable
// regardless of content — spec §2.2's "strong, even rounding" plus the kit's
// fully-rounded shape for every size.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-10 px-5 text-sm",
  md: "h-12 px-6",
  lg: "h-14 px-8",
};

/**
 * Variant-only classes (color + hover/active + shadow), no size or base
 * layout baked in. Exported so IconButton can share the same 4 color roles
 * without duplicating them under a different sizing scale.
 */
export function buttonVariantClasses(variant: ButtonVariant): string {
  return VARIANT_CLASSES[variant];
}

export function buttonClasses(variant: ButtonVariant, size: ButtonSize): string {
  return `${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`;
}
