# Incident V3 — Session 19 : encodage Windows-1252 du bloc Session 18 dans SESSION_STATE_2026-10-01.md

## Résumé

- Détection, diagnostic, résolution en S19.
- 2 commits : `ec965ec` (transcode) + `6b38277` (restauration).

## Contexte

- V3 survient après la S18, lors des vérifications préalables S19.
- Fichier concerné : `docs/SESSION_STATE_2026-10-01.md`.
- Règles activées : B2, B3, B4, surveillance ultra-stricte.

## Chronologie

1. V3 détecté (S19, vérification préalable n°3).
2. Diagnostic : bloc Session 18 en Windows-1252, préfixe UTF-8 valide.
3. Plan initial rejeté (destructeur : 51 U+FFFD irréversibles).
4. Plan corrigé validé : transcode direct au niveau octets.
5. Étapes 1.1 à 1.8 exécutées sous surveillance.

## Diagnostic technique

- Offset de frontière : 34728.
- Préfixe `0..34727` : UTF-8 valide, SHA256 `CC17632701E164E6D0E20E3B642260E72F0DBFEDFF2CC97E096FFD59D0502F9C`.
- Suffixe `34728..fin` : Windows-1252.
- Octets corrompus : `0x97`, `0xE9`, `0xE0`, `0xE8`, `0xC9`.
- CRLF : 102 CR introduits par `Add-Content`.

## Origine racine

- PowerShell 5.1 : `Get-Content` / `Add-Content` sans `-Encoding UTF8`.
- `temp_session18.md` créé/écrit en cp1252.
- `Add-Content` a propagé l'encodage dans `docs/SESSION_STATE_2026-10-01.md`.

## Propagation

- Commit `844719a` poussé sur `origin/main`.

## Finding secondaire : 14 checkmarks perdus

- Le glyphe `✅` (U+2705) n'existe pas en Windows-1252.
- Remplacé par `?` (0x3F) lors de l'écriture S18.
- 14 occurrences aux lignes 842-855.
- Perte irréversible par transcodage (information absente du fichier).
- Restauré en S19 depuis le verbatim S18 validé (arbitrage Option B).

## Résolution — Phase 1

- Commit `ec965ec` : transcode cp1252 -> UTF-8, 102 + / 102 -.
- Commit `6b38277` : restauration des 14 `✅`, 14 + / 14 -.
- Fichier final : UTF-8 strict, 904 lignes, 38928 octets, pas de BOM.

## Leçons

1. Toujours spécifier `-Encoding UTF8` dans PowerShell 5.1.
2. Jamais de `Add-Content` sans vérification d'encodage.
3. Translittération ASCII systématique des messages Git (risque mojibake).
4. Vérification UTF-8 stricte après toute écriture sur un fichier markdown critique.

## Références

- ADR 006 : dette structurelle Prisma + pgvector + HNSW (`docs/adr/006-prisma-pgvector-hnsw-structural-debt.md`).
- ADR 007 : bug withAuth async (`docs/adr/007-withauth-async-await.md`).
- NOTE_PRISMA_DOTENVX_LOGS.md (contexte PowerShell / dotenvx).
- NOTE_GIT_COMMIT_ENCODING.md (translittération Git).