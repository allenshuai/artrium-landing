"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type ColorSchemeId = "default" | "scheme1" | "scheme2" | "scheme3";

type ColorScheme = {
  id: ColorSchemeId;
  background: string;
  logoText: string;
  paragraph: string;
};

const SCHEMES: Record<ColorSchemeId, ColorScheme> = {
  default: {
    id: "default",
    background: "#111111",
    logoText: "#FFF8F2",
    paragraph: "#FFF8F2",
  },
  scheme1: {
    id: "scheme1",
    background: "#FBF5AF",
    logoText: "#50918C",
    paragraph: "#2F4858",
  },
  scheme2: {
    id: "scheme2",
    background: "#F69C9F",
    logoText: "#FFE4E4",
    paragraph: "#2F4858",
  },
  scheme3: {
    id: "scheme3",
    background: "#A2DEF8",
    logoText: "#C5F9FF",
    paragraph: "#924468",
  },
};

type ColorSchemeContextValue = {
  schemeId: ColorSchemeId;
  scheme: ColorScheme;
  setSchemeId: (id: ColorSchemeId) => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const [schemeId, setSchemeId] = useState<ColorSchemeId>("default");
  const scheme = useMemo(() => SCHEMES[schemeId] ?? SCHEMES.default, [schemeId]);

  const value = useMemo(
    () => ({
      schemeId,
      scheme,
      setSchemeId,
    }),
    [schemeId, scheme]
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorScheme(): ColorSchemeContextValue {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) {
    return {
      schemeId: "default",
      scheme: SCHEMES.default,
      setSchemeId: () => {},
    };
  }
  return ctx;
}

