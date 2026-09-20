import React from "react";
import { Separator } from "@/components/ui/separator";

const CHANGELOG_ENTRIES = [
  {
    version: "1.0.0",
    date: "2026-09-17",
    items: [
      "Wizard de configuration Groq (première ouverture)",
      "RAG local + Groq (recherche sémantique)",
      "BDD locale + sync bidirectionnelle",
      "Structure BDD (arborescence locale / db / web)",
      "Sidebar dashboard avec navigation par rôle",
      "Chat IA avec outils",
      "Visioconférence intégrée",
      "Banque d'images",
    ],
  },
];

export function ChangelogSection() {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        Changelog
      </h3>
      {CHANGELOG_ENTRIES.map((entry) => (
        <div key={entry.version} className="rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-sm">v{entry.version}</span>
            <span className="text-xs text-muted-foreground">{entry.date}</span>
          </div>
          <Separator />
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {entry.items.map((item, i) => (
              <li key={i} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}