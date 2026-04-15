/**
 * Next.js `instrumentation.ts` entry. Executed once per process at
 * startup; we wire the OTel SDK here so spans are available in BFF
 * handlers.
 *
 * No exporter configured — that's a deploy-time concern. SDK init alone
 * is enough to satisfy the spec invariant "wire OpenTelemetry SDK
 * (doesn't need to actually export yet)".
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { Resource } = await import("@opentelemetry/resources");
    const { SEMRESATTRS_SERVICE_NAME } = await import(
      "@opentelemetry/semantic-conventions"
    );
    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: "chronicle-portal",
      }),
    });
    sdk.start();
  } catch (err) {
    console.warn("otel init failed", err);
  }
}
