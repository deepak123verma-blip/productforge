"use client";

import { useState } from "react";
import QRCode from "qrcode";

/** Copy / QR / share for a tracked link — all offline-capable. */
export function LinkActions({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const fullUrl = url.startsWith("http") ? url : `https://${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (permissions) — select-and-copy fallback via prompt
      window.prompt("Copy your link:", fullUrl);
    }
  }

  async function toggleQr() {
    if (qr) {
      setQr(null);
      return;
    }
    const dataUrl = await QRCode.toDataURL(fullUrl, { margin: 1, width: 176 });
    setQr(dataUrl);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: label, url: fullUrl });
        return;
      } catch {
        // user cancelled — fine
        return;
      }
    }
    await copy();
  }

  const btn = "h-11 rounded-chip bg-surface px-tight text-body-s font-medium text-ink";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1" role="group" aria-label={`Actions for ${label}`}>
        <button type="button" onClick={copy} className={btn} aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={toggleQr} className={btn} aria-expanded={qr !== null}>
          QR
        </button>
        <button type="button" onClick={share} className={btn}>
          Share
        </button>
      </div>
      {qr && (
        // Plain <img> on purpose: the QR is a client-generated data URL,
        // which next/image can't optimise. Alt names the destination.
        <img src={qr} alt={`QR code for ${fullUrl}`} className="rounded-field bg-surface p-1" />
      )}
    </div>
  );
}
