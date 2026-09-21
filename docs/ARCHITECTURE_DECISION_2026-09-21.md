# Architecture Decision — Tauri-native migration

**Date** : 2026-09-21
**Commit** : f630a7b
**Tag** : before-tauri-native

## Contexte

NexaFlow est une app hybride Tauri + Next.js.
**Constat** : en mode MSI (Tauri packagé), l'app est partiellement cassée car elle appelle 36 endpoints `/api/*` qui n'existent pas (pas de serveur Next.js embarqué).

**Ratio** : 36 `fetch('/api/*')` vs 11 `invoke()` → architecture web-first.

## Décision

**Adopter la stratégie Tauri-native** :
- Convertir les 36 endpoints `/api/*` en commandes Rust Tauri
- Supprimer les `fetch('/api/*')` du frontend
- Le cloud (Vercel) reste pour : distribution + sync ponctuelle

## Justification

6 questions stratégiques → 6 OUI :
1. Fonctionner sans internet : OUI
2. Créer/modifier fichiers locaux : OUI
3. RAG local : OUI
4. Distribuée par MSI : OUI
5. Web = portail : NON
6. Cible Windows : OUI

## Plan de migration

| Phase | Contenu | Effort |
|---|---|---|
| 1 | Init & Sync | 1 jour |
| 2 | Admin | 1 jour |
| 3 | Upload & Pipeline | 1 jour |
| 4 | Procédures | 4h |
| 5 | Implante | 4h |
| 6 | Nettoyage frontend | 4h |
| 7 | Tests MSI | 4h |

**Total** : ~3 jours.

## Point de retour

- Tag : `before-tauri-native`
- Bundle : `before-tauri-native.bundle`
- Commit : `f630a7b`

## Alternatives rejetées

- **Hybride pragmatique** : 2 code paths = dette permanente
- **Abandonner Tauri** : perdre RAG local + BDD locale

## Conséquences

- L'app sera **100% autonome** en MSI
- Le code sera **cohérent** (une seule source de vérité : Rust)
- Les features web Vercel restent **intactes** (autre code path)
