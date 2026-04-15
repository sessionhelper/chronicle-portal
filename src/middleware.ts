/**
 * Auth gate for private pages. Anything under `/dashboard`, `/sessions`,
 * `/me`, `/admin` requires a signed-in session; Auth.js handles the
 * redirect to `/login` for us.
 *
 * We deliberately do not resolve `is_admin` here — that's runtime,
 * per-request, inside each BFF handler. Middleware only confirms the
 * presence of a valid JWT.
 */

import { auth } from "@/lib/auth";

const PROTECTED = [/^\/dashboard/, /^\/sessions/, /^\/me/, /^\/admin/];

export default auth((req) => {
  const isProtected = PROTECTED.some((rx) => rx.test(req.nextUrl.pathname));
  if (!isProtected) return;
  if (!req.auth) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(login);
  }
});

export const config = {
  matcher: [
    // Everything except Next internals, Auth.js API, public assets,
    // BFF API (BFF handles its own auth via apiHandler).
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/metrics).*)",
  ],
  // Node runtime required because the full Auth.js config transitively
  // imports `prom-client` (via `@/lib/auth` → `@/lib/metrics`), which
  // calls `process.uptime()` — unsupported under Edge.
  runtime: "nodejs",
};
