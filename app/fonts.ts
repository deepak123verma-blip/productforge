import { Bricolage_Grotesque, Space_Grotesk, Instrument_Sans } from "next/font/google";

/**
 * Three type roles (docs/03-UIUX-Design-Spec.md §2.3).
 * next/font self-hosts at build time — no runtime request.
 * Preload display and figures only; body swaps in.
 */

export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: true,
  variable: "--font-bricolage",
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  preload: true,
  variable: "--font-space-grotesk",
});

/**
 * TODO(fonts): TEMPORARY FALLBACK — the real body face is General Sans
 * (Fontshare, manual licence-gated download; see README "Fonts" and
 * docs/OPEN-QUESTIONS.md). Instrument Sans is a metric-similar grotesk
 * standing in so `pnpm build` never blocks on a manual download.
 * Swap back to next/font/local + app/fonts/general-sans/*.woff2 once the
 * files are in place.
 */
export const generalSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-general-sans",
});
