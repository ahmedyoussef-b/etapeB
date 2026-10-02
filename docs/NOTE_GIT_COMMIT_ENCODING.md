# Note : encodage des messages de commit Git sous PowerShell 5.1

## Problème

- PowerShell 5.1 transmet les arguments de `git commit` en Windows-1252 par défaut.
- Conséquence : caractères accentués dans les messages Git illisibles ou corrompus.

## Symptôme

- `git log` affiche des séquences mojibake à la place des accents.
- Le fichier `.git/COMMIT_EDITMSG` est corrompu.

## Solution adoptée (S19)

- Translittération systématique des messages Git en ASCII pur.
- Exemples : `etait`, `Regle`, `Ref.`, `initialise`.
- Applicable à tous les messages de commit.

## Alternatives

1. `git commit -F <fichier>` avec fichier écrit en UTF-8 strict.
2. `git commit --cleanup=verbatim -F <fichier>` avec fichier écrit en UTF-8 strict.
   (Note : `i18n.commitEncoding` est une config de lecture pour `git log`, pas une
   config d'écriture — elle n'affecte pas l'encodage des messages transmis à
   `git commit`.)
3. `git config --global i18n.commitEncoding utf-8` (lecture `git log` uniquement).

## Recommandation

- Translittération par défaut (rapide, fiable, pas de dépendance externe).
- Toute exception doit être documentée dans le message de commit lui-même.
- Cette recommandation est valable pour la session S19 et les suivantes.
- Elle ne remet pas en cause les messages de commit antérieurs (S10-S18),
  qui peuvent contenir du mojibake — un audit rétroactif n'est pas planifié.

## Références

- INCIDENT_V3_SESSION19_ENCODING.md.
- INCIDENT_2026-10-02.md (contexte S18 : 3 commits non autorisés, 13 écarts de verbatim).
- SESSION_STATE_2026-10-01.md (section Session 18, section Session 19 à venir).