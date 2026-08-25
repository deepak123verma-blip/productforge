import { createHash } from "node:crypto";

/**
 * Deterministic order id (ruling A2): uuidv5(payment_intent_id) in the
 * ProductForge namespace. Knowable BEFORE the order row exists, so
 * delivery tokens and emails can reference it directly, and replay is
 * idempotent by construction — the same payment intent always yields
 * the same UUID (orders.id is the primary key; a duplicate insert
 * conflicts instead of duplicating).
 */

/** Fixed namespace UUID — never change it; every historical order id derives from it. */
export const PRODUCTFORGE_ORDER_NAMESPACE = "8f8b5c1e-9a4d-4b6a-9d3e-2f1a7c5e0b42";

function uuidBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

/** RFC 4122 version-5 (SHA-1, name-based) UUID. */
export function uuidv5(name: string, namespace: string = PRODUCTFORGE_ORDER_NAMESPACE): string {
  const hash = createHash("sha1")
    .update(uuidBytes(namespace))
    .update(Buffer.from(name, "utf8"))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function orderIdForPaymentIntent(paymentIntentId: string): string {
  return uuidv5(paymentIntentId);
}
