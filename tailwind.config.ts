import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#EEF4FF",
          100: "#D9E6FF",
          200: "#BCD4FF",
          500: "#2B5FC7",
          600: "#1E4BB3",
          700: "#163A85",
          800: "#0F285E",
          900: "#0A1B40",
        },
        saque: "#2563EB",
        recepcion: "#059669",
        ataque: "#EA580C",
        bloqueo: "#7C3AED",
        defensa: "#D97706",
      },
      boxShadow: {
        tactical: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        "tactical-lg": "0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
