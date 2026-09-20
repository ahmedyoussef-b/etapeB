/**
 * download-data.ts — Données de la page /download
 *
 * URLs des installateurs (GitHub Releases v1.0.0) + métadonnées.
 * À mettre à jour après chaque release.
 */

export interface Installer {
  os: "windows" | "macos" | "linux";
  label: string;
  version: string;
  size: number;
  sha256: string;
  url: string;
  format: string;
  instructions: string[];
}

export const APP_VERSION = "1.0.0";
export const RELEASE_DATE = "2026-09-17";
export const RELEASE_TAG = "v1.0.0";

export const INSTALLERS: Installer[] = [
  {
    os: "windows",
    label: "Windows",
    version: APP_VERSION,
    size: 12663873,
    sha256: "72d313943e95c516b87d0b28caa7a338586179f9470a2ced303d2e6093486ee1",
    url: "https://github.com/ahmedyoussef-b/etapeB/releases/download/v1.0.0/NexaFlow_1.0.0_x64_fr-FR.msi",
    format: "MSI",
    instructions: [
      "Télécharger le fichier .msi",
      "Double-cliquer sur le fichier pour lancer l'installation",
      "Suivre l'assistant d'installation (bouton Suivant → Installer → Terminer)",
      "Lancer NexaFlow depuis le menu Démarrer ou le bureau",
      "⚠️ Première ouverture : le wizard de configuration Groq s'affiche automatiquement",
    ],
  },
  {
    os: "windows",
    label: "Windows (NSIS)",
    version: APP_VERSION,
    size: 8662701,
    sha256: "84fa526c92cf846230a4ef960ed0fadea4384de89145557e8e261ed5c85aa913",
    url: "https://github.com/ahmedyoussef-b/etapeB/releases/download/v1.0.0/NexaFlow_1.0.0_x64-setup.exe",
    format: "EXE",
    instructions: [
      "Télécharger le fichier .exe",
      "Double-cliquer pour lancer l'installation",
      "Suivre l'assistant NSIS (bouton Suivant → Installer → Terminer)",
      "Lancer NexaFlow depuis le menu Démarrer ou le bureau",
      "⚠️ Première ouverture : le wizard de configuration Groq s'affiche automatiquement",
    ],
  },
  {
    os: "macos",
    label: "macOS",
    version: APP_VERSION,
    size: 0,
    sha256: "",
    url: "https://github.com/ahmedyoussef-b/etapeB/releases/download/v1.0.0/NexaFlow_1.0.0_x64.dmg",
    format: "DMG",
    instructions: [
      "Télécharger le fichier .dmg",
      "Ouvrir le fichier .dmh",
      "Glisser l'icône NexaFlow dans le dossier Applications",
      "Lancer NexaFlow depuis le Launchpad ou le dossier Applications",
      "⚠️ Première ouverture : le wizard de configuration Groq s'affiche automatiquement",
      "⚠️ macOS : si l'ouverture échoue, aller dans Préférences Système → Sécurité → Ouvrir quand même",
    ],
  },
  {
    os: "linux",
    label: "Linux",
    version: APP_VERSION,
    size: 0,
    sha256: "",
    url: "https://github.com/ahmedyoussef-b/etapeB/releases/download/v1.0.0/NexaFlow_1.0.0.AppImage",
    format: "AppImage",
    instructions: [
      "Télécharger le fichier .AppImage",
      "Rendre exécutable : chmod +x NexaFlow_*.AppImage",
      "Double-cliquer pour lancer (ou ./NexaFlow_*.AppImage dans un terminal)",
      "⚠️ Première ouverture : le wizard de configuration Groq s'affiche automatiquement",
      "⚠️ Si l'AppImage dépend de libfuse, installer : sudo apt install fuse",
    ],
  },
];

export function getInstallerForOS(os: string): Installer | null {
  return INSTALLERS.find((i) => i.os === os) || null;
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "En cours";
  const units = ["B", "KB", "MB", "GB"];
  const size = Math.log(bytes) / Math.log(1024);
  return `${(bytes / Math.pow(1024, Math.floor(size))).toFixed(1)} ${units[Math.floor(size)]}`;
}