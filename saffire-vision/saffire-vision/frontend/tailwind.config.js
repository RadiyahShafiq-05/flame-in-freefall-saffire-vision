module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#070b14",
        panel: "#0e1522",
        raised: "#141d2e",
        edge: "#1e2a3d",
        ink: "#e6edf7",
        muted: "#9aa8bd",
        faint: "#64748b",
        accent: "#22d3ee",
        "accent-2": "#3b82f6",
        ok: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
