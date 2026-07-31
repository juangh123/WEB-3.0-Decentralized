import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSanctions, toPublicView } from "../lib/store";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Unified schema shared with the Express server (server.js):
  // { sanctioned: string[], source: string, updatedAt: string }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(toPublicView(getSanctions()));
}
