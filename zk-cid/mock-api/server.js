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
// Admin auth token for POST /api/admin* endpoints (x-admin-token header).
// Default "dev-token" is for LOCAL DEMO ONLY — always set ADMIN_TOKEN via
// environment/.env in any shared deployment. The Vercel version (api/admin.ts)
// reads the same ADMIN_TOKEN env var and uses the same default.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-token";
const SOURCE = "Mock OFAC SDN Sanctions List (Demo)";

// ----- Seed data: SEED_SANCTIONED env (comma-separated) or seed.json -----
function loadSeed() {
  const fromEnv = (process.env.SEED_SANCTIONED ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;

  const seedPath = path.join(__dirname, "seed.json");
  if (fs.existsSync(seedPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      const list = Array.isArray(parsed) ? parsed : parsed.sanctioned;
      if (Array.isArray(list)) return list.map((s) => String(s).trim()).filter(Boolean);
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
app.use(cors());
app.use(express.json());

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
      if (!commitment) return res.status(400).json({ error: "commitment required" });
      return res.json({ ok: true, data: addSanction(String(commitment)) });
    case "remove":
      if (!commitment) return res.status(400).json({ error: "commitment required" });
      return res.json({ ok: true, data: removeSanction(String(commitment)) });
    case "clear":
      return res.json({ ok: true, data: clearSanctions() });
    case "status":
      return res.json({ ok: true, data: publicView() });
    default:
      return res.status(400).json({ error: "action must be add | remove | clear | status" });
  }
}

app.post("/api/admin/sanction", adminHandler);
app.post("/api/admin", adminHandler); // parity with Vercel route api/admin.ts

app.listen(PORT, () => {
  console.log(`[mock-api] Mock Sanctions API running at http://localhost:${PORT}`);
  console.log(`[mock-api]   GET  /api/sanctions-list  -> { sanctioned, source, updatedAt }`);
  console.log(`[mock-api]   POST /api/admin/sanction  (x-admin-token required, actions: add|remove|clear|status)`);
  if (store.sanctionedCommitments.length === 0) {
    console.log("[mock-api] Sanctions list is EMPTY (no seed). Add a real commitment before the demo:");
    console.log(`[mock-api]   curl -X POST http://localhost:${PORT}/api/admin/sanction \\`);
    console.log(`[mock-api]     -H "x-admin-token: ${ADMIN_TOKEN}" -H "Content-Type: application/json" \\`);
    console.log(`[mock-api]     -d '{"action":"add","commitment":"<REAL_COMMITMENT>"}'`);
    console.log("[mock-api] Or set SEED_SANCTIONED=<c1,c2> / provide seed.json and restart.");
  } else {
    console.log(`[mock-api] Seeded ${store.sanctionedCommitments.length} sanctioned commitment(s).`);
  }
});
