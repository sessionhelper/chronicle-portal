import { Sidebar } from "./sidebar";

/**
 * App shell with fixed sidebar and scrollable main content area.
 * Used for all admin-facing pages.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-60">
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
