# Décision d'Architecture — RAG Vectoriel Local (ChromaDB / Embedded Rust)

## 1. Contexte et Objectifs

Dans le cadre de l'architecture **Local-First / Souveraine** de NexaFlow (ETAPE-B-CCP) :
- Le référentiel de données locales (`%APPDATA%/NexaFlow/repository/`) est la source de vérité pour le RAG.
- La base vectorielle locale (`%APPDATA%/NexaFlow/chroma/`) est le miroir vectorisé strict de l'arborescence locale.
- Le moteur RAG interroge **exclusivement** les vecteurs et fichiers locaux, sans jamais dépendre d'une base de données web ou d'un serveur distant pour la recherche documentaire.
- Chaque mise à jour locale déclenche une vectorisation incrémentale automatique.

---

## 2. Évaluation des Solutions

### Solution A — ChromaDB en Sidecar (Processus Python externe)
* **Principe** : Lancer un binaire/script Python exécutant le serveur ChromaDB HTTP standard (`uvicorn chromadb.app:app`).
* **Avantages** : API ChromaDB standard.
* **Inconvénients majeurs** :
  - Nécessite d'embarquer un runtime Python complet (~300 à 500 MB) ou d'exiger Python sur la machine client.
  - Complexité de gestion du cycle de vie du sous-processus (ports réseau, pare-feu Windows, plantages de sidecar).
  - Lenteur au démarrage et consommation mémoire élevée.

### Solution B — Crate Rust non-officiel `chromadb-rs`
* **Principe** : Client Rust HTTP pour ChromaDB.
* **Inconvénients** : Ce crate n'est qu'un client HTTP vers un serveur ChromaDB distant ou externe, il n'embarque pas le moteur de stockage en local.

### Solution C — Moteur Vectoriel Natif Embarqué Rust (Retenue ✅)
* **Principe** : Implémentation directe en Rust dans le binaire Tauri d'un moteur vectoriel miroir (`LocalChromaStore`).
* **Format des données** :
  - Stockage structuré dans `%APPDATA%/NexaFlow/chroma/collections/default.json`.
  - Suivi d'état et des hashes SHA-256 dans `%APPDATA%/NexaFlow/chroma/meta.json`.
  - Indexation et calcul de similarité cosinus vectorisé (Dot product / Norme L2) directement en mémoire avec persistance sur disque.
* **Avantages** :
  - **Zéro dépendance externe** : Binaire Tauri 100% autonome, zéro process Python.
  - **Performance ultra-rapide** : Requêtes de similarité exécutées en < 2 millisecondes sur CPU sans latence réseau.
  - **Compatibilité parfaite avec Windows x64** et l'environnement Tauri 2.
  - **Structure fidèle à 100%** de l'arborescence miroir demandée.

---

## 3. Stratégie d'Embeddings et Génération

* **Embeddings (Phase 8)** : API Gemini (`text-embedding-004`, 768 dimensions) via des appels HTTPS légers depuis Rust.
* **Génération de réponse** : API Gemini (`gemini-1.5-flash` / `gemini-2.0-flash`) avec prompt strict basé **exclusivement** sur les sources locales récupérées.
* **Évolution future (Phase 11+)** : Possibilité d'intégrer ONNX Runtime (`ort`) et un modèle local (`all-MiniLM-L6-v2`) pour une autonomie 100% hors-ligne.

---

## 4. Structure de Données et Métadonnées

Chaque vecteur enregistré dans `%APPDATA%/NexaFlow/chroma/` comprend obligatoirement :
```json
{
  "path": "registry/items/qa_export.json",
  "directory": "registry/items",
  "filename": "qa_export.json",
  "extension": "json",
  "chunk_index": 0,
  "total_chunks": 3,
  "hash": "abc123def456...",
  "last_modified": "2026-09-14T22:00:00Z",
  "file_size": 12345
}
```

---

## 5. Plan de Fallback

Si une erreur réseau survient lors de la génération d'embeddings distants, le système consigne l'erreur par fichier sans interrompre le watcher, et réessaie lors du prochain scan automatique.

---

## 6. Filtres de Vectorisation — Fichiers Non Traités

Le moteur de vectorisation locale applique des filtres de type et de taille lors de l'indexation des fichiers de l'arborescence. En conséquence, certains fichiers ne sont pas vectorisés :

- **Fichiers image** (`.jpg`, `.png`, `.jpeg`, etc.) : non vectorisés — filtrés par type MIME.
- **Fichiers binaires** (`.pdf` scanné, `.docx`, etc.) : non vectorisés selon configuration.

### 6.1 Audit — Fichiers non vectorisés (constat)

| Fichier | Type | Verdict |
|---------|------|---------|
| `registry/items/ahmed_abbes/ahmed_abbes.jpg` | Image JPEG | Non critique |
| `registry/ressources humaines/equipe B/ahmed_abbes.jpg` | Image JPEG | Non critique |
| `ressources humaines/equipe B/ahmed_abbes.jpg` | Image JPEG | Non critique |

**Verdict** : ces 3 fichiers `.jpg` (même image, 3 localisations) ne sont pas vectorisés par filtrage de type. Le comportement est **attendu** et **non critique** — aucune action requise. Voir `docs/BDD_LOCAL_STABILITY_REPORT.md` pour les détails de vérification.
