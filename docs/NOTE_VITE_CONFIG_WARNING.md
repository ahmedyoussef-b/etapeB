# Note technique — Warning Vite config native

## 1. Contexte

Depuis Vitest 4, chaque exécution de `vitest run` affiche un warning :

```
[!] Your Vite config uses features that are unsupported by
`configLoader: 'native'`...
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

## 2. Origine

- Vite 8.2.2 + Vitest 4.1.11.
- `createNativeConfigCompatPlugin` de Vite détecte des incompatibilités
  ESM dans `vitest.config.ts` (imports ESM + __dirname).
- Le warning est émis au chargement de la configuration.

## 3. Investigation

| Option | Verdict |
|---|---|
| `configLoader: 'legacy'` | ❌ N'existe pas dans Vitest 4 |
| `configLoader: 'bundle'` (défaut) | ⚠️ Déjà utilisé |
| `configLoader: 'runner'` | ⚠️ Expérimental |
| `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` | ✅ Supporté, masque le warning |
| Renommer en `.mjs` | ❌ Risque de casser d'autres outils |
| `"type": "module"` dans package.json | ❌ Impact trop large |
| Downgrader Vitest | ❌ Perte de fonctionnalités |

## 4. Décision

**REPORT à session 19+ avec mandat humain.**

Le warning est purement informatif. Aucune correction propre n'existe.
La seule option est de masquer le warning via variable d'environnement,
ce qui n'apporte pas de valeur fonctionnelle.

## 5. Recommandations

- **Session 19+** : décider si l'ajout de
  `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` aux scripts `test` est
  justifié (gain cosmétique vs modification package.json).
- **En l'état** : accepter le warning. Aucune action.
- **Surveillance** : vérifier si une future version de Vitest/Vite
  propose une option de configuration native.

## 6. Références

- `node_modules/vitest/dist/node.d.ts:95-103` — option `configLoader`.
- `node_modules/vite/dist/node/chunks/node.js:36009` — message du warning.
- `node_modules/vite/dist/node/chunks/node.js:37048` — condition d'émission.
- Session 18 — investigation priorité #6.

## 7. Suivi

- [ ] Session 19+ : décision sur l'ajout de la variable d'environnement.
- [ ] Session 19+ : vérifier si Vitest/Vite propose une solution native.