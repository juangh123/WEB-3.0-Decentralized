import { NextResponse } from "next/server";

// Server-side proxy for the mock sanctions API. Routing the fetch through the Next.js
// runtime keeps the browser on the same origin, so the demo does not depend on the
// upstream service sending CORS headers.
const UPSTREAM = process.env.SANCTIONS_API_URL ?? "https://mock-api-topaz-zeta.vercel.app/api/sanctions-list";
const UPSTREAM_TIMEOUT_MS = Number(process.env.SANCTIONS_API_TIMEOUT_MS ?? 6000);

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
      return NextResponse.json(errorPayload(`upstream ${upstream.status}`));
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
    return NextResponse.json(errorPayload(message));
  }
}
