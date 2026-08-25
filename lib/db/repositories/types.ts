/**
 * The data boundary. Every screen reads THROUGH this interface —
 * nothing imports mock.ts or supabase.ts directly (index.ts selects
 * the backend from DATA_BACKEND). Swapping to live data in Phase 2
 * is one file, not a hunt.
 *
 * All money fields are integer cents.
 */

import type { AssetFormat, ProductStatus } from "../../../components/primitives/tokens";

export interface Creator {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  accent: "mint" | "butter" | "blush" | "lilac" | "sky";
  kycStatus: "none" | "pending" | "verified" | "restricted" | "rejected";
  payoutsPaused: boolean;
  restricted: boolean;
}

export interface Asset {
  id: string;
  title: string;
  format: AssetFormat;
  meta: string; // "2.4 MB" or "canva.com"
}

export interface Product {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description: string;
  kind: "single" | "bundle";
  priceCents: number;
  status: ProductStatus;
  reviewState: "pending" | "cleared" | "rejected";
  assets: Asset[];
  version: number;
  lifetimeSales: number;
  lifetimeRevenueCents: number;
  monthRevenueShare: number; // 0..100
  coverEmoji: string;
}

export interface OrderRow {
  id: string;
  dateLabel: string;
  productTitle: string;
  buyerEmailMasked: string;
  grossCents: number;
  processingCents: number;
  platformCents: number;
  creatorCents: number;
  state: "paid" | "refunded" | "disputed";
  source: string; // link label or "Direct"
}

export interface AttentionItem {
  id: string;
  title: string;
  line: string;
  actionLabel: string;
  actionHref: string;
  /** Ruling A1: butter = needs action, blush = blocking, sky = neutral FYI. */
  tone: "butter" | "blush" | "sky";
}

export interface ActivityItem {
  id: string;
  icon: string;
  primary: string;
  secondary: string;
  amountCents?: number;
}

export interface MonthStats {
  earnedCents: number;
  sales: number;
  buyers: number;
}

export interface CalendarDay {
  day: number;
  outsideMonth: boolean;
  isPayoutDay: boolean;
  hasSales: boolean;
}

export interface PayoutSummary {
  availableCents: number;
  clearingCents: number;
  clearingDateLabel: string;
  onHoldCents: number;
  nextPayoutDateLabel: string;
  monthLabel: string;
  calendar: CalendarDay[];
}

export interface PayoutHistoryRow {
  id: string;
  periodLabel: string;
  salesCents: number;
  referralCents: number;
  clawedCents: number;
  reserveHeldCents: number;
  reserveReleasedCents: number;
  netCents: number;
  state: "pending" | "confirmed" | "executing" | "sent" | "failed";
}

export interface TrafficLink {
  id: string;
  label: string;
  shortUrl: string;
  destination: string;
}

export interface SourceRow {
  source: string;
  visits: number | null;
  checkouts: number | null;
  sales: number;
  revenueCents: number;
  /** conversion in basis points (750 = 7.5%); null for Direct */
  conversionBps: number | null;
}

export interface CustomerRow {
  emailMasked: string;
  firstPurchaseLabel: string;
  purchases: number;
  lifetimeValueCents: number;
  productsOwned: string[];
}

export interface ReferralSummary {
  link: string;
  totalEarnedCents: number;
  referredCount: number;
  activeCount: number;
  thisMonthCents: number;
  rows: {
    creator: string;
    joinedLabel: string;
    theirSalesCents: number;
    platformRevenueCents: number;
    yourCutCents: number;
    monthsRemaining: number;
  }[];
}

export interface ReviewQueueItem {
  id: string;
  productTitle: string;
  creatorHandle: string;
  tier: "full" | "spot" | "auto";
  priceCents: number;
  assets: Asset[];
  safetyResults: { check: string; result: "pass" | "flag" | "fail"; detail: string }[];
  linkOnly: boolean;
}

export interface PurchaseVersion {
  version: number;
  changelog: string;
  dateLabel: string;
}

export interface Purchase {
  orderId: string;
  productTitle: string;
  creatorHandle: string;
  purchasedLabel: string;
  pricePaidCents: number;
  currentVersion: number;
  versions: PurchaseVersion[];
  assets: Asset[];
  refundable: boolean; // inside the 14-day window
  state: "paid" | "refunded";
}

export interface Repository {
  /** Buyer re-access (/access). Keyed by email; magic-link auth wraps this in Phase 2. */
  listPurchases(email: string): Promise<Purchase[]>;

  getCreatorByHandle(handle: string): Promise<Creator | null>;
  /** By id — the signed-in creator comes from the session interface (lib/auth), never from here. */
  getCreatorById(id: string): Promise<Creator | null>;

  listProducts(creatorId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  getStorefrontProduct(handle: string, slug: string): Promise<{ creator: Creator; product: Product } | null>;

  listOrders(creatorId: string): Promise<OrderRow[]>;
  listCustomers(creatorId: string): Promise<CustomerRow[]>;

  attention(creatorId: string): Promise<AttentionItem[]>;
  monthStats(creatorId: string): Promise<MonthStats>;
  recentActivity(creatorId: string): Promise<ActivityItem[]>;

  payoutSummary(creatorId: string): Promise<PayoutSummary>;
  listPayouts(creatorId: string): Promise<PayoutHistoryRow[]>;

  listLinks(creatorId: string): Promise<TrafficLink[]>;
  trafficBySource(creatorId: string): Promise<SourceRow[]>;
  trafficByContent(creatorId: string): Promise<SourceRow[]>;

  referralSummary(creatorId: string): Promise<ReferralSummary>;

  reviewQueue(): Promise<ReviewQueueItem[]>;
}
