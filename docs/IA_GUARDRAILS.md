# 🛡️ Garde-fous IA — NexaFlow

## État stable de référence

- **Tag Git** : `stable-dev-v1`
- **Snapshot** : `backups/stable-dev-v1/`
- **État** : Tree Local + Web fonctionnels en dev

## Règles ABSOLUES

### 🚫 Interdictions
1. NE JAMAIS modifier un fichier critique sans validation utilisateur préalable
2. NE JAMAIS faire `git checkout -- .`, `git reset --hard`, `git clean -fdx`
3. NE JAMAIS supprimer le tag `stable-dev-v1`
4. NE JAMAIS push sans `git fetch origin main` préalable
5. NE JAMAIS commiter sans avoir testé (`tsc` + `lint` minimum)

### ✅ Obligations
1. TOUJOURS faire un backup `.bak` avant modification
2. TOUJOURS inspecter (lecture seule) avant de modifier
3. TOUJOURS rapporter le diff VERBATIM après modification
4. TOUJOURS demander validation utilisateur entre chaque étape
5. TOUJOURS vérifier que `tsc` + `lint` passent avant commit

## Fichiers critiques (NE PAS toucher sans validation explicite)

- `src/components/structure/database-tree.tsx`
- `src/app/api/structure/route.ts`
- `src/app/api/admin/reset/route.ts`
- `src/lib/database/local-adapter.ts`
- `src/lib/database/web-adapter.ts`
- `src/lib/database/prisma-adapter.ts`
- `src/lib/api/local-first.ts`
- `src-tauri/src/structure.rs`
- `src-tauri/src/injector.rs`
- `lib/seed-data.ts`
- `scripts/bundle-seed-data.ts`
- `prisma/seed-from-repertoire.ts`

## En cas de problème

1. STOPPER immédiatement
2. Rapporter le problème à l'utilisateur
3. NE PAS tenter de fixer seul
4. Proposer un rollback :
   ```powershell
   git checkout stable-dev-v1 -- <fichier>
   ```

## Checklist avant CHAQUE modification

- [ ] J'ai lu le fichier concerné en entier
- [ ] J'ai compris l'impact de ma modification
- [ ] J'ai un backup (`.bak`)
- [ ] Je vais demander validation AVANT de modifier
- [ ] Après modif : `tsc` OK, `lint` OK
- [ ] Je vais rapporter le diff VERBATIM

## Procédure de validation utilisateur

Format obligatoire pour toute proposition de modification :

```
📁 FICHIER : <path>
🎯 OBJECTIF : <1 phrase>
📊 IMPACT : <ce qui change>
⚠️ RISQUE : <ce qui peut casser>
🔄 ROLLBACK : git checkout stable-dev-v1 -- <path>
✅ DEMANDE : Valider ? (oui/non)
```
