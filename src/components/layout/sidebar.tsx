import { NavLink } from "react-router-dom";
import { LayoutDashboard, List, Menu, X } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sessions", label: "Sessions", icon: List },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-3 left-3 z-50 rounded border border-rule bg-card-surface p-1.5 font-sans text-ink md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed top-0 left-0 z-40 flex h-full w-60 flex-col border-r border-rule bg-card-surface",
          "transition-transform duration-150 ease-in-out",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 pt-5 pb-4">
          <h1 className="font-serif text-lg font-semibold text-ink">
            Open Voice Project
          </h1>
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded px-3 py-2 font-sans text-sm",
                  isActive
                    ? "bg-parchment-dark text-ink font-medium"
                    : "text-ink-light hover:bg-parchment-dark/50",
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
