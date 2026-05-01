import { useColorScheme, View } from "react-native";
import { BlurView } from "expo-blur";
import React from "react";

export const ACCENT = "#1FA8E0";
export const ACCENT_2 = "#4F46E5";
export const GOOD = "#16A34A";
export const BAD = "#E11D48";
export const WARN = "#F59E0B";

export function useTheme() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  return {
    dark,
    bg: dark ? "#07090F" : "#F4F6FB",
    bgTint: dark ? "#0B1020" : "#EAF3FB",
    card: dark ? "rgba(22,28,46,0.92)" : "rgba(255,255,255,0.92)",
    cardBorder: dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.9)",
    shadow: dark ? "#000" : "#0F172A",
    text: dark ? "#F1F5F9" : "#0B1220",
    text2: dark ? "#B6C0D2" : "#4A5568",
    text3: dark ? "#6F7A91" : "#7A8499",
    divider: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)",
    neutralSoft: dark ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.14)",
    goodSoft: dark ? "rgba(34,197,94,0.18)" : "rgba(22,163,74,0.12)",
    badSoft: dark ? "rgba(244,63,94,0.18)" : "rgba(225,29,72,0.12)",
    warnSoft: dark ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.14)",
    accentSoft: dark ? "rgba(31,168,224,0.18)" : "rgba(31,168,224,0.12)",
    accent2Soft: "rgba(99,102,241,0.14)",
  };
}

export function GlassCard({ children, style, intensity = 60 }: {
  children?: React.ReactNode;
  style?: object;
  intensity?: number;
}) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const base = {
    borderRadius: 20,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: dark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.88)",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  };
  return React.createElement(
    BlurView,
    { intensity, tint: dark ? "dark" : "light", style: style ? { ...base, ...style as object } : base },
    children,
  );
}

export function BgBlobs() {
  return React.createElement(View, {
    pointerEvents: "none",
    style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" },
  },
    React.createElement(View, {
      style: {
        position: "absolute", top: -80, right: -60,
        width: 320, height: 320, borderRadius: 160,
        backgroundColor: "rgba(31,168,224,0.28)",
      },
    }),
    React.createElement(View, {
      style: {
        position: "absolute", bottom: -120, left: -80,
        width: 280, height: 280, borderRadius: 140,
        backgroundColor: "rgba(79,70,229,0.18)",
      },
    }),
  );
}
