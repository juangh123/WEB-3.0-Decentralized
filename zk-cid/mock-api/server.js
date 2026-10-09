/**
 * ZK-CID Mock Sanctions API — Express local dev server.
 *
 * Mirrors the Vercel serverless implementation (api/sanctions-list.ts +
 * api/admin.ts + lib/store.ts) so the CRE compliance-lifecycle workflow
 * behaves identically against either deployment.
 *
 * Unified response schema for GET /api/sanctions-list:
 *   { sanctioned: string[], source: string, updatedAt: string }
 */
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

// ----- Minimal dependency-free .env loader (process.env always wins) -----
function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const PORT = Number(process.env.PORT ?? 3001);
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
const DEV_ADMIN_TOKEN = "dev-token";

// Admin auth token for POST /api/admin* endpoints (x-admin-token header). Production must
// set a non-default ADMIN_TOKEN: silently falling back to the public "dev-token" would turn
// "forgot to configure" into a public write endpoint for the sanctions list.
function resolveAdminToken() {
  const configured = (process.env.ADMIN_TOKEN ?? "").trim();
  if (configured && configured !== DEV_ADMIN_TOKEN) return configured;
  if (IS_PRODUCTION) {
    throw new Error("ADMIN_TOKEN must be set to a non-default value in production");
  }
  return DEV_ADMIN_TOKEN;
}

const ADMIN_TOKEN = resolveAdminToken();
const SOURCE = "Mock OFAC SDN Sanctions List (Demo)";

// Mirror of lib/validate.ts — the CRE workflow runs BigInt() on every entry, so a single
// malformed value would abort a whole compliance run. Keep both implementations in sync.
const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function validateCommitment(input) {
  if (typeof input !== "string" && typeof input !== "number") {
    return { ok: false, error: "commitment must be a decimal field element" };
  }
  const text = String(input).trim();
  if (!/^[0-9]{1,78}$/.test(text)) {
    return { ok: false, error: "commitment must be a decimal field element" };
  }
  let value;
  try {
    value = BigInt(text);
  } catch {
    return { ok: false, error: "commitment must be a decimal field element" };
  }
  if (value <= 0n) return { ok: false, error: "commitment must be greater than zero" };
  if (value >= SNARK_SCALAR_FIELD) {
    return { ok: false, error: "commitment is outside the Semaphore scalar field" };
  }
  return { ok: true, value: value.toString() };
}

// ----- Seed data: SEED_SANCTIONED env (comma-separated) or seed.json -----
function loadSeed() {
  const normalize = (list) =>
    list
      .map((entry) => validateCommitment(entry))
      .filter((result) => result.ok)
      .map((result) => result.value);

  const fromEnv = (process.env.SEED_SANCTIONED ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return normalize(fromEnv);

  const seedPath = path.join(__dirname, "seed.json");
  if (fs.existsSync(seedPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      const list = Array.isArray(parsed) ? parsed : parsed.sanctioned;
      if (Array.isArray(list)) return normalize(list.map((s) => String(s).trim()).filter(Boolean));
      console.warn("[mock-api] seed.json has no array payload, ignoring it");
    } catch (err) {
      console.warn(`[mock-api] failed to parse seed.json, ignoring it: ${err.message}`);
    }
  }
  return [];
}

// ----- In-memory store (same add/remove/clear/status semantics as lib/store.ts) -----
const store = {
  source: SOURCE,
  updatedAt: new Date().toISOString(),
  sanctionedCommitments: loadSeed(),
};

function publicView() {
  return {
    sanctioned: [...store.sanctionedCommitments],
    source: store.source,
    updatedAt: store.updatedAt,
  };
}

function addSanction(commitment) {
  if (!store.sanctionedCommitments.includes(commitment)) {
    store.sanctionedCommitments.push(commitment);
    store.updatedAt = new Date().toISOString();
  }
  return publicView();
}

function removeSanction(commitment) {
  store.sanctionedCommitments = store.sanctionedCommitments.filter(
    (c) => c !== commitment
  );
  store.updatedAt = new Date().toISOString();
  return publicView();
}

function clearSanctions() {
  store.sanctionedCommitments = [];
  store.updatedAt = new Date().toISOString();
  return publicView();
}

// ----- HTTP layer -----
const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin/non-browser requests have no Origin header; allow those.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Local development without an explicit allow-list stays permissive; production
      // must configure CORS_ORIGINS or cross-origin browser calls are rejected.
      if (allowedOrigins.length === 0 && !IS_PRODUCTION) return callback(null, true);
      return callback(null, false);
    },
  }),
);
app.use(express.json());

// Best-effort in-memory rate limit for the admin endpoints (see README: not shared across
// serverless instances, this only dampens abuse on a single node/instance).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Math.max(1, Number.parseInt(process.env.ADMIN_RATE_LIMIT ?? "30", 10) || 30);
const adminRateBuckets = new Map();

function adminRateLimit(req, res, next) {
  const raw = req.headers["x-forwarded-for"] ?? req.ip ?? "unknown";
  const key = String(raw).split(",")[0].trim() || "unknown";
  const now = Date.now();
  const bucket = adminRateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    adminRateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests" });
  }

  bucket.count += 1;
  return next();
}

app.get("/api/sanctions-list", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(publicView());
});

// Same contract as api/admin.ts: POST { action: add|remove|clear|status, commitment? }
// with x-admin-token header auth.
function adminHandler(req, res) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { action, commitment } = req.body ?? {};
  switch (action) {
    case "add":
    case "remove": {
      const validated = validateCommitment(commitment);
      if (!validated.ok) return res.status(400).json({ error: validated.error });
      const data = action === "add" ? addSanction(validated.value) : removeSanction(validated.value);
      return res.json({ ok: true, data });
    }
    case "clear":
      return res.json({ ok: true, data: clearSanctions() });
    case "status":
      return res.json({ ok: true, data: publicView() });
    default:
      return res.status(400).json({ error: "action must be add | remove | clear | status" });
  }
}

app.post("/api/admin/sanction", adminRateLimit, adminHandler);
app.post("/api/admin", adminRateLimit, adminHandler); // parity with Vercel route api/admin.ts

app.listen(PORT, () => {
  console.log(`[mock-api] Mock Sanctions API running at http://localhost:${PORT}`);
  console.log(`[mock-api]   GET  /api/sanctions-list  -> { sanctioned, source, updatedAt }`);
  console.log(`[mock-api]   POST /api/admin/sanction  (x-admin-token required, actions: add|remove|clear|status)`);
  if (store.sanctionedCommitments.length === 0) {
    console.log("[mock-api] Sanctions list is EMPTY (no seed). Add a real commitment before the demo:");
    console.log(`[mock-api]   curl -X POST http://localhost:${PORT}/api/admin/sanction \\`);
    console.log(`[mock-api]     -H "x-admin-token: <ADMIN_TOKEN>" -H "Content-Type: application/json" \\`);
    console.log(`[mock-api]     -d '{"action":"add","commitment":"<REAL_COMMITMENT>"}'`);
    console.log("[mock-api] Or set SEED_SANCTIONED=<c1,c2> / provide seed.json and restart.");
  } else {
    console.log(`[mock-api] Seeded ${store.sanctionedCommitments.length} sanctioned commitment(s).`);
  }
});
