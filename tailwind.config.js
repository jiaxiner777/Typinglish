/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Cascadia Mono", "SFMono-Regular", "Consolas", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 30px rgba(16, 185, 129, 0.22)"
      }
    }
  },
  plugins: []
};
