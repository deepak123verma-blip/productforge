import { computeSplit } from "../../money/split";
import type {
  ActivityItem,
  Asset,
  AttentionItem,
  Creator,
  CustomerRow,
  MonthStats,
  OrderRow,
  PayoutHistoryRow,
  PayoutSummary,
  Product,
  ReferralSummary,
  Repository,
  ReviewQueueItem,
  SourceRow,
  TrafficLink,
} from "./types";

/**
 * In-memory fixtures, deterministic (seeded LCG — no Math.random so
 * server and client render identically). Used until Phase 2 wires
 * supabase.ts. Nothing outside lib/db/repositories imports this file.
 */

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s;
  };
}

// --- creators ---------------------------------------------------------

const maya: Creator = {
  id: "c-maya",
  handle: "maya",
  displayName: "Maya Lin",
  bio: "Instagram growth for indie makers. Kits, planners, and the systems behind 300k followers.",
  accent: "mint",
  kycStatus: "verified",
  payoutsPaused: false,
  restricted: false,
};
const noah: Creator = {
  id: "c-noah",
  handle: "noah",
  displayName: "Noah Reyes",
  bio: "Fitness coach. Practical home-training programs.",
  accent: "sky",
  kycStatus: "none", // new and unverified — drives the attention card
  payoutsPaused: false,
  restricted: false,
};
const rex: Creator = {
  id: "c-rex",
  handle: "rex",
  displayName: "Rex Odum",
  bio: "Trading templates.",
  accent: "butter",
  kycStatus: "verified",
  payoutsPaused: true,
  restricted: true,
};
const creators = [maya, noah, rex];

// --- products ---------------------------------------------------------

const pdf = (id: string, title: string, meta: string): Asset => ({ id, title, format: "pdf", meta });
const xlsx = (id: string, title: string, meta: string): Asset => ({ id, title, format: "xlsx", meta });
const link = (id: string, title: string, meta: string): Asset => ({ id, title, format: "link", meta });

