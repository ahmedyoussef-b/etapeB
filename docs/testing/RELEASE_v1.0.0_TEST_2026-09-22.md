# Test Release v1.0.0 — Depuis GitHub

**Date** : 2026-09-22
**Release** : https://github.com/ahmedyoussef-b/etapeB/releases/tag/v1.0.0
**Tag commit** : c336f87

## Binaires téléchargés

| Fichier | Taille | SHA-256 |
|---|---|---|
| NexaFlow_1.0.0_x64_fr-FR.msi | 13 728 439 octets | 24B5924F67227D33125D60235346F74831A18620410B2FCB2678ADC448E24F33 |
| NexaFlow_1.0.0_x64-setup.exe | 9 624 960 octets | A358B7C13C2901BB2E296A5A44DDF68E38741E26FE15FB8AB01A06BC3AAA611E |

## Résultats des 10 tests

| # | Test | Résultat | Notes |
|---|---|---|---|
| 1 | Console | ✅ | 0 erreur critique au lancement |
| 2 | Login | ⚠️ | Session auto-restaurée (admin@nexaflow.local) ; GUI non vérifié |
| 3 | BDD locale | ✅ | Arborescence créée : 9 dossiers dans repository/ |
| 4 | BDD web | ⚠️ | Non vérifié (nécessite connexion réseau + GUI) |
| 5 | Preview JSON | ✅ | `system/snapshots/initial-snapshot.json` présent ; Preview GUI non vérifié |
| 6 | Sync depuis Web | ⚠️ | Non vérifié (nécessite GUI + serveur web) |
| 7 | Chat IA | ⚠️ | Non vérifié (nécessite GUI + clé Groq) |
| 8 | Supervision | ⚠️ | Non vérifié (nécessite GUI) |
| 9 | Upload | ⚠️ | Non vérifié (nécessite GUI) |
| 10 | Désinstallation | ⚠️ | Dossier `C:\Program Files\NexaFlow` verrouillé par Windows ; désinstallation manuelle requise |

## Bugs détectés

- **Mineur** : `initial-snapshot_duplicates/` absent du MSI alors qu'il existe en dev
  - Cause : le dossier a été ajouté à `.data/` après le build MSI de 09:49
  - Impact : aucun pour les fonctionnalités principales
  - Fix : rebuild MSI + release patch v1.0.1 si nécessaire

## Verdict

- [ ] ✅ Release v1.0.0 validée
- [x] 🟠 Bugs mineurs
- [ ] 🔴 Bugs critiques

## Prérequis pour validation complète

Les tests 2, 4, 6, 7, 8, 9 nécessitent une vérification manuelle via l'interface graphique :
1. Lancer `nexaflow.exe`
2. Ouvrir F12 pour vérifier la console
3. Tester login, BDD, sync, chat, supervision, upload
