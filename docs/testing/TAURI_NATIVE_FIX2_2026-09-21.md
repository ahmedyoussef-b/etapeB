# Test MSI — Fixes RuntimeDebug + fetch /api restants

**Date** : 2026-09-21
**Commit** : 1a128ab
**MSI** : NexaFlow_1.0.0_x64_fr-FR.msi
**Installation** : C:\Program Files\NexaFlow\nexaflow.exe — 21/09/2026 16:57:56

## Résultats

| Test | Résultat | Notes |
|---|---|---|
| RuntimeDebug invisible | | Bas droit : aucun panneau `[RuntimeDebug]` |
| Console propre | | F12 Console : 0 erreur React #425 / #418 / #423 / `Unexpected token '<'` |
| Pas de toasts au démarrage | | Aucun toast rouge "réinitialisation" / "synchronisation" |
| Login | | admin@nexaflow.local / Admin123! → dashboard |
| BDD locale + expansion | | Structure BDD → Local → Centrale s'expand sans erreur |
| BDD web | | Structure BDD → Web → arborescence |
| Sync | | Synchroniser depuis Web → toast vert/bleu, jamais rouge |
| Chat IA | | Chat IA → réponse Groq ou RAG local |

## Bugs restants
- [A compléter après tests]

## Verdict
- [ ] ✅ Validé → prêt pour release
- [ ] 🟠 Bugs mineurs
- [ ] 🔴 Bugs critiques
