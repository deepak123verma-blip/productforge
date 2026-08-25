"use client";

import { useMemo, useState } from "react";
import { Money } from "../primitives/Money";
import { Table } from "../primitives/Table";
import type { OrderRow } from "../../lib/db/repositories/types";

const stateLabel: Record<OrderRow["state"], string> = {
  paid: "Paid",
  refunded: "Refunded",
  disputed: "Disputed",
};

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function centsToCsv(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negative ? `-${s}` : s; // plain hyphen in CSV: spreadsheets don't parse U+2212
}

function exportCsv(rows: OrderRow[]): void {
  const header = ["Date", "Product", "Buyer", "Gross", "Processing", "Platform fee", "Your earnings", "Status", "Source"];
  const lines = [
    header.join(","),
    ...rows.map((o) =>
      [
        o.dateLabel,
        csvCell(o.productTitle),
        o.buyerEmailMasked,
        centsToCsv(o.grossCents),
        centsToCsv(-o.processingCents),
        centsToCsv(-o.platformCents),
        centsToCsv(o.creatorCents),
        o.state,
        csvCell(o.source),
      ].join(",")
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "productforge-sales.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Filterable sales table with CSV export; rows expand to the order's full ledger view. */
export function SalesTable({ orders }: { orders: OrderRow[] }) {
  const [product, setProduct] = useState("all");
  const [source, setSource] = useState("all");
  const [state, setState] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  const products = useMemo(() => [...new Set(orders.map((o) => o.productTitle))], [orders]);
  const sources = useMemo(() => [...new Set(orders.map((o) => o.source))], [orders]);

  const rows = orders.filter(
    (o) =>
      (product === "all" || o.productTitle === product) &&
      (source === "all" || o.source === source) &&
      (state === "all" || o.state === state)
  );

  const selectCls =
    "h-11 rounded-field bg-surface-sunk px-tight text-body-s text-ink";

  return (
    <div className="flex flex-col gap-gap">
      <div className="flex flex-wrap items-end gap-tight">
        <label className="flex flex-col gap-1 text-body-s font-medium text-ink">
          Product
          <select className={selectCls} value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="all">All products</option>
            {products.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-body-s font-medium text-ink">
          Source
          <select className={selectCls} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            {sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-body-s font-medium text-ink">
          Status
          <select className={selectCls} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
            <option value="disputed">Disputed</option>
          </select>
        </label>
        <span className="ml-auto flex items-center gap-tight text-body-s text-ink-3">
          {rows.length} orders
          <button
            type="button"
            onClick={() => exportCsv(rows)}
            className="h-11 rounded-chip bg-surface-sunk px-gap text-body-s font-medium text-ink"
          >
            Export CSV
          </button>
        </span>
      </div>

      <Table
        caption="Sales"
        headers={["Date", "Product", "Buyer", "Gross", "Processing", "Platform fee", "Your earnings", "Status", "Source"]}
      >
        {rows.map((o) => (
          <SalesRow key={o.id} o={o} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} />
        ))}
      </Table>
    </div>
  );
}

function SalesRow({ o, open, onToggle }: { o: OrderRow; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className={`cursor-pointer border-b border-hairline ${o.state === "refunded" ? "bg-blush" : o.state === "disputed" ? "bg-butter" : ""}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        aria-expanded={open}
      >
        <td className="whitespace-nowrap px-tight py-tight">{o.dateLabel}</td>
        <td className="px-tight py-tight">{o.productTitle}</td>
        <td className="whitespace-nowrap px-tight py-tight">{o.buyerEmailMasked}</td>
        <td className="px-tight py-tight"><Money cents={o.grossCents} /></td>
        <td className="px-tight py-tight"><Money cents={-o.processingCents} /></td>
        <td className="px-tight py-tight"><Money cents={-o.platformCents} /></td>
        <td className="px-tight py-tight"><Money cents={o.creatorCents} /></td>
        <td className="px-tight py-tight">{stateLabel[o.state]}</td>
        <td className="whitespace-nowrap px-tight py-tight">{o.source}</td>
      </tr>
      {open && (
        <tr className="border-b border-hairline bg-surface-sunk">
          <td colSpan={9} className="px-tight py-tight">
            <div className="flex flex-col gap-1 text-body-s text-ink-2">
              <span>Order {o.id} — full ledger</span>
              <span>Sale credited: <Money cents={o.creatorCents} /></span>
              {o.state === "refunded" && <span>Refund debited: <Money cents={-o.creatorCents} /></span>}
              {o.state === "disputed" && <span>Dispute debited (incl. $15.00 fee): <Money cents={-(o.creatorCents + 1500)} /></span>}
              <span className="text-ink-3">Delivery evidence and receipts attach here once live data exists.</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
