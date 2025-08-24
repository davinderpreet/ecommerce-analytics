// backend/src/jobs/sync.ts
import { syncShopifyOrders } from "../integrations/shopify";
import { syncBestBuyOrders } from "../integrations/bestbuy";

export async function runFullSync(days = 7) {
  await Promise.all([
    syncShopifyOrders(days),
    syncBestBuyOrders(days),
  ]);
}
