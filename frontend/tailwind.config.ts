import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { 
        display: ["'Sora'","sans-serif"], 
        body: ["'DM Sans'","sans-serif"], 
        reading: ["'Literata'","Georgia","serif"], 
        mono: ["'JetBrains Mono'","monospace"],
        tech: ["'Orbitron'", "sans-serif"],
        techBody: ["'Rajdhani'", "sans-serif"],
        techMono: ["'Share Tech Mono'", "monospace"]
      },
      colors: {
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        card: { DEFAULT:"hsl(var(--card))", foreground:"hsl(var(--card-foreground))" },
        primary: { DEFAULT:"hsl(var(--primary))", foreground:"hsl(var(--primary-foreground))" },
        muted: { DEFAULT:"hsl(var(--muted))", foreground:"hsl(var(--muted-foreground))" },
        border: "hsl(var(--border))", input: "hsl(var(--input))",
        amber: { DEFAULT:"#F59E0B", light:"#FCD34D" },
        emerald: { DEFAULT:"#10B981", light:"#34D399" },
        cyan: { DEFAULT:"#06b6d4", light:"#67e8f9" },
        violet: { DEFAULT:"#8b5cf6", light:"#a78bfa" },
        coral: { DEFAULT:"#F87171" },
        midnight: { DEFAULT:"#0D1117", "50":"#1C2430" },
        slate: { DEFAULT:"#64748B", light:"#94A3B8", lighter:"#CBD5E1" },
      },
      boxShadow: {
        'neon-amber': '0 0 10px rgba(245, 158, 11, 0.5), 0 0 20px rgba(245, 158, 11, 0.3)',
        'neon-amber-lg': '0 0 15px rgba(245, 158, 11, 0.7), 0 0 30px rgba(245, 158, 11, 0.4)',
        'neon-cyan': '0 0 10px rgba(6, 182, 212, 0.5), 0 0 20px rgba(6, 182, 212, 0.3)',
        'neon-cyan-lg': '0 0 15px rgba(6, 182, 212, 0.7), 0 0 30px rgba(6, 182, 212, 0.4)',
        'neon-emerald': '0 0 10px rgba(16, 185, 129, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)',
        'neon-emerald-lg': '0 0 15px rgba(16, 185, 129, 0.7), 0 0 30px rgba(16, 185, 129, 0.4)',
        'neon-violet': '0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)',
        'neon-coral': '0 0 10px rgba(248, 113, 113, 0.5), 0 0 20px rgba(248, 113, 113, 0.3)',
      },
      borderRadius: { lg:"var(--radius)", md:"calc(var(--radius) - 2px)", sm:"calc(var(--radius) - 4px)" },
      keyframes: {
        "fade-in-up": { from:{ opacity:"0", transform:"translateY(12px)" }, to:{ opacity:"1", transform:"translateY(0)" } },
        "shine": { to: { backgroundPosition: "200% center" } },
        "float-up": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-40px)" }
        },
        "pulse-neon": {
          "0%, 100%": { boxShadow: "0 0 10px rgba(6, 182, 212, 0.5), 0 0 20px rgba(6, 182, 212, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(6, 182, 212, 0.8), 0 0 40px rgba(6, 182, 212, 0.5)" }
        },
        "shimmer": {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" }
        },
        "streak-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.1)", opacity: "0.8" }
        },
        "achievement-unlock": {
          "0%": { transform: "scale(0.5) rotateZ(-10deg)", opacity: "0" },
          "50%": { transform: "scale(1.1) rotateZ(5deg)" },
          "100%": { transform: "scale(1) rotateZ(0deg)", opacity: "1" }
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        }
      },
      animation: { 
        "fade-in-up":"fade-in-up 0.5s ease-out",
        "shine": "shine 3s linear infinite",
        "float-up": "float-up 1s ease-out forwards",
        "pulse-neon": "pulse-neon 2s ease-in-out infinite",
        "shimmer": "shimmer 3s linear infinite",
        "streak-pulse": "streak-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "achievement-unlock": "achievement-unlock 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "bounce-gentle": "bounce-gentle 1s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
