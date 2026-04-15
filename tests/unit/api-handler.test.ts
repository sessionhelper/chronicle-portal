import { describe, expect, it } from "vitest";
import { z } from "zod";

import { apiHandler, parseJson } from "@/lib/api-handler";
import { AuthError } from "@/lib/server-auth";

describe("apiHandler", () => {
  it("translates AuthError(401) to 401 response", async () => {
    const handler = apiHandler("test.401", async () => {
      throw new AuthError(401, "unauthenticated");
    });
    const res = await handler(new Request("http://x/test"), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("translates AuthError(403) to 403", async () => {
    const handler = apiHandler("test.403", async () => {
      throw new AuthError(403, "forbidden");
    });
    const res = await handler(new Request("http://x/test"), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("translates ZodError to 400 with issues", async () => {
    const schema = z.object({ x: z.string() });
    const handler = apiHandler("test.zod", async () => {
      schema.parse({});
      return new Response("unreachable");
    });
    const res = await handler(new Request("http://x/test"), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: unknown };
    expect(body.error).toBe("invalid request");
    expect(body.issues).toBeDefined();
  });

  it("translates upstream errors to 502", async () => {
    const handler = apiHandler("test.upstream", async () => {
      const err = new Error("boom") as Error & {
        upstream: string;
        status: number;
      };
      err.upstream = "data-api";
      err.status = 500;
      throw err;
    });
    const res = await handler(new Request("http://x/test"), { params: Promise.resolve({}) });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { upstream: string };
    expect(body.upstream).toBe("data-api");
  });

  it("translates anything else to 500", async () => {
    const handler = apiHandler("test.boom", async () => {
      throw new Error("anything");
    });
    const res = await handler(new Request("http://x/test"), { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
  });

  it("passes through successful responses", async () => {
    const handler = apiHandler("test.ok", async () => {
      return Response.json({ ok: true });
    });
    const res = await handler(new Request("http://x/test"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("parseJson", () => {
  const schema = z.object({ text: z.string() });

  it("parses valid JSON against a schema", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ text: "hi" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(await parseJson(req, schema)).toEqual({ text: "hi" });
  });

  it("rejects invalid JSON body", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    await expect(parseJson(req, schema)).rejects.toBeInstanceOf(AuthError);
  });
});
