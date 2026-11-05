/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pos: {
          primary: "rgb(var(--color-pos-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-pos-secondary) / <alpha-value>)",
          accent: "rgb(var(--color-pos-accent) / <alpha-value>)",
          "accent-2": "rgb(var(--color-pos-accent-2) / <alpha-value>)",
          danger: "rgb(var(--color-pos-danger) / <alpha-value>)",
          success: "rgb(var(--color-pos-success) / <alpha-value>)",
          warn: "rgb(var(--color-pos-warn) / <alpha-value>)",
          background: "rgb(var(--color-pos-background) / <alpha-value>)",
          surface: "rgb(var(--color-pos-surface) / <alpha-value>)",
          text: "rgb(var(--color-pos-text) / <alpha-value>)",
          muted: "rgb(var(--color-pos-muted) / <alpha-value>)",
          ring: "rgb(var(--color-pos-ring) / <alpha-value>)",
          "on-solid": "rgb(var(--color-pos-on-solid) / <alpha-value>)",
        },
      },
      borderRadius: {
        card: "18px",
        panel: "20px",
        control: "12px",
        pill: "999px",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        display: ["DM Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
