# NexaFlow — Guide utilisateur

## 1. Connexion

1. Accéder à `/login`
2. Saisir votre email et mot de passe
3. La redirection est automatique selon votre rôle

## 2. Rôles et accès

| Rôle | Espace | Droits principaux |
|------|--------|-------------------|
| Administrateur | `/admin` | Gestion utilisateurs, paramètres, supervision |
| Chef de quart | `/chef-de-quart` | Supervision opérations, équipes, procédures |
| Chef de bloc | `/chef-de-bloc` | Procédures, rapports, images, équipements |
| Rondier | `/rondier` | États des lieux, tâches, chat IA, visio |

## 3. Navigation

- **Sidebar** : accès rapide aux modules autorisés
- **Top nav** : notifications, profil, déconnexion
- **Dashboard** : vue d'ensemble adaptée au rôle

## 4. Modules principaux

### Procédures
- Consulter le guide procédure
- Créer/modifier une procédure (chef de bloc / chef de quart / admin)
- Exécuter une procédure pas à pas

### États des lieux
- Créer un état des lieux
- Joindre des photos
- Signer et valider

### Équipes
- Voir les équipes assignées
- Consulter les membres
- Accéder aux détails d'un membre

### Rapports
- Générer un rapport
- Exporter en PDF / Excel
- Partager

### Chat IA
- Poser des questions métier
- Obtenir des résumés
- Utiliser l'assistant vocal

### Visioconférence
- Démarrer une réunion
- Partager l'écran
- Inviter des participants

## 5. Synchronisation

NexaFlow fonctionne en mode **offline-first** :

- Les données sont disponibles même sans connexion
- La synchronisation est automatique quand la connexion revient
- Un indicateur de statut est visible dans le tableau de bord
- Un bouton manuel permet de forcer la synchronisation

### En cas de conflit

Par défaut, **vos modifications locales sont conservées**. Vous pouvez consulter les conflits dans les logs système.

## 6. Support

- Documentation technique : `docs/ARCHITECTURE.md`, `docs/API.md`
- Logs : disponible dans `/logs` (admin)
- Contact : `ahmedyoussefabbes@gmail.com`
