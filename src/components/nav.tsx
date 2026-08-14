"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Library, Settings, Layers, Compass, NotebookPen, Trophy } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";
import { LangToggle } from "./lang-toggle";
import { UserMenu } from "./user-menu";
import { useAuthGate } from "./auth-gate";
import { useI18n } from "./i18n-provider";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { knownGuest } = useAuthGate();
  // hide nav during active study for focus
  const isStudying = pathname?.startsWith("/study/") && pathname !== "/study";

  // `locked` tabs are the ones a guest cannot see the contents of. They stay
  // tappable — the destination now renders <AuthRequired> — but carry a dot so
  // the lock is visible before the tap, not discovered after it.
  const links = [
    { href: "/", label: t("nav.studio"), icon: Layers, mobile: true, locked: false },
    { href: "/topics", label: t("nav.topics"), icon: Compass, mobile: true, locked: false },
    { href: "/browse", label: t("nav.library"), icon: Library, mobile: false, locked: false },
    { href: "/notebook", label: t("nav.notebook"), icon: NotebookPen, mobile: true, locked: true },
    { href: "/stats", label: t("nav.progress"), icon: BarChart3, mobile: true, locked: true },
    { href: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy, mobile: true, locked: true },
    // Settings stays in the desktop nav / user menu; dropped from the mobile bottom bar to avoid crowding.
    { href: "/settings", label: t("nav.settings"), icon: Settings, mobile: false, locked: true },
  ];
  const mobileLinks = links.filter((l) => l.mobile);

  return (
    <>
      {/* Top bar */}
      <header
        className={cn(
          "sticky top-0 z-40 backdrop-blur-xl bg-paper/75 border-b border-line pt-[env(safe-area-inset-top)]",
          isStudying && "opacity-0 pointer-events-none"
        )}
      >
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandMark size={32} />
            <span className="display text-lg tracking-tight">
              Atelier
              <span className="display-it text-ember">.</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const active = pathname === l.href || (l.href !== "/" && pathname?.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "relative px-3.5 py-1.5 text-sm rounded-full transition-colors",
                    active ? "text-ink" : "text-soft hover:text-ink"
                  )}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-full bg-ink/5 border border-line" />
                  )}
                  <span className="relative">{l.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/study"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t("nav.study")}
            </Link>
            <UserMenu />
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-paper/85 border-t border-line",
          isStudying && "opacity-0 pointer-events-none translate-y-full transition-transform"
        )}
      >
        <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
          {mobileLinks.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname?.startsWith(l.href));
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors",
                  active ? "text-ember" : "text-soft"
                )}
              >
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  {knownGuest && l.locked && (
                    <span
                      aria-hidden
                      className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-ember/70 ring-2 ring-paper"
                    />
                  )}
                </span>
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
