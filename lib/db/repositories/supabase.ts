import type { Repository } from "./types";

/**
 * PHASE 2 — real backend. Every method throws until Supabase exists.
 * Filling this file in (and flipping DATA_BACKEND) is the entire swap.
 */

class NotImplementedError extends Error {
  constructor(method: string) {
    super(`supabase repository: ${method} is not implemented until Phase 2`);
  }
}

function todo(method: string): never {
  throw new NotImplementedError(method);
}

const supabase: Repository = {
  listPurchases: async () => todo("listPurchases"),
  getCreatorByHandle: async () => todo("getCreatorByHandle"),
  getCreatorById: async () => todo("getCreatorById"),
  listProducts: async () => todo("listProducts"),
  getProduct: async () => todo("getProduct"),
  getStorefrontProduct: async () => todo("getStorefrontProduct"),
  listOrders: async () => todo("listOrders"),
  listCustomers: async () => todo("listCustomers"),
  attention: async () => todo("attention"),
  monthStats: async () => todo("monthStats"),
  recentActivity: async () => todo("recentActivity"),
  payoutSummary: async () => todo("payoutSummary"),
  listPayouts: async () => todo("listPayouts"),
  listLinks: async () => todo("listLinks"),
  trafficBySource: async () => todo("trafficBySource"),
  trafficByContent: async () => todo("trafficByContent"),
  referralSummary: async () => todo("referralSummary"),
  reviewQueue: async () => todo("reviewQueue"),
};

export default supabase;
