/**
 * Prom-client singletons. Register once; access from anywhere.
 *
 * Next.js can evaluate this module more than once during dev-server
 * reload; defend against duplicate-registration errors by reusing any
 * metric already attached to the global registry.
 */

import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

type GlobalMetrics = {
  registry: Registry;
  portal_request_latency_ms: Histogram<"route" | "method" | "status">;
  portal_bff_upstream_latency_ms: Histogram<"upstream" | "op">;
  portal_bff_errors_total: Counter<"upstream" | "status">;
  portal_sse_subscribers: Gauge;
  portal_oauth_attempts_total: Counter<"result">;
};

declare global {
  var __chronicle_metrics: GlobalMetrics | undefined;
}

function buildMetrics(): GlobalMetrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const portal_request_latency_ms = new Histogram({
    name: "portal_request_latency_ms",
    help: "BFF HTTP request latency in ms",
    labelNames: ["route", "method", "status"] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
  });

  const portal_bff_upstream_latency_ms = new Histogram({
    name: "portal_bff_upstream_latency_ms",
    help: "Latency of upstream calls from the BFF in ms",
    labelNames: ["upstream", "op"] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
  });

  const portal_bff_errors_total = new Counter({
    name: "portal_bff_errors_total",
    help: "Count of BFF-originated errors, by upstream + HTTP status",
    labelNames: ["upstream", "status"] as const,
    registers: [registry],
  });

  const portal_sse_subscribers = new Gauge({
    name: "portal_sse_subscribers",
    help: "Current count of active SSE subscribers",
    registers: [registry],
  });

  const portal_oauth_attempts_total = new Counter({
    name: "portal_oauth_attempts_total",
    help: "Count of OAuth attempts, by result (success, error)",
    labelNames: ["result"] as const,
    registers: [registry],
  });

  return {
    registry,
    portal_request_latency_ms,
    portal_bff_upstream_latency_ms,
    portal_bff_errors_total,
    portal_sse_subscribers,
    portal_oauth_attempts_total,
  };
}

export const metrics: GlobalMetrics =
  global.__chronicle_metrics ?? (global.__chronicle_metrics = buildMetrics());
