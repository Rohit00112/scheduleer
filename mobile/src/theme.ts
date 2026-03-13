import { Platform, type ViewStyle } from "react-native";

import type { Announcement } from "./types";

export type AccentTheme = {
  softBackground: string;
  softBorder: string;
  softText: string;
  solidBackground: string;
  solidText: string;
  gradient: [string, string, string];
};

export const palette = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  subtle: "#94a3b8",
  line: "#dbe4f0",
  panel: "#ffffff",
  surface: "#f3f7fb",
  page: "#eef4fb",
  shell: "#d8e7fb",
  accent: "#2458d3",
  accentDeep: "#102f72",
  accentSoft: "#dce8ff",
  success: "#0f9b6f",
  warning: "#b7791f",
  danger: "#c24141",
};

export const radii = {
  xl: 30,
  lg: 24,
  md: 18,
  sm: 14,
  pill: 999,
};

export const shadows: { card: ViewStyle; hero: ViewStyle } = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#10213e",
      shadowOpacity: 0.09,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    android: {
      elevation: 3,
    },
    default: {},
  }) || {},
  hero: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#0f172a",
      shadowOpacity: 0.16,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
    },
    android: {
      elevation: 5,
    },
    default: {},
  }) || {},
};

export function getClassTheme(classType: string): AccentTheme {
  switch (classType) {
    case "Lecture":
      return {
        softBackground: "#e8f0ff",
        softBorder: "#bdd2ff",
        softText: "#1847ad",
        solidBackground: "#2458d3",
        solidText: "#ffffff",
        gradient: ["#1c4ec0", "#2c7ff9", "#6eb7ff"],
      };
    case "Tutorial":
      return {
        softBackground: "#e7fbf3",
        softBorder: "#b9efd9",
        softText: "#107455",
        solidBackground: "#0f9b6f",
        solidText: "#ffffff",
        gradient: ["#0d7a59", "#17a87b", "#67d7aa"],
      };
    case "Workshop":
      return {
        softBackground: "#f5edff",
        softBorder: "#ddc5ff",
        softText: "#7143bf",
        solidBackground: "#8b52ec",
        solidText: "#ffffff",
        gradient: ["#6f3bd5", "#9f64ff", "#d1b1ff"],
      };
    default:
      return {
        softBackground: "#eff3f8",
        softBorder: "#d7deea",
        softText: "#475569",
        solidBackground: "#64748b",
        solidText: "#ffffff",
        gradient: ["#475569", "#64748b", "#94a3b8"],
      };
  }
}

export function getAnnouncementTheme(type: Announcement["type"]) {
  switch (type) {
    case "urgent":
      return {
        background: "#fff2f1",
        border: "#fec7c3",
        accent: "#dc4b3d",
      };
    case "warning":
      return {
        background: "#fff8eb",
        border: "#f3d38f",
        accent: "#b7791f",
      };
    default:
      return {
        background: "#edf4ff",
        border: "#bfd2fa",
        accent: "#2458d3",
      };
  }
}

export function getRoleGradient(role: "admin" | "user" | "instructor") {
  switch (role) {
    case "admin":
      return ["#102f72", "#2458d3", "#5ea4ff"] as const;
    case "instructor":
      return ["#0f4c4d", "#0f9b6f", "#68d7ac"] as const;
    default:
      return ["#3f3f8c", "#5968dd", "#9ea8ff"] as const;
  }
}
