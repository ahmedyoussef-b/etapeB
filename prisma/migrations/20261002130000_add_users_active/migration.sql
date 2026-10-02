-- Migration: add_users_active
-- Session 17 — ferme le risque résiduel d'ADR 004 (utilisateur désactivé)
-- Ajout d'un champ booléen `active` sur la table `users`, défaut `true`.
-- Aucun impact sur les données existantes (DEFAULT true appliqué aux lignes présentes).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
