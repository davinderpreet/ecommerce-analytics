import express from "express";
import { syncShopifyOrders } from "../integrations/shopify";

const router = express.Router();

/** Trigger from browser for easy testing (GET/POST both allowed) */
router.all("/shopify", async (req, res) => {
  const days = Number(req.query.days ?? 7);
  try {
    await syncShopifyOrders(days);
    res.json({ ok: true, source: "shopify", days });
  } catch (e: any) {
    res.status(500).json({ ok: false, source: "shopify", error: e?.message || "sync_failed" });
  }
});

export default router;
