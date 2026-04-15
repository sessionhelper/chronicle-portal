/**
 * Portal-side event bus. A single WebSocket to chronicle-data-api, fan-
 * out to any number of SSE subscribers. Filters happen per-subscriber.
 *
 * Lifecycle:
 *   - First SSE subscriber lazily dials the data-api WS + authenticates.
 *   - Each SSE client registers a `subscribe(filter)` callback that the
 *     bus invokes on every matching event.
 *   - When the last client unsubscribes, the WS stays open (cheap, one
 *     per process). When the WS itself disconnects, all SSE streams
 *     receive a retry directive and close.
 *
 * This is MVP-scoped: no reconnect backoff tuning, no queue saturation
 * handling beyond the WS provider's defaults. Good enough for "🔴
 * recording" badges.
 */

import WebSocket from "ws";

import { dataApiClient } from "@/lib/data-api-client";
import { env } from "@/lib/env";
import { metrics } from "@/lib/metrics";

type WsEvent = {
  type: string;
  at_ts?: string;
  data?: Record<string, unknown>;
};

type Subscriber = {
  id: string;
  filter: (event: WsEvent) => boolean;
  onEvent: (event: WsEvent) => void;
  onClose: () => void;
};

class EventBus {
  private ws: WebSocket | null = null;
  private wsReady: Promise<void> | null = null;
  private subscribers = new Map<string, Subscriber>();

  private async dial(): Promise<void> {
    if (this.ws) return;
    const token = await dataApiClient.getBearerToken();
    const base = env.DATA_API_URL.replace(/^http/, "ws");
    const url = `${base}/internal/ws`;
    this.ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    this.ws.on("message", (raw) => {
      let event: WsEvent;
      try {
        event = JSON.parse(String(raw)) as WsEvent;
      } catch {
        return;
      }
      for (const sub of this.subscribers.values()) {
        if (sub.filter(event)) sub.onEvent(event);
      }
    });
    this.ws.on("close", () => {
      this.ws = null;
      this.wsReady = null;
      for (const sub of this.subscribers.values()) {
        sub.onClose();
      }
      this.subscribers.clear();
    });
    this.ws.on("error", (err) => {
      console.error("data-api ws error", err);
    });
    await new Promise<void>((resolve, reject) => {
      this.ws!.once("open", () => {
        this.ws!.send(
          JSON.stringify({
            type: "subscribe",
            events: [
              "session_state_changed",
              "chunk_uploaded",
              "segment_created",
              "segment_updated",
              "segment_deleted",
              "beat_created",
              "beat_updated",
              "beat_deleted",
              "scene_created",
              "scene_updated",
              "scene_deleted",
              "mute_range_created",
              "mute_range_deleted",
              "audio_deleted",
            ],
            filter: {},
          }),
        );
        resolve();
      });
      this.ws!.once("error", reject);
    });
  }

  async ensureConnected(): Promise<void> {
    if (!this.wsReady) this.wsReady = this.dial();
    await this.wsReady;
  }

  subscribe(sub: Subscriber): () => void {
    this.subscribers.set(sub.id, sub);
    metrics.portal_sse_subscribers.inc();
    return () => {
      this.subscribers.delete(sub.id);
      metrics.portal_sse_subscribers.dec();
    };
  }
}

declare global {
  var __chronicle_event_bus: EventBus | undefined;
}

export const eventBus: EventBus =
  global.__chronicle_event_bus ?? (global.__chronicle_event_bus = new EventBus());
