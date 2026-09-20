/**
 * detect-os.ts — Détection de la plateforme de l'utilisateur
 *
 * Utilise navigator.userAgent + navigator.platform pour identifier
 * Windows, macOS, Linux, Android, iOS.
 */

export type OS = "windows" | "macos" | "linux" | "android" | "ios" | "unknown";

export function detectOS(): OS {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent || "";
  const platform = (navigator.platform || "").toLowerCase();

  // Ordre important : iOS avant macOS (UA contient "Macintosh" pour iOS)
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";

  if (platform.includes("mac") || ua.includes("Macintosh")) return "macos";
  if (platform.includes("win") || ua.includes("Windows")) return "windows";
  if (platform.includes("linux") || ua.includes("Linux")) return "linux";

  return "unknown";
}

export function getOSLabel(os: OS): string {
  const labels: Record<OS, string> = {
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    android: "Android",
    ios: "iOS",
    unknown: "Plateforme inconnue",
  };
  return labels[os] || os;
}

export function getOSIcon(os: OS): string {
  const icons: Record<OS, string> = {
    windows: "🪟",
    macos: "🍎",
    linux: "🐧",
    android: "🤖",
    ios: "📱",
    unknown: "❓",
  };
  return icons[os] || "❓";
}

export function isMobile(os: OS): boolean {
  return os === "android" || os === "ios";
}

export function isDesktop(os: OS): boolean {
  return os === "windows" || os === "macos" || os === "linux";
}