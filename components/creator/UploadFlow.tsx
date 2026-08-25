"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../primitives/Button";
import { Field } from "../primitives/Field";
import { NotYetWired } from "../primitives/NotYetWired";
import { formatTile, type AssetFormat } from "../primitives/tokens";

/**
 * "Upload what you have" — the complete multi-asset flow (PRD §5.2):
 * drag-drop for many files at once, per-file progress, reorder/remove,
 * link assets, then title/description/price, then publish. Only the
 * storage write + safety-pipeline call are stubbed (registry:
 * "upload-storage") — progress here is simulated reads of the local file.
 */

interface StagedAsset {
  id: string;
  title: string;
  format: AssetFormat;
  meta: string;
  progress: number; // 0..100
  kind: "file" | "link";
}

function detectFormat(name: string): AssetFormat {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (["xlsx", "xls"].includes(ext)) return "xlsx";
  if (ext === "csv") return "csv";
  if (["zip", "rar", "7z"].includes(ext)) return "zip";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "img";
  return "zip";
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

let nextId = 0;

export function UploadFlow() {
  const [assets, setAssets] = useState<StagedAsset[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [published, setPublished] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => () => timers.current.forEach(clearInterval), []);

  const addFiles = useCallback((files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const id = `staged-${nextId++}`;
      setAssets((prev) => [
        ...prev,
        { id, title: file.name.replace(/\.[^.]+$/, ""), format: detectFormat(file.name), meta: formatSize(file.size), progress: 0, kind: "file" },
      ]);
      // Simulated per-file progress; the real write goes to private storage in Phase 2.
      const timer = setInterval(() => {
        setAssets((prev) =>
          prev.map((a) => (a.id === id && a.progress < 100 ? { ...a, progress: Math.min(100, a.progress + 20) } : a))
        );
      }, 180);
      timers.current.push(timer);
      setTimeout(() => clearInterval(timer), 1200);
    }
  }, []);

  function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    let host = "link";
    try {
      host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    } catch {
      return;
    }
    setAssets((prev) => [
      ...prev,
      { id: `staged-${nextId++}`, title: host.split(".")[0] ?? "Link", format: "link", meta: host, progress: 100, kind: "link" },
    ]);
    setLinkUrl("");
  }

  function move(id: string, dir: -1 | 1) {
    setAssets((prev) => {
      const i = prev.findIndex((a) => a.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(i, 1);
      copy.splice(j, 0, item!);
      return copy;
    });
  }

  const ready = assets.length > 0 && assets.every((a) => a.progress === 100);

  if (published) {
    return (
      <div className="rounded-card bg-mint p-loose">
        <h2 className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">Ready to publish</h2>
        <p className="mt-1 text-body text-ink-2">
          Your product is staged with {assets.length} {assets.length === 1 ? "asset" : "assets"}. The security scan runs
          and the product goes live the moment the live services connect.
        </p>
        <NotYetWired stubId="upload-storage" className="mt-tight" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop files here or press Enter to browse"
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-feature-card cursor-pointer flex-col items-center justify-center gap-1 rounded-card p-loose text-center ${
          dragOver ? "bg-lilac" : "bg-surface-sunk"
        }`}
      >
        <p className="text-body font-medium text-ink">Drop your files here</p>
        <p className="text-body-s text-ink-3">PDFs, spreadsheets, zips, images — as many as you like</p>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      <div className="flex items-end gap-tight">
        <div className="flex-1">
          <Field
            label="Or add a link asset"
            placeholder="canva.com/design/… or notion.so/…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            hint="Canva, Notion and Google links are delivered through a tracked gateway."
          />
        </div>
        <Button variant="secondary" onClick={addLink}>Add link</Button>
      </div>

      {assets.length > 0 && (
        <section aria-label="Assets" className="flex flex-col gap-tight">
          {assets.map((a, i) => (
            <div key={a.id} className="flex items-center gap-tight rounded-field bg-surface-sunk p-tight">
              <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-tile text-caption font-semibold uppercase text-ink ${formatTile[a.format]}`}>
                {a.format}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-ink">{a.title}</p>
                {a.progress < 100 ? (
                  <div role="progressbar" aria-valuenow={a.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${a.title}`} className="mt-1 h-1 w-full rounded-chip bg-ink-12">
                    <div className="h-1 rounded-chip bg-ink" style={{ width: `${a.progress}%` }} />
                  </div>
                ) : (
                  <p className="text-body-s text-ink-3">{a.meta}</p>
                )}
              </div>
              <button type="button" aria-label={`Move ${a.title} up`} disabled={i === 0} onClick={() => move(a.id, -1)} className="flex h-11 w-11 items-center justify-center text-ink-2 disabled:opacity-30">↑</button>
              <button type="button" aria-label={`Move ${a.title} down`} disabled={i === assets.length - 1} onClick={() => move(a.id, 1)} className="flex h-11 w-11 items-center justify-center text-ink-2 disabled:opacity-30">↓</button>
              <button type="button" aria-label={`Remove ${a.title}`} onClick={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))} className="flex h-11 w-11 items-center justify-center text-ink-2">✕</button>
            </div>
          ))}
        </section>
      )}

      <section aria-label="Details" className="flex max-w-lg flex-col gap-gap">
        <Field label="Title" placeholder="30-Day Growth Kit" />
        <Field label="Description" placeholder="What buyers get and why it works." />
        <Field label="Price" placeholder="19" hint="Minimum $5.00" inputMode="numeric" />
      </section>

      <div className="flex items-center gap-tight">
        <Button disabled={!ready} onClick={() => setPublished(true)}>Publish</Button>
        {!ready && assets.length > 0 && <span className="text-body-s text-ink-3">Waiting for uploads to finish…</span>}
        {assets.length === 0 && <span className="text-body-s text-ink-3">Add at least one asset to publish.</span>}
      </div>
    </div>
  );
}
