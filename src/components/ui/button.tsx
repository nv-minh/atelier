import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses, type ButtonVariant, type ButtonSize } from "@/lib/ui/button-classes";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

// The first real button primitive (Plan 1 Task 6). Migrates the 41
// copy-pasted legacy-navy-on-lavender CTA call sites onto one shared class
// builder — see src/lib/ui/button-classes.ts for the variant/size values.
export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      // `className` is merged AFTER buttonClasses() so a call site can still
      // override anything (e.g. `w-full sm:w-auto`) via tailwind-merge.
      className={cn(buttonClasses(variant, size), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 aria-hidden size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
