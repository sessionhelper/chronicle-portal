/**
 * BFF route adapter. Wraps a handler with:
 *   - per-request latency metric emission
 *   - uniform error translation (AuthError → 401/403/404, ZodError → 400,
 *     upstream UpstreamError → 502, everything else → 500)
 *   - no IF-pyramid inside each route: handlers throw, this wrapper shapes
 *
 * Usage in a route file:
 *
 *   export const GET = apiHandler("api.sessions.list", async (req) => {
 *     const user = await requireUser();
 *     const sessions = await dataApiClient.listSessions();
 *     return Response.json(filterForUser(user, sessions));
 *   });
 */

import { ZodError } from "zod";

import { AuthError } from "@/lib/server-auth";
import { metrics } from "@/lib/metrics";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type RouteCtx<P extends Record<string, string>> = {
  params: Promise<P>;
};

type Handler<P extends Record<string, string>> = (
  req: Request,
  ctx: RouteCtx<P>,
) => Promise<Response>;

export function apiHandler<P extends Record<string, string> = Record<string, never>>(
  route: string,
  handler: Handler<P>,
): Handler<P> {
  return async (req, ctx) => {
    const start = performance.now();
    let status = 200;
    try {
      const response = await handler(req, ctx);
      status = response.status;
      return response;
    } catch (err) {
      if (err instanceof AuthError) {
        status = err.status;
        return jsonResponse({ error: err.message }, status);
      }
      if (err instanceof ZodError) {
        status = 400;
        return jsonResponse(
          { error: "invalid request", issues: err.flatten() },
          status,
        );
      }
      // UpstreamError tags: err.upstream, err.status. Fall through to 502.
      const maybeUpstream = err as { upstream?: string; status?: number };
      if (maybeUpstream?.upstream) {
        status = 502;
        return jsonResponse(
          {
            error: "upstream unavailable",
            upstream: maybeUpstream.upstream,
            upstream_status: maybeUpstream.status,
          },
          status,
        );
      }
      console.error(`[${route}] unhandled`, err);
      status = 500;
      return jsonResponse({ error: "internal error" }, status);
    } finally {
      metrics.portal_request_latency_ms
        .labels(route, req.method, String(status))
        .observe(performance.now() - start);
    }
  };
}

/** Convenience: parse a JSON request body against a Zod schema. */
export async function parseJson<T>(
  req: Request,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  const body = await req.json().catch(() => {
    throw new AuthError(400 as 401, "invalid json");
  });
  return schema.parse(body);
}
