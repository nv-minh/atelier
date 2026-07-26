// Name → lucide component map for achievement icons. The defs store icons as
// STRING names (client-safe, no component imports in gamification-defs.ts); this
// module is where names resolve to components. Import only the icons the defs
// actually use so the bundle stays lean.
import {
  Flame,
  Repeat,
  GraduationCap,
  BookOpen,
  Target,
  CircleCheck,
  Award,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Flame,
  Repeat,
  GraduationCap,
  BookOpen,
  Target,
  CircleCheck,
};

// Resolve an icon name to a component, falling back to a generic Award so an
// unmapped name never crashes the render.
export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Award;
}
