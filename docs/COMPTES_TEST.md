# Comptes Test — NexaFlow

## Avertissement

**Ces comptes sont destinés UNIQUEMENT à des fins de test et de démonstration.**

- Ne jamais utiliser en production.
- Mots de passe faibles (documentés ici).
- Exécution du script : S20+ avec mandat humain.

## Comptes disponibles

| Rôle | Email | Mot de passe | Dashboard |
|------|-------|--------------|-----------|
| Rondier | `rondier@test.nexaflow.local` | `TestRondier2026!` | `/rondier` |
| Chef de bloc | `chef-de-bloc@test.nexaflow.local` | `TestChefBloc2026!` | `/chef-de-bloc` |
| Chef de quart | `chef-de-quart@test.nexaflow.local` | `TestChefQuart2026!` | `/chef-de-quart` |

## Procédure de création (S20+)

1. Vérification visuelle Neon (projet `etapeB`, branche `production`).
2. Snapshot BDD avant création.
3. Exécution : `npx tsx scripts/seed-test-users.ts`.
4. Vérification : `SELECT email, role, active FROM users WHERE email LIKE '%test.nexaflow.local';`.
5. Snapshot BDD après création.
6. Documentation des résultats dans `SESSION_STATE`.

## Nettoyage

```sql
DELETE FROM users WHERE email LIKE '%test.nexaflow.local';
```

## Références

- `prisma/schema.prisma` — modèle `User` + enum `Role`.
- `src/lib/auth/options.ts` — configuration NextAuth (bcrypt).
- `scripts/seed-test-users.ts` — script de création.
- `USER_GUIDE.md` — guide utilisateur.
