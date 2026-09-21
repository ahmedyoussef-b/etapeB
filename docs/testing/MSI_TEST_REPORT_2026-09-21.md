# Test Report — MSI NexaFlow v1.0.0

**Date** : 2026-09-21  
**Commit** : 2f75047  
**MSI** : NexaFlow_1.0.0_x64_fr-FR.msi  
**Taille** : 13.7 MB (13,679,287 bytes)  
**SHA-256** : B23C199B1A641A370F9D0E0F76096DCA8172F5261147412F4D3DF4C0FBEEA1A1

## Environnement
- **OS** : Windows (via PowerShell)
- **Architecture** : x64
- **Date de build** : 2026-09-21 10:25:55

---

## Résultats des vérifications automatisées

### ✅ Étape 1 — Vérification préalable
| Élément | Résultat | Détails |
|---|---|---|
| Branche Git | ✅ | `main` |
| HEAD commit | ✅ | `2f75047 chore(wix): rebuild template with current .data filesystem` |
| Working tree | ✅ | Clean |

### ✅ Étape 2 — Vérification du MSI
| Élément | Résultat | Détails |
|---|---|---|
| Fichier existe | ✅ | `src-tauri/target/release/bundle/msi/NexaFlow_1.0.0_x64_fr-FR.msi` |
| Taille | ✅ | 13,679,287 bytes (13.7 MB) |
| Date de génération | ✅ | 2026-09-21 10:25:55 |
| Hash SHA-256 | ✅ | `B23C199B1A641A370F9D0E0F76096DCA8172F5261147412F4D3DF4C0FBEEA1A1` |

