"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboardIcon,
  ListIcon,
  SettingsIcon,
  MenuIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/sessions", label: "Sessions", icon: ListIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 flex size-8 items-center justify-center rounded border border-rule bg-card-surface font-sans text-ink-light lg:hidden"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? (
          <XIcon className="size-4" />
        ) : (
          <MenuIcon className="size-4" />
        )}
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-full w-60 flex-col border-r border-rule bg-card-surface",
          "transition-transform duration-150 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-12 items-center px-4 border-b border-rule">
          <Link
            href="/"
            className="font-sans text-sm font-semibold tracking-tight text-ink"
            onClick={() => setMobileOpen(false)}
          >
            Open Voice Project
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded px-2.5 py-1.5 font-sans text-sm",
                  "transition-colors duration-100",
                  active
                    ? "bg-parchment-dark text-ink font-medium"
                    : "text-ink-light hover:bg-parchment-dark hover:text-ink"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-rule px-4 py-3">
          <p className="font-sans text-[11px] text-ink-faint">
            Internal admin
          </p>
        </div>
      </aside>
    </>
  );
}
