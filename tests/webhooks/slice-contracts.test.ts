import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sliceContracts } from "../../lib/stripe/slice-contracts";
import { orderIdForPaymentIntent, uuidv5 } from "../../lib/stripe/order-id";

const migrations = readdirSync("db/migrations")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join("db/migrations", f), "utf8"))
  .join("\n");

describe("state-slice contracts (ruling A3)", () => {
  for (const c of sliceContracts) {
    it(`${c.slice}.${c.field} → single indexed lookup on ${c.table}`, () => {
      // The table exists…
      expect(migrations).toMatch(new RegExp(`CREATE TABLE ${c.table}\\b`));
      // …and the exact index/constraint the contract names exists in the schema.
      if (c.index === "PRIMARY KEY") {
        expect(migrations).toMatch(new RegExp(`CREATE TABLE ${c.table}[\\s\\S]{0,400}PRIMARY KEY`));
      } else {
        // whitespace-insensitive: schema files align columns
        const pattern = c.index.trim().split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
        expect(migrations).toMatch(new RegExp(pattern));
      }
    });
  }
});

describe("deterministic order ids (ruling A2)", () => {
  it("the same payment intent produces the same UUID across runs", () => {
    const a = orderIdForPaymentIntent("pi_3ABCxyz");
    const b = orderIdForPaymentIntent("pi_3ABCxyz");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("different payment intents produce different UUIDs", () => {
    expect(orderIdForPaymentIntent("pi_A")).not.toBe(orderIdForPaymentIntent("pi_B"));
  });

  it("matches RFC 4122 v5 for a known vector", () => {
    // uuidv5(name='www.example.com', ns=DNS namespace) — the RFC's canonical example.
    expect(uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2"
    );
  });
});
