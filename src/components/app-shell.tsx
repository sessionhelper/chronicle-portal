import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { resolveUser } from "@/lib/server-auth";

/**
 * Server-rendered chrome that wraps every signed-in page. Reads the
 * current user once; links adapt for admins. Pages compose their own
 * content inside `<AppShell>{children}</AppShell>`.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await resolveUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-semibold">
              Chronicle
            </Link>
            <Link href="/sessions" className="text-sm text-muted-foreground hover:text-foreground">
              Sessions
            </Link>
            <Link href="/me" className="text-sm text-muted-foreground hover:text-foreground">
              Me
            </Link>
            {user?.is_admin && (
              <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {user && (
              <span className="text-muted-foreground">
                {user.display_name ?? user.pseudo_id.slice(0, 8)}
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
