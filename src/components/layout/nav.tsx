"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";

export function Nav() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Continue even if logout request fails
    }
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-rule bg-parchment/80 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-4xl items-center justify-between px-4">
        <Link
          href="/"
          className="font-sans text-sm font-semibold tracking-tight text-ink"
        >
          Open Voice Project
        </Link>

        <div className="flex items-center gap-4 font-sans text-sm">
          {loading ? null : user ? (
            <>
              <Link
                href="/dashboard"
                className="text-ink-light hover:text-ink transition-colors duration-150"
              >
                Sessions
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-7 items-center rounded-md px-2.5 font-sans text-sm text-ink-light hover:bg-muted hover:text-ink transition-colors duration-150 outline-none">
                  {user.pseudo_id}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard/audit")}>
                    Audit log
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link href="/auth/discord">
              <Button variant="default" size="sm" className="font-sans">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
