export type Role = "rondier" | "chef-de-bloc" | "chef-de-quart" | "admin";

export type Permission =
  | "dashboard:view"
  | "etat-lieux:*" | "etat-lieux:create" | "etat-lieux:edit" | "etat-lieux:delete"
  | "chat-ia:*"
  | "visio:*"
  | "rapports:*" | "rapports:view" | "rapports:create" | "rapports:edit" | "rapports:delete"
  | "procedures:*" | "procedures:view" | "procedures:create" | "procedures:edit" | "procedures:delete"
  | "equipes:*" | "equipes:view" | "equipes:manage"
  | "users:manage"
  | "settings:*"
  | "logs:view"
  | "banque-images:*" | "banque-images:view" | "banque-images:upload" | "banque-images:delete"
  | "iot:*" | "iot:view" | "iot:control";

export const RBAC_MATRIX: Record<string, Permission[]> = {
  "rondier": [
    "dashboard:view",
    "etat-lieux:*",
    "chat-ia:*",
    "visio:*",
    "rapports:view",
    "iot:view",
  ],

  "chef-de-bloc": [
    "dashboard:view",
    "etat-lieux:*",
    "chat-ia:*",
    "visio:*",
    "rapports:view",
    "rapports:create",
    "rapports:edit",
    "procedures:view",
    "procedures:create",
    "procedures:edit",
    "banque-images:view",
    "banque-images:upload",
    "iot:view",
    "logs:view",
  ],

  "chef-de-quart": [
    "dashboard:view",
    "etat-lieux:*",
    "chat-ia:*",
    "visio:*",
    "rapports:view",
    "rapports:create",
    "rapports:edit",
    "procedures:view",
    "procedures:create",
    "procedures:edit",
    "equipes:view",
    "equipes:manage",
    "banque-images:view",
    "banque-images:upload",
    "iot:view",
    "iot:control",
    "logs:view",
  ],

  "admin": [
    "dashboard:view",
    "etat-lieux:*",
    "chat-ia:*",
    "visio:*",
    "rapports:*",
    "procedures:*",
    "equipes:*",
    "users:manage",
    "settings:*",
    "logs:view",
    "banque-images:*",
    "iot:*",
  ],
};