const products: Product[] = [
  {
    id: "p-1", creatorId: maya.id, title: "30-Day Instagram Growth Kit", slug: "30-day-growth-kit",
    description: "Everything I use to plan a month of converting content: the planner, 100 tested hooks, the calendar, and my Canva pack.",
    kind: "single", priceCents: 2900, status: "live", reviewState: "cleared",
    assets: [
      pdf("a-1", "30-Day Planner", "2.4 MB"), pdf("a-2", "100 Reel Hooks", "1.1 MB"),
      xlsx("a-3", "Content Calendar", "180 KB"), link("a-4", "Canva Template Pack", "canva.com"),
      pdf("a-5", "Bonus Prompt Pack", "800 KB"),
    ],
    version: 3, lifetimeSales: 82, lifetimeRevenueCents: 237_800, monthRevenueShare: 64, coverEmoji: "📈",
  },
  {
    id: "p-2", creatorId: maya.id, title: "Reel Hooks Mini Pack", slug: "reel-hooks-mini",
    description: "25 hooks that stopped the scroll last quarter.",
    kind: "single", priceCents: 900, status: "live", reviewState: "cleared",
    assets: [pdf("a-6", "25 Hooks", "400 KB")],
    version: 1, lifetimeSales: 141, lifetimeRevenueCents: 126_900, monthRevenueShare: 22, coverEmoji: "🎬",
  },
  {
    id: "p-3", creatorId: maya.id, title: "Story Prompts — 90 Days", slug: "story-prompts",
    description: "A season of daily story prompts, organised by goal.",
    kind: "single", priceCents: 1500, status: "live", reviewState: "cleared",
    assets: [pdf("a-7", "Prompt Book", "1.6 MB"), xlsx("a-8", "Tracker", "90 KB")],
    version: 1, lifetimeSales: 37, lifetimeRevenueCents: 55_500, monthRevenueShare: 9, coverEmoji: "💬",
  },
  {
    id: "p-4", creatorId: maya.id, title: "Creator Starter Bundle", slug: "creator-starter-bundle",
    description: "The Growth Kit, the Mini Pack, and the Story Prompts together.",
    kind: "bundle", priceCents: 3900, status: "live", reviewState: "cleared",
    assets: [
      pdf("a-1", "30-Day Planner", "2.4 MB"), pdf("a-6", "25 Hooks", "400 KB"), pdf("a-7", "Prompt Book", "1.6 MB"),
    ],
    version: 1, lifetimeSales: 12, lifetimeRevenueCents: 46_800, monthRevenueShare: 5, coverEmoji: "🎁",
  },
  {
    id: "p-5", creatorId: maya.id, title: "Caption Formulas (draft)", slug: "caption-formulas",
    description: "Work in progress.",
    kind: "single", priceCents: 1200, status: "draft", reviewState: "pending",
    assets: [pdf("a-9", "Formulas v0", "300 KB")],
    version: 1, lifetimeSales: 0, lifetimeRevenueCents: 0, monthRevenueShare: 0, coverEmoji: "✍️",
  },
  {
    id: "p-6", creatorId: noah.id, title: "30-Day Home Fitness Kit", slug: "home-fitness-kit",
    description: "Workout plan, progress tracker, meal worksheet, grocery checklist.",
    kind: "single", priceCents: 1900, status: "live", reviewState: "pending",
    assets: [
      pdf("a-10", "Workout Plan", "3.2 MB"), xlsx("a-11", "Progress Tracker", "120 KB"),
      pdf("a-12", "Meal Worksheet", "700 KB"), pdf("a-13", "Grocery Checklist", "150 KB"),
    ],
    version: 1, lifetimeSales: 6, lifetimeRevenueCents: 11_400, monthRevenueShare: 100, coverEmoji: "🏋️",
  },
  {
    id: "p-7", creatorId: noah.id, title: "Mobility Reset (5 days)", slug: "mobility-reset",
    description: "Five short routines to undo desk posture.",
    kind: "single", priceCents: 500, status: "live", reviewState: "pending",
    assets: [pdf("a-14", "Routine Cards", "900 KB")],
    version: 1, lifetimeSales: 3, lifetimeRevenueCents: 1_500, monthRevenueShare: 0, coverEmoji: "🧘",
  },
  {
    id: "p-8", creatorId: noah.id, title: "Notion Meal Planner", slug: "notion-meal-planner",
    description: "A shared Notion template for weekly meal planning.",
    kind: "single", priceCents: 700, status: "draft", reviewState: "pending",
    assets: [link("a-15", "Notion Template", "notion.so")], // link-only: blocked until 3 cleared (DB-enforced)
    version: 1, lifetimeSales: 0, lifetimeRevenueCents: 0, monthRevenueShare: 0, coverEmoji: "🥗",
  },
  {
    id: "p-9", creatorId: rex.id, title: "Options Signals Sheet", slug: "options-signals",
    description: "Weekly signals spreadsheet.",
    kind: "single", priceCents: 4900, status: "restricted", reviewState: "rejected",
    assets: [xlsx("a-16", "Signals", "500 KB")],
    version: 1, lifetimeSales: 41, lifetimeRevenueCents: 200_900, monthRevenueShare: 0, coverEmoji: "📉",
  },
  {
    id: "p-10", creatorId: rex.id, title: "Chart Patterns Guide", slug: "chart-patterns",
    description: "60 annotated charts.",
    kind: "single", priceCents: 1900, status: "live", reviewState: "cleared",
    assets: [pdf("a-17", "Patterns", "8.4 MB")],
    version: 1, lifetimeSales: 22, lifetimeRevenueCents: 41_800, monthRevenueShare: 100, coverEmoji: "📊",
  },
  {
    id: "p-11", creatorId: maya.id, title: "Canva Cover Templates", slug: "canva-covers",
    description: "20 cover templates sized for product cards.",
    kind: "single", priceCents: 1100, status: "live", reviewState: "cleared",
    assets: [link("a-18", "Canva Pack", "canva.com"), pdf("a-19", "Usage Guide", "250 KB")],
    version: 1, lifetimeSales: 19, lifetimeRevenueCents: 20_900, monthRevenueShare: 0, coverEmoji: "🎨",
  },
  {
    id: "p-12", creatorId: maya.id, title: "Hashtag Research Sheet", slug: "hashtag-research",
    description: "My research spreadsheet with formulas intact.",
    kind: "single", priceCents: 800, status: "live", reviewState: "cleared",
    assets: [xlsx("a-20", "Research Sheet", "210 KB")],
    version: 1, lifetimeSales: 28, lifetimeRevenueCents: 22_400, monthRevenueShare: 0, coverEmoji: "#️⃣",
  },
];

