# Checklist de test — Banque d'images

## Prérequis
- [ ] Commit 75db726 déployé
- [ ] `tauri dev` lancé
- [ ] Script `scripts/verify-bank-images.ps1` prêt

## Tests

### Test 1 — Upload dans bank/
- [ ] Banque d'images → Ajouter un média
- [ ] Sélectionner une image
- [ ] Destination : `bank/`
- [ ] Envoyer
- [ ] Vérifier le toast succès
- [ ] Vérifier la structure : `repository/bank/<slug>/<slug>.jpg + .json`

### Test 2 — Upload dans bank/equipements/
- [ ] Créer le dossier `bank/equipements/`
- [ ] Uploader une image
- [ ] Destination : `bank/equipements/`
- [ ] Vérifier : `repository/bank/equipements/<slug>/<slug>.jpg + .json`

### Test 3 — Édition métadonnées
- [ ] Cliquer sur une carte dossier
- [ ] Modifier display_name, description, tags, category
- [ ] Enregistrer
- [ ] Vérifier le toast
- [ ] Vérifier le JSON mis à jour

### Test 4 — Injection
- [ ] Structure BDD → Injection vers Local
- [ ] Observer le toast

### Test 5 — Vectorisation
- [ ] Structure BDD → Vectoriser
- [ ] Observer le toast
- [ ] Vérifier ImagePair dans Chroma

### Test 6 — RAG Chat IA
- [ ] Chat IA → "Montre-moi une image de turbine"
- [ ] Observer la réponse
- [ ] Vérifier les images affichées
- [ ] Vérifier le lien métadonnées

## Scripts utiles
```powershell
# Vérification complète
powershell -ExecutionPolicy Bypass -File scripts/verify-bank-images.ps1
```
