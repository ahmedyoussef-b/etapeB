# Incidents S20.1

Consolidation des incidents de la session 20.1 (2026-10-03).
Format : identifiant, constat, cause racine, resolution, lecon.

Source primaire : prompt de passation S20.1 (section 8 + regles S20.1-1
et S20.1-5), valide par le superviseur S20.1 en fin de mandat.

---

## Contexte

La session 20.1 a ete marquee par un incident critique : l'outil
d'execution de l'IA interne produisait des sorties fictives (hash de
commit affiche sans que le commit existe reellement dans le depot).
Cet incident, denomme S20.1-1, a motive le basculement en mode manuel
humain obligatoire pour toutes les operations Git, et l'introduction
de la regle S20.1-1 (double verification des commits).

Quatre autres incidents, moins graves, ont ete detectes et resolus
durant la meme session.

---

## S20.1-1 - Commit fantome 63d5f44 (A2 initial)

- **Constat :** lors de l'etape A2 initiale, la commande git commit
  a affiche un hash (63d5f44) comme si le commit avait reussi, mais
  ce commit n'existait pas dans le depot reel (git log ne le montrait
  pas, git rev-parse HEAD ne le retournait pas).
- **Cause racine :** l'outil d'execution de l'IA interne produisait des
  sorties fictives (hash affiche sans ecriture reelle dans .git).
- **Resolution :** bascule definitive en mode manuel humain pour toutes
  les operations Git (fenetre PowerShell manuelle), et introduction de
  la regle S20.1-1 (double verification git rev-parse HEAD =
  Get-Content .git\refs\heads\main).
- **Lecon :** ne jamais confier l'execution Git a l'IA interne. Toute
  operation Git est executee par l'humain, et tout commit est verifie
  par double source.

---

## S20.1-2 - Working tree divergent

- **Constat :** apres des commits reputes reussis, git status montrait
  encore des fichiers modifies dans le working tree (2 fichiers). Le
  working tree n'etait pas propre, alors que les commits annonces
  auraient du le nettoyer.
- **Cause racine :** les commits annonces etaient en realite fictifs
  (voir S20.1-1). Les fichiers n'avaient jamais ete committes.
- **Resolution :** re-commit manuel des fichiers concernes par l'humain,
  verification double source apres chaque commit.
- **Lecon :** un working tree non propre apres un commit annonce est un
  signal d'alerte. Toujours verifier git status apres un commit.

---

## S20.1-3 - Ecart de methode A3.2

- **Constat :** lors de l'etape A3.2 (ajout section S20 a
  SESSION_STATE_2026-10-01.md), l'outil edit a ete utilise au lieu
  du script PowerShell inline valide par le superviseur.
- **Cause racine :** non-respect de la methode validee pour l'ecriture
  de fichiers. L'outil edit ne garantit pas l'encodage UTF-8 strict
  ni l'usage de chemins absolus.
- **Resolution :** ecriture refaite avec
  [System.IO.File]::WriteAllText + chemin absolu +
  UTF8Encoding(false).
- **Lecon :** une seule methode par etape. Toute alternative doit etre
  soumise a validation superviseur avant execution.

---

## S20.1-4 - Inversions de role superviseur/executeur (5 occurrences)

- **Constat :** 5 occurrences d'inversion de role detectees durant la
  session 20.1, aux etapes V2, V3, V6, A1, A2. L'executant a pris des
  decisions relevant du superviseur (choix d'option, validation de
  contenu) sans feu vert explicite.
- **Cause racine :** confusion entre role de proposition (IA interne)
  et role de validation (superviseur).
- **Resolution :** rappel strict du protocole. Le role de validation
  appartient au superviseur ; l'humain et l'IA interne ne formulent pas
  la validation a sa place.
- **Lecon :** l'executant propose, le superviseur valide. Aucune
  decision d'option ou de contenu sans feu vert superviseur explicite.

---

## S20.1-5 - Chemins relatifs .NET sous PowerShell 5.1

- **Constat :** les appels [System.IO.File]::ReadAllBytes("fichier")
  et [System.IO.File]::WriteAllText("fichier", ...) avec un chemin
  relatif echouent sous PowerShell 5.1. Le fichier est cherche dans
  C:\WINDOWS\system32 au lieu du repertoire courant PowerShell.
- **Cause racine :** sous PowerShell 5.1, les methodes statiques .NET
  n'utilisent pas le repertoire courant PowerShell pour resoudre les
  chemins relatifs. Elles utilisent le repertoire de travail du
  processus, qui est C:\WINDOWS\system32 pour les assemblies systeme.
- **Resolution :** utiliser systematiquement des chemins absolus pour
  [System.IO.File], par exemple
  C:\ahmed\ETAPE-B-CCP\app\src\lib\ai\rag-search.ts.
- **Lecon :** regle S20.1-5 - chemins absolus obligatoires pour
  [System.IO.File] sous PowerShell 5.1.

---

## Regles heritees de S20.1

Les incidents ci-dessus ont motive deux regles applicables a toutes les
sessions suivantes. Ces regles sont distinctes des incidents : les
incidents sont des faits (ce qui s'est passe), les regles sont des
prescriptions (ce qui doit etre applique).

| Regle | Description |
|---|---|
| Regle S20.1-1 | Tout commit doit etre verifie par double source : git rev-parse HEAD et Get-Content .git\refs\heads\main. Les deux doivent etre identiques. Sinon : incident. |
| Regle S20.1-5 | Sous PowerShell 5.1, [System.IO.File]::ReadAllBytes et ::WriteAllText n'utilisent pas le repertoire courant PowerShell. Toujours utiliser des chemins absolus (C:\ahmed\ETAPE-B-CCP\app\...). |

---

## Autres lecons S20.1 (rappels non numerotes)

- Ne jamais confier l'execution Git a l'IA interne.
- Toute alternative de methode doit etre soumise a validation superviseur
  avant execution.
- Le role de validation appartient au superviseur.
- Translitteration ASCII obligatoire pour les messages Git et les
  ecritures TypeScript (securite d'encodage).