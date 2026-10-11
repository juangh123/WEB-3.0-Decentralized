import { NextResponse } from "next/server";

// Server-side proxy for the mock sanctions API. Routing the fetch through the Next.js
// runtime keeps the browser on the same origin, so the demo does not depend on the
// upstream service sending CORS headers.
const UPSTREAM = process.env.SANCTIONS_API_URL ?? "https://mock-api-topaz-zeta.vercel.app/api/sanctions-list";
const RAW_TIMEOUT_MS = Number(process.env.SANCTIONS_API_TIMEOUT_MS ?? 6000);
const UPSTREAM_TIMEOUT_MS = Number.isFinite(RAW_TIMEOUT_MS) ? Math.min(30_000, Math.max(500, RAW_TIMEOUT_MS)) : 6000;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const errorPayload = (error: string) => ({
  sanctioned: [],
  source: null,
  updatedAt: null,
  error,
});

export async function GET() {
  try {
    const upstream = await fetch(UPSTREAM, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      // A failing sanctions feed must not look like "nobody is sanctioned": surface the real
      // failure with a gateway status code so callers can render a distinct error state.
      return NextResponse.json(errorPayload(`upstream ${upstream.status}`), { status: 502 });
    }

    const data: unknown = await upstream.json();
    const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const sanctioned = Array.isArray(record.sanctioned)
      ? record.sanctioned
          .filter((value): value is string | number | bigint => ["string", "number", "bigint"].includes(typeof value))
          .map(value => String(value).slice(0, 256))
      : [];

    return NextResponse.json({
      sanctioned,
      source: typeof record.source === "string" ? record.source : UPSTREAM,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(errorPayload(message), { status: isTimeout ? 504 : 500 });
  }
}
