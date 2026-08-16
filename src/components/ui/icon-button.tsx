import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariantClasses, type ButtonVariant } from "@/lib/ui/button-classes";

export type IconButtonSize = "sm" | "md"; // 44 / 48 px — sm is the min. tap-target floor

const ICON_SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: "h-11 w-11",
  md: "h-12 w-12",
};

// `aria-label` is required in the type (not optional) because an
// IconButton, by definition, has no visible text for assistive tech to read.
type IconButtonProps = {
  variant?: ButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  "aria-label": string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">;

export function IconButton({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors duration-instant " +
          "active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none",
        buttonVariantClasses(variant),
        ICON_SIZE_CLASSES[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 aria-hidden size={18} className="animate-spin" /> : children}
    </button>
  );
}
