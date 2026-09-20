# API Reference

## Base URL

```
/api
```

## Endpoints

### Initialisation

```
GET /api/init
POST /api/init
```

Initialise la base de données locale avec les données par défaut.

**Response:**
```json
{
  "initialized": true,
  "basePath": ".data",
  "stats": {
    "procedures": { "total": 3, "byStatus": { "draft": 3 } },
    "users": { "total": 28 },
    "teams": { "total": 4 },
    "reports": { "total": 0 }
  }
}
```

### Upload de Fichiers

```
POST /api/upload
```

Upload et importe des fichiers JSON, CSV, Excel ou PDF.

**Request:** `multipart/form-data`
- `file` : Fichier à uploader
- `category` : Catégorie par défaut (optionnel)
- `priority` : Priorité par défaut (optionnel)

**Response:**
```json
{
  "success": true,
  "result": {
    "imported": 2,
    "failed": 0,
    "warnings": 0,
    "total": 2,
    "details": [
      { "title": "Procédure 1", "status": "success", "message": "Importé avec succès" }
    ]
  }
}
```

### Synchronisation

```
POST /api/sync
```

Synchronise les données depuis la BDD Web vers la BDD Locale.

**Request:**
```json
{
  "webUrl": "https://api.example.com",
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "syncedAt": "2026-01-01T00:00:00.000Z",
    "stats": {
      "procedures": { "imported": 5, "updated": 2, "failed": 0 },
      "users": { "imported": 10, "updated": 0, "failed": 0 },
      "teams": { "imported": 4, "updated": 0, "failed": 0 },
      "reports": { "imported": 0, "updated": 0, "failed": 0 }
    }
  }
}
```

### Structure BDD

```
GET /api/structure?source=local&path=
```

Récupère la structure arborescente de la BDD.

**Parameters:**
- `source` : `local` ou `web` (défaut: `local`)
- `path` : Chemin à explorer (défaut: racine)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "procedures",
      "path": "data/procedures",
      "type": "directory",
      "children": []
    }
  ]
}
```

### Import Web

```
POST /api/admin/import/web
```

Importe des procédures depuis une URL web.

**Request:**
```json
{
  "url": "https://api.example.com/procedures",
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "success": true,
  "imported": 3,
  "updated": 1,
  "failed": 0
}
```

### Procédures

```
GET /api/procedures/guide
GET /api/procedures/guide/:id
POST /api/procedures/guide
DELETE /api/procedures/guide/:id
```

CRUD des procédures.

### État des Lieux

```
GET /api/etat-des-lieux
GET /api/etat-des-lieux/:id
POST /api/etat-des-lieux
PUT /api/etat-des-lieux/:id
DELETE /api/etat-des-lieux/:id
```

CRUD des rapports d'état des lieux.

### Images

```
GET /api/images
GET /api/images/:id
POST /api/images
PUT /api/images/:id
DELETE /api/images/:id
```

CRUD des médias.
