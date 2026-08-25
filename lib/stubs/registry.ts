/**
 * THE stub registry — every place the UI is complete but the action waits
 * on an external service. Phase 2 progress = this list emptying out.
 * Rendered at /kitchen-sink/stubs; each stub surface uses <NotYetWired>.
 */

export type BlockingService = "stripe" | "supabase" | "vercel" | "resend";

export const serviceLabel: Record<BlockingService, string> = {
  stripe: "Stripe",
  supabase: "Supabase",
  vercel: "Vercel Pro (crons + long functions + VirusTotal)",
  resend: "email (Resend)",
};

export interface StubEntry {
  id: string;
  surface: string; // where in the UI it lives
  action: string; // what the wired version does
  blockedOn: BlockingService[];
  clearsInPhase: 2 | 3 | 4 | 5 | 6;
  /**
   * "unwired": the logic is WRITTEN and tested offline — connecting the
   *            service is executor/plumbing work only.
   * "unwritten": logic doesn't exist yet.
   */
  status: "unwired" | "unwritten";
}

export const stubRegistry: StubEntry[] = [
  { id: "checkout", surface: "Product page — Buy button", action: "Create a Stripe Checkout Session and redirect", blockedOn: ["stripe"], clearsInPhase: 2, status: "unwired" },
  { id: "upload-storage", surface: "Create product — publish", action: "Write files to private storage and run the safety pipeline (pipeline + VT scanner written: lib/safety)", blockedOn: ["supabase", "vercel"], clearsInPhase: 2, status: "unwired" },
  { id: "auth", surface: "Login / callback / session", action: "Magic-link auth behind the session interface (lib/auth)", blockedOn: ["supabase"], clearsInPhase: 2, status: "unwired" },
  { id: "webhooks", surface: "/api/webhooks/stripe", action: "Handlers + executor + outbox drain written and e2e-tested (lib/executor); remaining: Supabase Store class + route + signature verify", blockedOn: ["stripe", "supabase"], clearsInPhase: 2, status: "unwired" },
  { id: "access-magic-link", surface: "/access — email step", action: "Send the magic link and verify it", blockedOn: ["supabase", "resend"], clearsInPhase: 2, status: "unwired" },
  { id: "refund", surface: "/access — refund action", action: "Issue the Stripe refund; handler + token revocation effects written", blockedOn: ["stripe"], clearsInPhase: 2, status: "unwired" },
  { id: "version-publish", surface: "Product editor — new version", action: "Persist the version and email past buyers the changelog", blockedOn: ["supabase", "resend"], clearsInPhase: 2, status: "unwired" },
  { id: "kyc-connect", surface: "Settings — payout account", action: "Stripe Connect Express onboarding and hosted bank management", blockedOn: ["stripe"], clearsInPhase: 2, status: "unwritten" },
  { id: "review-persist", surface: "Admin review queue — decisions", action: "Persist clear/restrict/remove and gate payouts", blockedOn: ["supabase"], clearsInPhase: 2, status: "unwritten" },
  { id: "delivery-routes", surface: "/api/d and /api/l — signed tokens", action: "JWT delivery + delivery_events logging", blockedOn: ["supabase"], clearsInPhase: 2, status: "unwritten" },
  { id: "payout-run", surface: "Payouts — statements & transfers", action: "Weekly run (preview logic written: payout-runner), confirmation UI, transfers", blockedOn: ["stripe", "supabase"], clearsInPhase: 3, status: "unwired" },
  { id: "link-tracking", surface: "Traffic — click capture", action: "Live /go/[slug] click events; matching written (lib/attribution)", blockedOn: ["supabase"], clearsInPhase: 4, status: "unwired" },
  { id: "referral-capture", surface: "Referrals — signup binding", action: "Capture /r/[handle] and bind referred_by at signup (DB triggers already enforce)", blockedOn: ["supabase"], clearsInPhase: 5, status: "unwritten" },
  { id: "generation", surface: "Create product — Make something new", action: "Guided package generation with the outline gate (Vercel Python/Node extended-duration functions)", blockedOn: ["vercel"], clearsInPhase: 6, status: "unwritten" },
];

export function getStub(id: string): StubEntry {
  const entry = stubRegistry.find((s) => s.id === id);
  if (!entry) throw new Error(`unknown stub id: ${id} — add it to lib/stubs/registry.ts`);
  return entry;
}

export function stubMessage(id: string): string {
  const entry = getStub(id);
  const services = entry.blockedOn.map((s) => serviceLabel[s]).join(" and ");
  return `Connects once ${services} ${entry.blockedOn.length > 1 ? "are" : "is"} set up`;
}