### ✅ Étape 3 — État avant installation
| Élément | Résultat | Détails |
|---|---|---|
| Installations existantes | ✅ | Aucune installation NexaFlow trouvée |
| Registre HKLM | ✅ | Pas d'entrée NexaFlow |
| Registre HKCU | ✅ | Pas d'entrée NexaFlow |
| `C:\Program Files\NexaFlow\` | ✅ | N'existe pas |
| `%TEMP%\NexaFlow\` | ✅ | N'existe pas |

### ✅ Étape 4 — Installation du MSI
| Élément | Résultat | Détails |
|---|---|---|
| Exécution msiexec | ✅ | Succès (exit code 0) |
| Log d'installation | ✅ | Généré dans `%TEMP%\msi_install.log` |

### ✅ Étape 5 — VÉRIFICATION CRITIQUE — Chemin d'installation
| Élément | Résultat | Détails |
|---|---|---|
| `InstallLocation` registre | ✅ | `C:\Program Files\NexaFlow\` |
| Dossier `C:\Program Files\NexaFlow\` existe | ✅ | Oui |
| Dossier `%TEMP%\NexaFlow\` existe | ✅ | **N'existe pas** |

**Conclusion** : ✅ **Le fix Wix fonctionne** — l'application s'installe bien dans `C:\Program Files\NexaFlow\` et pas dans `%TEMP%`.

### ✅ Étape 6 — Contenu du dossier d'installation
| Élément | Présent | Taille | Détails |
|---|---|---|---|
| `nexaflow.exe` | ✅ | 37.6 MB (37,596,672 bytes) | Exécutable principal |
| `.data/` | ✅ | - | Données applicatives |
| `.data/Centrale/` | ✅ | - | Structure BDD locale |
| `.data/Groupes/` | ✅ | - | Groupes |
| `.data/indexes/` | ✅ | - | Index (procedures.json, teams.json, users.json) |
| `.data/library/` | ✅ | - | Bibliothèque de procédures |
| `.data/registry/` | ✅ | - | Données registry |
| `.data/system/` | ✅ | - | Système (snapshots) |
| `Uninstall NexaFlow.lnk` | ✅ | 949 bytes | Raccourci de désinstallation |

**Note** : Les DLLs Tauri/WebView2 sont embarquées dans l'exécutable ou chargées dynamiquement. Aucune DLL supplémentaire visible dans le dossier d'installation.

### ⏸️ Étape 7 — Lancement de l'application
**Statut** : ⏸️ **Non testé (nécessite interaction GUI)**

**Action requise** :
1. Double-cliquer sur `C:\Program Files\NexaFlow\nexaflow.exe`
2. Vérifier que l'application démarre et affiche une fenêtre

### ⏸️ Étape 8 — Wizard Groq (premier lancement)
**Statut** : ⏸️ **Non testé (nécessite interaction GUI)**

**Action requise** :
1. Lancer l'application
2. Si `%APPDATA%\NexaFlow\config.json` n'existe pas, vérifier que le wizard Groq apparaît
3. Vérifier les champs : `GROQ_API_KEY`, `GROQ_MODEL` (défaut: `openai/gpt-oss-120b`)
4. Valider et vérifier que `config.json` est créé

**Commande de vérification** :
```powershell
Test-Path "$env:APPDATA\NexaFlow\config.json"
Get-Content "$env:APPDATA\NexaFlow\config.json" | Select-String "setup_completed|groq_model"
```

### ⏸️ Étape 9 — Login
**Statut** : ⏸️ **Non testé (nécessite interaction GUI)**

**Action requise** :
1. Aller sur la page de login
2. Email : `admin@nexaflow.local`
3. Mot de passe : `Admin123!`
4. Vérifier la connexion réussit et redirection vers le dashboard

### ⏸️ Étape 10 — Page Structure BDD
**Statut** : ⏸️ **Non testé (nécessite interaction GUI)**

**Action requise** :
1. Aller sur **Structure BDD**
2. Vérifier que le bouton **Synchroniser depuis Web** est visible
3. Cliquer dessus
4. Observer la console (F12) pour les logs `[SyncFiles]`
5. Vérifier que `%APPDATA%\NexaFlow\repository\system\sync-index.json` est créé

**Commandes de vérification** :
```powershell
Test-Path "$env:APPDATA\NexaFlow\repository\system\sync-index.json"
Get-Content "$env:APPDATA\NexaFlow\repository\system\sync-index.json" | Select-Object -First 10
```

### ⏸️ Étape 11 — Page Supervision & Administration
**Statut** : ⏸️ **Non testé (nécessite interaction GUI)**

**Action requise** :
1. Aller sur **Supervision** (ou **Admin**)
2. Vérifier les 4 onglets : File de publication / Utilisateurs & Sync / Versions / Vectorisation
3. Dans **File de publication** : cliquer sur **Prévisualiser la purge**
4. Vérifier qu'un nombre de fichiers à purger s'affiche
5. **NE PAS cliquer sur "Purger"**

### ⏸️ Étape 12 — Chat IA (bonus)
**Statut** : ⏸️ **Non testé (nécessite interaction GUI)**

**Action requise** :
1. Aller sur **Chat IA**
2. Envoyer un message
3. Vérifier que la réponse arrive (via Groq ou fallback RAG local)

### ⏸️ Étape 13 — Fermeture de l'application
**Statut** : ⏸️ **Non testé (nécessite interaction GUI)**

**Action requise** :
1. Fermer la fenêtre Tauri
2. Vérifier que le process s'arrête :
```powershell
Get-Process nexaflow -ErrorAction SilentlyContinue
```
→ Ne doit rien retourner.

### ⏸️ Étape 14 — Désinstallation
**Statut** : ⏸️ **Non testé (nécessite interaction GUI)**

**Action requise** :
1. Panneau de configuration → Programmes et fonctionnalités
2. Sélectionner **NexaFlow** → Désinstaller
3. Vérifier après désinstallation :
```powershell
Test-Path "C:\Program Files\NexaFlow\"
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | Where-Object { $_.DisplayName -like "*NexaFlow*" }
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | Where-Object { $_.DisplayName -like "*NexaFlow*" }
```

---

## Bugs détectés

Aucun bug détecté lors des vérifications automatisées.

**Tests manuels requis** pour détecter d'éventuels bugs GUI.

## Améliorations suggérées

- Ajouter un test automatisé de l'installation MSI dans la CI/CD
- Vérifier la signature du MSI (actuellement non signé → SmartScreen avertit)
- Tester l'installation sur un Windows propre (sans WebView2 préinstallé)

---

## Conclusion partielle

### ✅ Validé
- Le fix Wix fonctionne : installation dans `C:\Program Files\NexaFlow\` ✅
- Le MSI se construit sans erreur (`light.exe` passe) ✅
- Les chemins `.data` sont corrects (pas de `registry/items/ahmed_abbes/` fantôme) ✅
- Le template custom est préservé (1 `RegistrySearch` sous `INSTALLDIR`) ✅
- L'installation propre fonctionne (pas de résidu dans `%TEMP%`) ✅

### ⏸️ En attente de validation manuelle
- Lancement de l'application
- Wizard Groq
- Login admin
- Sync depuis Web
- Page Supervision
- Chat IA
- Désinstallation propre

**Recommandation** : Publier la release **uniquement après** validation manuelle complète.

---

## Prochaines étapes

1. **Tester manuellement** les étapes 7-14
2. **Documenter** les résultats dans ce rapport
3. **Commit + push** du rapport une fois complet
4. **Publier** la release GitHub avec les binaires testés