// --- orders (deterministic ~200) --------------------------------------

const sourceLabels = ["Reel — 3 AI tools", "Story — Monday", "Bio link", "YouTube — tutorial", "Direct"];
const mayaProducts = products.filter((p) => p.creatorId === maya.id && p.status === "live");

function makeOrders(): OrderRow[] {
  const next = lcg(0x5eed);
  const out: OrderRow[] = [];
  const names = ["riya", "tom", "jess", "omar", "lena", "kofi", "ana", "petr", "sam", "yuki"];
  for (let i = 0; i < 200; i++) {
    const p = mayaProducts[next() % mayaProducts.length]!;
    const gross = p.priceCents;
    const processing = Math.floor((gross * 29) / 1000) + 30; // int-div style est. for fixtures
    const { creator, platform } = computeSplit(gross, processing);
    const fate = next() % 25;
    const day = 1 + (next() % 24);
    const name = names[next() % names.length]!;
    out.push({
      id: `o-${i}`,
      dateLabel: `${day} Aug`,
      productTitle: p.title,
      buyerEmailMasked: `${name.charAt(0)}••••@gmail.com`,
      grossCents: gross,
      processingCents: processing,
      platformCents: platform,
      creatorCents: creator,
      state: fate === 0 ? "refunded" : fate === 1 ? "disputed" : "paid",
      source: sourceLabels[next() % sourceLabels.length]!,
    });
  }
  return out.sort((a, b) => Number.parseInt(b.dateLabel) - Number.parseInt(a.dateLabel));
}
const orders = makeOrders();

// --- assembled view data ----------------------------------------------

const calendar = Array.from({ length: 35 }, (_, i) => ({
  day: i < 5 ? 27 + i : i - 4,
  outsideMonth: i < 5,
  isPayoutDay: i === 6, // Monday
  hasSales: i >= 5 && i % 3 !== 0,
}));

