import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkAdminRateLimit, getAdminToken, isAdminTokenValid } from "../lib/auth";
import {
  addSanction,
  removeSanction,
  clearSanctions,
  getSanctions,
  toPublicView,
} from "../lib/store";
import { validateCommitment } from "../lib/validate";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let expectedToken: string;
  try {
    expectedToken = getAdminToken();
  } catch (error) {
    console.error("[mock-api] admin auth misconfigured:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Admin API is not configured on this deployment" });
  }

  // Same auth as the Express server (server.js): x-admin-token header checked against
  // ADMIN_TOKEN. Production deployments must set a non-default token or requests are
  // rejected above instead of silently accepting the public "dev-token".
  const token = req.headers["x-admin-token"];
  if (!isAdminTokenValid(token, expectedToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const clientKey = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() || "unknown";
  if (!checkAdminRateLimit(clientKey)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  const { action, commitment } = req.body ?? {};

  switch (action) {
    case "add":
    case "remove": {
      const validated = validateCommitment(commitment);
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
      }
      const data = action === "add" ? addSanction(validated.value) : removeSanction(validated.value);
      return res.status(200).json({ ok: true, data: toPublicView(data) });
    }
    case "clear":
      return res.status(200).json({ ok: true, data: toPublicView(clearSanctions()) });
    case "status":
      return res.status(200).json({ ok: true, data: toPublicView(getSanctions()) });
    default:
      return res.status(400).json({ error: "action must be add | remove | clear | status" });
  }
}
