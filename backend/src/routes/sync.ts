// backend/src/routes/sync.ts
import express from "express";
import { runFullSync } from "../jobs/sync";

const router = express.Router();

router.post("/", async (req, res) => {
  const days = Number(req.query.days ?? 7);
  try {
    await runFullSync(days);
    res.json({ ok: true, days });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "sync_failed" });
  }
});

export default router;
