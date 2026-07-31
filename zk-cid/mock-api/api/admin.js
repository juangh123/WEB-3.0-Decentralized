"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const store_1 = require("../lib/store");
function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  // Same auth as the Express server (server.js): x-admin-token header checked
  // against ADMIN_TOKEN env var. Default "dev-token" is for LOCAL DEMO ONLY.
  const token = req.headers["x-admin-token"];
  if (token !== (process.env.ADMIN_TOKEN ?? "dev-token")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { action, commitment } = req.body ?? {};
  switch (action) {
    case "add":
      if (!commitment)
        return res.status(400).json({ error: "commitment required" });
      return res
        .status(200)
        .json({
          ok: true,
          data: (0, store_1.toPublicView)(
            (0, store_1.addSanction)(String(commitment)),
          ),
        });
    case "remove":
      if (!commitment)
        return res.status(400).json({ error: "commitment required" });
      return res
        .status(200)
        .json({
          ok: true,
          data: (0, store_1.toPublicView)(
            (0, store_1.removeSanction)(String(commitment)),
          ),
        });
    case "clear":
      return res
        .status(200)
        .json({
          ok: true,
          data: (0, store_1.toPublicView)((0, store_1.clearSanctions)()),
        });
    case "status":
      return res
        .status(200)
        .json({
          ok: true,
          data: (0, store_1.toPublicView)((0, store_1.getSanctions)()),
        });
    default:
      return res
        .status(400)
        .json({ error: "action must be add | remove | clear | status" });
  }
}
