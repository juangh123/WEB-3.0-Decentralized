"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const store_1 = require("../lib/store");
function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  // Unified schema shared with the Express server (server.js):
  // { sanctioned: string[], source: string, updatedAt: string }
  res.setHeader("Cache-Control", "no-store");
  return res
    .status(200)
    .json((0, store_1.toPublicView)((0, store_1.getSanctions)()));
}