const mock: Repository = {
  async listPurchases(email) {
    if (!email.includes("@")) return [];
    // Any email works on fixtures — the same demo purchases come back.
    return [
      {
        orderId: "o-demo-1",
        productTitle: "30-Day Instagram Growth Kit",
        creatorHandle: "maya",
        purchasedLabel: "18 Aug",
        pricePaidCents: 2900,
        currentVersion: 3,
        versions: [
          { version: 3, changelog: "Added 20 new hooks and refreshed the calendar for autumn.", dateLabel: "22 Aug" },
          { version: 2, changelog: "Fixed a broken formula in the content calendar.", dateLabel: "9 Aug" },
          { version: 1, changelog: "First release.", dateLabel: "2 Aug" },
        ],
        assets: products.find((p) => p.id === "p-1")!.assets,
        refundable: true,
        state: "paid",
      },
      {
        orderId: "o-demo-2",
        productTitle: "Hashtag Research Sheet",
        creatorHandle: "maya",
        purchasedLabel: "2 Jul",
        pricePaidCents: 800,
        currentVersion: 1,
        versions: [{ version: 1, changelog: "First release.", dateLabel: "1 Jul" }],
        assets: products.find((p) => p.id === "p-12")!.assets,
        refundable: false, // outside the 14-day window
        state: "paid",
      },
    ];
  },
  async getCreatorByHandle(handle) {
    return creators.find((c) => c.handle === handle.toLowerCase()) ?? null;
  },
  async getCreatorById(id) {
    return creators.find((c) => c.id === id) ?? null;
  },
  async listProducts(creatorId) {
    return products.filter((p) => p.creatorId === creatorId);
  },
  async getProduct(id) {
    return products.find((p) => p.id === id) ?? null;
  },
  async getStorefrontProduct(handle, slug) {
    const creator = creators.find((c) => c.handle === handle.toLowerCase());
    if (!creator) return null;
    const product = products.find((p) => p.creatorId === creator.id && p.slug === slug);
    return product ? { creator, product } : null;
  },
  async listOrders(creatorId) {
    return creatorId === maya.id ? orders : [];
  },
  async listCustomers(creatorId) {
    if (creatorId !== maya.id) return [];
    const byBuyer = new Map<string, CustomerRow>();
    for (const o of orders) {
      if (o.state !== "paid") continue;
      const row = byBuyer.get(o.buyerEmailMasked);
      if (row) {
        row.purchases += 1;
        row.lifetimeValueCents += o.grossCents;
        if (!row.productsOwned.includes(o.productTitle)) row.productsOwned.push(o.productTitle);
      } else {
        byBuyer.set(o.buyerEmailMasked, {
          emailMasked: o.buyerEmailMasked,
          firstPurchaseLabel: o.dateLabel,
          purchases: 1,
          lifetimeValueCents: o.grossCents,
          productsOwned: [o.productTitle],
        });
      }
    }
    return [...byBuyer.values()].sort((a, b) => b.lifetimeValueCents - a.lifetimeValueCents);
  },
  async attention(creatorId) {
    const items: AttentionItem[] = [];
    if (creatorId === noah.id) {
      items.push({
        id: "att-kyc",
        title: "Finish verification",
        line: "Your earnings are adding up, but payouts can't start until your payout account is verified.",
        actionLabel: "Verify now",
        actionHref: "/settings",
        tone: "butter", // needs action, not urgent
      });
    }
    if (creatorId === maya.id) {
      items.push({
        id: "att-dispute",
        title: "A buyer disputed a sale",
        line: "Reel Hooks Mini Pack, $9.00 — we've assembled the delivery evidence. Nothing you need to do yet.",
        actionLabel: "See details",
        actionHref: "/sales",
        tone: "sky", // we're handling it — neutral FYI
      });
    }
    return items;
  },
  async monthStats(creatorId): Promise<MonthStats> {
    if (creatorId !== maya.id) return { earnedCents: 0, sales: 0, buyers: 0 };
    let earned = 0;
    let sales = 0;
    const buyers = new Set<string>();
    for (const o of orders) {
      if (o.state !== "paid") continue;
      earned += o.creatorCents;
      sales += 1;
      buyers.add(o.buyerEmailMasked);
    }
    return { earnedCents: earned, sales, buyers: buyers.size };
  },
  async recentActivity(): Promise<ActivityItem[]> {
    return [
      { id: "ac-1", icon: "💸", primary: "Sale — 30-Day Instagram Growth Kit", secondary: "2 minutes ago", amountCents: 2900 },
      { id: "ac-2", icon: "💸", primary: "Sale — Creator Starter Bundle", secondary: "1 hour ago", amountCents: 3900 },
      { id: "ac-3", icon: "🔗", primary: "Referral earnings — Noah's first sales", secondary: "Yesterday", amountCents: 68 },
      { id: "ac-4", icon: "↩️", primary: "Refund — Reel Hooks Mini Pack", secondary: "Yesterday", amountCents: -900 },
      { id: "ac-5", icon: "✅", primary: "Canva Cover Templates cleared review", secondary: "2 days ago" },
      { id: "ac-6", icon: "🏦", primary: "Payout sent", secondary: "Monday", amountCents: 38_412 },
      { id: "ac-7", icon: "💸", primary: "Sale — Hashtag Research Sheet", secondary: "Monday", amountCents: 800 },
      { id: "ac-8", icon: "🆕", primary: "Story Prompts — 90 Days went live", secondary: "Last week" },
    ];
  },
  async payoutSummary(): Promise<PayoutSummary> {
    return {
      availableCents: 41_260,
      clearingCents: 8_820,
      clearingDateLabel: "8 Sep",
      onHoldCents: 0,
      nextPayoutDateLabel: "Mon 31 Aug",
      monthLabel: "August",
      calendar,
    };
  },
  async listPayouts(): Promise<PayoutHistoryRow[]> {
    return [
      { id: "po-4", periodLabel: "18–24 Aug", salesCents: 41_890, referralCents: 68, clawedCents: 900, reserveHeldCents: 0, reserveReleasedCents: 0, netCents: 41_058, state: "pending" },
      { id: "po-3", periodLabel: "11–17 Aug", salesCents: 39_120, referralCents: 0, clawedCents: 708, reserveHeldCents: 0, reserveReleasedCents: 0, netCents: 38_412, state: "sent" },
      { id: "po-2", periodLabel: "4–10 Aug", salesCents: 27_310, referralCents: 0, clawedCents: 0, reserveHeldCents: 0, reserveReleasedCents: 4_500, netCents: 31_810, state: "sent" },
      { id: "po-1", periodLabel: "28 Jul–3 Aug", salesCents: 22_040, referralCents: 0, clawedCents: 1_566, reserveHeldCents: 2_204, reserveReleasedCents: 0, netCents: 18_270, state: "sent" },
    ];
  },
  async listLinks(): Promise<TrafficLink[]> {
    return [
      { id: "l-1", label: "Reel — 3 AI tools", shortUrl: "pf.link/go/reel-ai", destination: "/@maya/30-day-growth-kit" },
      { id: "l-2", label: "Story — Monday", shortUrl: "pf.link/go/story-mon", destination: "/@maya/reel-hooks-mini" },
      { id: "l-3", label: "Bio link", shortUrl: "pf.link/go/bio", destination: "/@maya" },
      { id: "l-4", label: "YouTube — tutorial", shortUrl: "pf.link/go/yt-tut", destination: "/@maya/30-day-growth-kit" },
    ];
  },
  async trafficBySource(): Promise<SourceRow[]> {
    return [
      { source: "Instagram", visits: 2740, checkouts: 96, sales: 61, revenueCents: 141_100, conversionBps: 222 },
      { source: "YouTube", visits: 890, checkouts: 9, sales: 2, revenueCents: 3_900, conversionBps: 22 },
      { source: "Direct", visits: null, checkouts: null, sales: 18, revenueCents: 35_100, conversionBps: null },
    ];
  },
  async trafficByContent(): Promise<SourceRow[]> {
    return [
      { source: "Reel — 3 AI tools", visits: 412, checkouts: 44, sales: 31, revenueCents: 60_400, conversionBps: 750 },
      { source: "Story — Monday", visits: 188, checkouts: 17, sales: 12, revenueCents: 23_400, conversionBps: 640 },
      { source: "Bio link", visits: 2140, checkouts: 61, sales: 44, revenueCents: 85_800, conversionBps: 210 },
      { source: "YouTube — tutorial", visits: 890, checkouts: 9, sales: 2, revenueCents: 3_900, conversionBps: 22 },
      { source: "Direct", visits: null, checkouts: null, sales: 18, revenueCents: 35_100, conversionBps: null },
    ];
  },
  async referralSummary(): Promise<ReferralSummary> {
    return {
      link: "productforge.com/r/maya",
      totalEarnedCents: 68,
      referredCount: 1,
      activeCount: 1,
      thisMonthCents: 68,
      rows: [
        {
          creator: "@noah",
          joinedLabel: "12 Aug",
          theirSalesCents: 12_900,
          platformRevenueCents: 1_360,
          yourCutCents: 68,
          monthsRemaining: 12,
        },
      ],
    };
  },
  async reviewQueue(): Promise<ReviewQueueItem[]> {
    return [
      {
        id: "rq-1", productTitle: "30-Day Home Fitness Kit", creatorHandle: "noah", tier: "full", priceCents: 1900,
        assets: products.find((p) => p.id === "p-6")!.assets,
        safetyResults: [
          { check: "Malware", result: "pass", detail: "4 files clean (VirusTotal)" },
          { check: "Integrity", result: "pass", detail: "types match magic bytes" },
          { check: "Prohibited content", result: "pass", detail: "classifier clean" },
          { check: "Risk claims", result: "flag", detail: "\"lose 5kg in 30 days\" in description" },
        ],
        linkOnly: false,
      },
      {
        id: "rq-2", productTitle: "Mobility Reset (5 days)", creatorHandle: "noah", tier: "full", priceCents: 500,
        assets: products.find((p) => p.id === "p-7")!.assets,
        safetyResults: [
          { check: "Malware", result: "pass", detail: "1 file clean" },
          { check: "Integrity", result: "pass", detail: "ok" },
          { check: "Prohibited content", result: "pass", detail: "clean" },
        ],
        linkOnly: false,
      },
      {
        id: "rq-3", productTitle: "Caption Formulas", creatorHandle: "maya", tier: "spot", priceCents: 1200,
        assets: products.find((p) => p.id === "p-5")!.assets,
        safetyResults: [
          { check: "Malware", result: "pass", detail: "clean" },
          { check: "Duplicate", result: "flag", detail: "62% simhash match with an existing catalogue item" },
        ],
        linkOnly: false,
      },
    ];
  },
};

export default mock;
