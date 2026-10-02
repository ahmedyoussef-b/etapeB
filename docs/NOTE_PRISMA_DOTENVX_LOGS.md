# Note technique — Logs `injected env (N)` dans les commandes Prisma

## Contexte

Depuis l'adoption de Prisma 7.x, chaque commande CLI Prisma (`migrate`,
`status`, `db push`, etc.) affiche des logs du type :

◇ injected env (51) from .env // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (37) from .env.local // tip: ⌘ multiple files { path: ['.env.local', '.env'] }

## Origine

- Ces logs proviennent de `@dotenvx/dotenvx`, intégré en dépendance
  transitive par Prisma 7.
- Prisma 7 invoque `dotenvx` en interne pour charger les fichiers `.env`
  et `.env.local`.
- `dotenvx` n'apparaît pas dans `package.json` (dépendance transitive).
- `prisma.config.ts` ne contrôle PAS ce mécanisme (en amont de sa lecture).

## Investigation (session 18)

Options étudiées et écartées :

| Option | Verdict |
|---|---|
| Variable `DOTENVX_QUIET` | N'existe pas dans `dotenvx` |
| Variable `DOTENVX_SILENT` | N'existe pas |
| Flag CLI `dotenvx --quiet` | Existe, mais non transmissible depuis `prisma.config.ts` |
| Wrapper `dotenvx run --quiet -- prisma ...` | Techniquement possible, mais alourdit tous les scripts `db:*` |
| Patch `node_modules` | Non reproductible, perdu à `npm install` |
| Suppression des `dotenvConfig()` dans `prisma.config.ts` | Inefficace — les logs proviennent de Prisma CLI en amont |

## Décision

**Accepter ces logs comme comportement imposé par Prisma 7.**

Justification :
- Aucune valeur de secret exposée (seul le nombre de variables).
- Risque sécurité négligeable.
- Coût d'un wrapper disproportionné.
- Patch `node_modules` inacceptable.

## Recommandations

- **CI/CD** : filtrer les lignes contenant `injected env` si nécessaire
  (par exemple avec `grep -v "injected env"`).
- **Documentation** : ne pas signaler ces logs comme incident de sécurité.
- **Upgrade Prisma** : surveiller les futures versions majeures pour une
  éventuelle option de silence native.
- **Ne pas patcher `node_modules`.**

## Références

- `prisma.config.ts` — chargement `dotenv` (redondant avec Prisma CLI,
  mais conservé pour compatibilité Vercel).
- `node_modules/@dotenvx/dotenvx/src/cli/dotenvx.js:37` — option `--quiet`.
- `node_modules/@dotenvx/dotenvx/src/shared/logger.js` — `setLogLevel`.
- Session 18 — investigation menée par l'IA interne.
