import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClasses, type InputForm } from "@/lib/ui/input-classes";

type InputProps = {
  form?: InputForm;
} & React.InputHTMLAttributes<HTMLInputElement>;

// The first Input primitive (Plan 1 Task 9). First real caller: /browse's
// search box (src/app/browse/library-client.tsx) — swaps only the visual
// shell (the <input> element + its wrapper classes + the leading icon); the
// debounce/state/URL-routing logic around it is untouched (Plan 4's
// territory, not this task's — see task-9-brief.md). Not polymorphic, same
// precedent as Button/Card/Chip: a call site that needs something other than
// a bare <input> imports `inputClasses()` directly.
export function Input({ form = "text", className, ...props }: InputProps) {
  if (form === "search") {
    return (
      <div className="relative w-full">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted"
        />
        <input className={cn(inputClasses(form), className)} {...props} />
      </div>
    );
  }
  return <input className={cn(inputClasses(form), className)} {...props} />;
}
