import type { Config } from "tailwindcss";

/**
 * Maps Tailwind utilities onto the CSS custom properties in app/globals.css.
 * ONE SOURCE OF TRUTH: the CSS file. Never duplicate a hex or px value here.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      canvas: "var(--canvas)",
      surface: "var(--surface)",
      "surface-sunk": "var(--surface-sunk)",
      ink: "var(--ink)",
      "ink-2": "var(--ink-2)",
      "ink-3": "var(--ink-3)",
      mint: "var(--mint)",
      butter: "var(--butter)",
      blush: "var(--blush)",
      lilac: "var(--lilac)",
      sky: "var(--sky)",
      positive: "var(--positive)",
      warning: "var(--warning)",
      negative: "var(--negative)",
      hairline: "var(--hairline)",
      "ink-12": "var(--ink-12)",
    },
    borderRadius: {
      none: "0",
      panel: "var(--radius-panel)",
      "panel-sm": "var(--radius-panel-sm)",
      card: "var(--radius-card)",
      chip: "var(--radius-chip)",
      field: "var(--radius-field)",
      tile: "var(--radius-tile)",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      panel: "var(--shadow-panel)",
      lift: "var(--shadow-lift)",
    },
    fontFamily: {
      display: "var(--font-display)",
      body: "var(--font-body)",
      figures: "var(--font-figures)",
    },
    fontSize: {
      "display-xl": ["var(--text-display-xl)", "var(--leading-display-xl)"],
      "display-l": ["var(--text-display-l)", "var(--leading-display-l)"],
      "display-m": ["var(--text-display-m)", "var(--leading-display-m)"],
      "display-s": ["var(--text-display-s)", "var(--leading-display-s)"],
      body: ["var(--text-body)", "var(--leading-body)"],
      "body-s": ["var(--text-body-s)", "var(--leading-body-s)"],
      caption: ["var(--text-caption)", "var(--leading-caption)"],
      stat: ["var(--text-stat)", "var(--leading-stat)"],
    },
    extend: {
      height: {
        "stat-card": "var(--stat-card-h)",
      },
      minHeight: {
        "feature-card": "var(--feature-card-h)",
      },
      width: {
        rail: "var(--rail-w)",
        "mobile-frame": "var(--mobile-frame-w)",
      },
      maxWidth: {
        panel: "var(--panel-max-w)",
      },
      spacing: {
        // The 4px-based scale from the spec, plus the named gaps.
        tight: "var(--gap-tight)",
        gap: "var(--gap)",
        loose: "var(--gap-loose)",
        section: "var(--gap-section)",
      },
    },
  },
  plugins: [],
};

export default config;
