import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "../store";

type ThemeSettings = {
  mode: "light" | "dark" | "system";
  accent: string;
  text: string;
  border: string;
  background: string;
};

interface ThemeContextProps {
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextProps | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useStore((s) => s.settings);
  const [theme, setTheme] = useState<ThemeSettings>(
    settings?.theme ?? {
      mode: "system",
      accent: "#2b86ac",
      text: "#17202b",
      border: "#e4e8ee",
      background: "#f6f8fa",
    },
  );

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      if (state.settings?.theme) {
        setTheme(state.settings.theme);
      }
    });
    return unsubscribe;
  }, []);

  // Determine resolved theme (light/dark) based on mode and system preference
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    if (theme.mode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () =>
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      update();
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    setResolvedTheme(theme.mode);
  }, [theme.mode]);

  // Apply theme CSS variables
  useEffect(() => {
    applyTheme(theme, resolvedTheme === "dark");
  }, [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: (patch) => setTheme((t) => ({ ...t, ...patch })),
        resolvedTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Utility function to convert hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Utility function to convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number): string => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Generate a shade scale from a base color
function generateShadeScale(baseHex: string): Record<number, string> {
  const { h, s, l } = hexToHsl(baseHex);
  const scale: Record<number, string> = {};

  // Generate shades from 50 to 900 in steps of 100
  for (let i = 50; i <= 900; i += 100) {
    // Lightness adjustment based on the scale
    let lightness = l;
    if (i <= 500) {
      // Lighter shades (50-500)
      lightness = l + ((500 - i) / 500) * (100 - l);
    } else {
      // Darker shades (600-900)
      lightness = l - ((i - 500) / 500) * l;
    }
    // Keep lightness in valid range
    lightness = Math.max(0, Math.min(100, lightness));
    scale[i] = hslToHex(h, s, lightness);
  }

  return scale;
}

// Apply theme CSS variables to document root
function applyTheme(theme: ThemeSettings, isDark: boolean): void {
  const root = document.documentElement;

  // Generate accent color scale (brand colors)
  const accentScale = generateShadeScale(theme.accent);

  const clamp = (v: number, lo: number, hi: number): number =>
    Math.min(hi, Math.max(lo, v));
  const text = hexToHsl(theme.text);
  const border = hexToHsl(theme.border);
  const bg = hexToHsl(theme.background);

  let ink: string;
  let ink2: string;
  let ink3: string;
  let line: string;
  let surface: string;
  let panel: string;

  if (isDark) {
    // Derive the dark palette from the user's hues so custom colors survive,
    // while lightness is forced into dark-mode ranges.
    surface = hslToHex(bg.h, bg.s, clamp(bg.l, 4, 14));
    panel = hslToHex(bg.h, bg.s, clamp(bg.l + 7, 10, 20));
    ink = hslToHex(text.h, clamp(text.s, 0, 25), clamp(text.l, 88, 97));
    ink2 = hslToHex(text.h, clamp(text.s, 0, 22), 72);
    ink3 = hslToHex(text.h, clamp(text.s, 0, 18), 55);
    line = hslToHex(border.h, border.s, clamp(border.l, 14, 26));
  } else {
    surface = theme.background;
    // Cards sit on the page background: slightly lighter in light mode.
    panel = hslToHex(bg.h, bg.s, clamp(bg.l + 3, 0, 100));
    ink = theme.text;
    const secondary =
      text.l > 50 ? clamp(text.l - 15, 0, 100) : clamp(text.l + 15, 0, 100);
    ink2 = hslToHex(text.h, text.s, secondary);
    ink3 = hslToHex(text.h, text.s, clamp(secondary + 15, 0, 100));
    line = theme.border;
  }

  const vars: Record<string, string> = {
    // Base colors
    "--color-ink": ink,
    "--color-ink-2": ink2,
    "--color-ink-3": ink3,
    "--color-line": line,
    "--color-surface": surface,
    "--color-panel": panel,

    // Brand/accent scale
    "--color-brand-50": accentScale[50],
    "--color-brand-100": accentScale[100],
    "--color-brand-200": accentScale[200],
    "--color-brand-300": accentScale[300],
    "--color-brand-400": accentScale[400],
    "--color-brand-500": accentScale[500],
    "--color-brand-600": accentScale[600],
    "--color-brand-700": accentScale[700],
    "--color-brand-800": accentScale[800],
    "--color-brand-900": accentScale[900],
  };

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
