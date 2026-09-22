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
        saque: "#3B82F6",
        recepcion: "#10B981",
        ataque: "#F97316",
        bloqueo: "#8B5CF6",
        defensa: "#F59E0B",
      },
    },
  },
  plugins: [],
};

export default config;