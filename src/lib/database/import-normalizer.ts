import crypto from "crypto";
import { ProcedureSchema, TProcedure, TStep } from "@/lib/procedures/services/validator.service";
import type { Procedure, Step, MediaFile, Alert } from "@/lib/database/unified-database.service";

export interface WebProcedurePayload {
  id?: string;
  title?: string;
  code?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  estimatedTimeMinutes?: number;
  requiredRoles?: string[];
  globalSafetyInstructions?: string[];
  steps?: WebStepPayload[];
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface WebStepPayload {
  id?: string;
  title?: string;
  subtitle?: string;
  instructions?: string;
  type?: string;
  isMandatory?: boolean;
  isBlocking?: boolean;
  order?: number;
  dependencies?: string[];
  timer?: number;
  timerSeconds?: number;
  mediaRequirements?: Array<Record<string, any>>;
  media?: Array<Record<string, any>>;
  alarms?: Array<Record<string, any>>;
  alerts?: Array<Record<string, any>>;
  attachments?: string[];
  [key: string]: any;
}

export interface ImportNormalizationResult {
  procedure: TProcedure;
  dbProcedure: Procedure;
  warnings: string[];
  errors: string[];
}

export class ImportNormalizer {
  normalizeWebProcedure(webData: WebProcedurePayload): ImportNormalizationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const title = String(webData.title || webData.metadata?.title || "Procédure sans titre");
      const code = String(webData.code || webData.metadata?.code || `IMPORT-${Date.now()}`);
      const description = String(webData.description || webData.metadata?.description || "");
      const category = this.mapCategory(webData.category || webData.metadata?.category || "Production");
      const priority = this.mapPriority(webData.priority || webData.metadata?.priority || "moyenne");
      const status = this.mapStatus(webData.status || webData.metadata?.status || "draft");
      const estimatedTimeMinutes = Number(webData.estimatedTimeMinutes || webData.metadata?.estimatedTimeMinutes || 30);
      const requiredRoles = Array.isArray(webData.requiredRoles)
        ? webData.requiredRoles.map(String)
        : Array.isArray(webData.roles)
          ? webData.roles.map(String)
          : [];
      const globalSafetyInstructions = Array.isArray(webData.globalSafetyInstructions)
        ? webData.globalSafetyInstructions.map(String)
        : Array.isArray(webData.safetyInstructions)
          ? webData.safetyInstructions.map(String)
          : [];

      const extraMetadata = Object.fromEntries(
        Object.entries(webData).filter(([key]) => ![
          'id', 'title', 'code', 'description', 'category', 'priority', 'status',
          'estimatedTimeMinutes', 'requiredRoles', 'globalSafetyInstructions',
          'steps', 'createdAt', 'updatedAt', 'metadata', 'roles', 'safetyInstructions'
        ].includes(key))
      );

      const normalizedSteps = this.normalizeSteps(webData.steps || [], warnings);

      const procedure: TProcedure = {
        metadata: {
          title,
          code,
          description,
          category,
          priority,
          estimatedTimeMinutes: Number.isFinite(estimatedTimeMinutes) && estimatedTimeMinutes > 0 ? estimatedTimeMinutes : 30,
          requiredRoles,
          globalSafetyInstructions,
          ...extraMetadata,
        },
        steps: normalizedSteps,
      };

      const validation = ProcedureSchema.safeParse(procedure);
      if (!validation.success) {
        validation.error.errors.forEach((err) => {
          errors.push(`${err.path.join(".") || "procedure"}: ${err.message}`);
        });
      }

      const dbProcedure = this.toDatabaseProcedure(procedure, webData);
      return { procedure, dbProcedure, warnings, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Erreur de normalisation: ${message}`);
      return {
        procedure: {
          metadata: {
            title: "Procédure invalide",
            code: `IMPORT-ERROR-${Date.now()}`,
            description: "",
            category: "Production",
            priority: "moyenne",
            estimatedTimeMinutes: 30,
            requiredRoles: [],
            globalSafetyInstructions: [],
          },
          steps: [],
        },
        dbProcedure: {
          id: crypto.randomUUID(),
          title: "Procédure invalide",
          code: `IMPORT-ERROR-${Date.now()}`,
          category: "Production",
          priority: "Moyenne",
          status: "draft",
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { source: "web-import", importedAt: new Date().toISOString() },
        },
        warnings,
        errors,
      };
    }
  }

  private normalizeSteps(webSteps: WebStepPayload[], warnings: string[]): TStep[] {
    const steps = Array.isArray(webSteps) ? webSteps : [];

    if (steps.length === 0) {
      return [{
        id: crypto.randomUUID(),
        title: "Étape par défaut",
        subtitle: "Étape créée automatiquement lors de l'import",
        instructions: "Vérifier ou compléter l'étape importée.",
        type: "consigne_simple",
        isMandatory: true,
        dependencies: [],
        mediaRequirements: [],
        alarms: [],
        attachments: [],
        order: 0,
        timerEnabled: false,
        timerSeconds: 0,
      }];
    }

    return steps.map((step, index) => {
      const title = String(step.title || `Étape ${index + 1}`);
      const instructions = String(step.instructions || step.description || "");
      const type = this.mapStepType(step.type || "consigne");
      const timerSeconds = Number(step.timer ?? step.timerSeconds ?? 0);
      const mapped: TStep = {
        id: String(step.id || crypto.randomUUID()),
        title,
        subtitle: step.subtitle ? String(step.subtitle) : undefined,
        instructions,
        type,
        isMandatory: Boolean(step.isMandatory ?? true),
        dependencies: Array.isArray(step.dependencies) ? step.dependencies.map(String) : [],
        mediaRequirements: this.normalizeMediaRequirements(step.mediaRequirements || step.media || [], warnings),
        alarms: this.normalizeAlarms(step.alarms || step.alerts || [], warnings),
        attachments: Array.isArray(step.attachments) ? step.attachments.map(String) : [],
        order: Number.isFinite(Number(step.order)) ? Number(step.order) : index,
        timerEnabled: Boolean(step.timer || step.timerSeconds),
        timerSeconds: Number.isFinite(timerSeconds) ? timerSeconds : 0,
      };

      return mapped;
    });
  }

  private normalizeMediaRequirements(media: Array<Record<string, any>>, warnings: string[]): TProcedure["steps"][number]["mediaRequirements"] {
    if (!Array.isArray(media)) return [];
    return media.map((item) => {
      const type = this.mapMediaType(item.type || item.kind || "photo");
      const mandatory = Boolean(item.mandatory ?? item.required ?? false);
      return {
        type,
        mandatory,
        options: {
          geolocation: Boolean(item.options?.geolocation ?? item.geolocation ?? false),
          timestamp: Boolean(item.options?.timestamp ?? item.timestamp ?? false),
        },
      };
    });
  }

  private normalizeAlarms(alarms: Array<Record<string, any>>, warnings: string[]): TProcedure["steps"][number]["alarms"] {
    if (!Array.isArray(alarms)) return [];
    return alarms.map((alarm) => ({
      condition: String(alarm.condition || alarm.label || "Condition inconnue"),
      threshold: alarm.threshold ? String(alarm.threshold) : undefined,
      type: this.mapAlarmType(alarm.type || "INFO"),
      message: String(alarm.message || "Alerte"),
    }));
  }

  private mapCategory(category: string): string {
    const value = String(category || "Production").trim();
    const map: Record<string, string> = {
      production: "Production",
      maintenance: "Maintenance",
      securite: "Sécurité",
      sécurité: "Sécurité",
      qualite: "Qualité",
      qualité: "Qualité",
      logistique: "Logistique",
      environnement: "Environnement",
      environment: "Environnement",
    };
    return map[value.toLowerCase()] || value || "Production";
  }

  private mapPriority(priority: string): "basse" | "moyenne" | "haute" | "critique" {
    const value = String(priority || "moyenne").trim().toLowerCase();
    const map: Record<string, "basse" | "moyenne" | "haute" | "critique"> = {
      low: "basse",
      basse: "basse",
      medium: "moyenne",
      moyenne: "moyenne",
      high: "haute",
      haute: "haute",
      critical: "critique",
      critique: "critique",
    };
    return map[value] || "moyenne";
  }

  private mapStatus(status: string): "draft" | "published" | "archived" {
    const value = String(status || "draft").trim().toLowerCase();
    const map: Record<string, "draft" | "published" | "archived"> = {
      draft: "draft",
      brouillon: "draft",
      published: "published",
      publie: "published",
      publié: "published",
      archived: "archived",
      archive: "archived",
      archivé: "archived",
    };
    return map[value] || "draft";
  }

  private mapStepType(type: string): TStep["type"] {
    const value = String(type || "consigne").trim().toLowerCase();
    const map: Record<string, TStep["type"]> = {
      consigne: "consigne_simple",
      instruction: "consigne_simple",
      saisie: "saisie_donnees",
      input: "saisie_donnees",
      inspection: "inspection_visuelle",
      validation: "validation_securite",
      mesure: "mesure_numerique",
      measurement: "mesure_numerique",
    };
    return map[value] || "consigne_simple";
  }

  private mapMediaType(type: string): TProcedure["steps"][number]["mediaRequirements"][number]["type"] {
    const value = String(type || "photo").trim().toLowerCase();
    const map: Record<string, TProcedure["steps"][number]["mediaRequirements"][number]["type"]> = {
      photo: "photo",
      image: "photo",
      video: "video",
      audio: "audio",
      signature: "signature",
      document: "photo",
    };
    return map[value] || "photo";
  }

  private mapAlarmType(type: string): TProcedure["steps"][number]["alarms"][number]["type"] {
    const value = String(type || "INFO").trim().toLowerCase();
    const map: Record<string, TProcedure["steps"][number]["alarms"][number]["type"]> = {
      danger: "DANGER",
      warning: "WARNING",
      info: "INFO",
      security: "SECURITY_CHECK",
      security_check: "SECURITY_CHECK",
    };
    return map[value] || "INFO";
  }

  private toDatabaseProcedure(procedure: TProcedure, webData: WebProcedurePayload): Procedure {
    const title = procedure.metadata.title;
    const code = procedure.metadata.code;
    const priorityMap: Record<string, Procedure["priority"]> = {
      basse: "Basse",
      moyenne: "Moyenne",
      haute: "Haute",
      critique: "Critique",
    };
    const categoryMap: Record<string, Procedure["category"]> = {
      Production: "Production",
      Maintenance: "Maintenance",
      Sécurité: "Sécurité",
      Qualité: "Qualité",
      Logistique: "Logistique",
      Environnement: "Environnement",
    };

    const dbSteps: Step[] = procedure.steps.map((step, index) => {
      const media: MediaFile[] = (step.mediaRequirements || []).map((item, mediaIndex) => ({
        id: `media_${step.id}_${mediaIndex}`,
        filename: `${step.title || "media"}-${mediaIndex + 1}`,
        type: this.mapMediaFileType(item.type),
        mimeType: "application/octet-stream",
        size: 0,
        metadata: {
          mandatory: Boolean(item.mandatory),
          geolocation: Boolean(item.options?.geolocation),
          timestamp: Boolean(item.options?.timestamp),
        },
      }));

      const alerts: Alert[] = (step.alarms || []).map((alarm, alertIndex) => ({
        id: `alert_${step.id}_${alertIndex}`,
        type: alarm.type,
        message: alarm.message,
        condition: alarm.condition,
        threshold: alarm.threshold ? Number(alarm.threshold) : undefined,
      }));

      return {
        id: step.id,
        title: step.title,
        subtitle: step.subtitle,
        instructions: step.instructions,
        type: this.mapStepTypeForDatabase(step.type),
        isRequired: step.isMandatory,
        isBlocking: Boolean(step.dependencies?.length && !step.isMandatory),
        order: step.order ?? index,
        dependencies: step.dependencies,
        timer: step.timerEnabled ? step.timerSeconds : 0,
        media,
        alerts,
      };
    });

    const metadata = {
      ...(webData.metadata || {}),
      source: "web-import",
      importedAt: new Date().toISOString(),
      originalId: webData.id,
      ...Object.fromEntries(
        Object.entries(webData).filter(([key]) => !["id", "title", "code", "description", "category", "priority", "status", "estimatedTimeMinutes", "requiredRoles", "globalSafetyInstructions", "steps", "createdAt", "updatedAt", "metadata"].includes(key))
      ),
      ...Object.fromEntries(
        Object.entries(procedure.metadata).filter(([key]) => ![
          'title', 'code', 'description', 'category', 'priority', 'estimatedTimeMinutes',
          'requiredRoles', 'globalSafetyInstructions'
        ].includes(key))
      ),
    };

    return {
      id: String(webData.id || crypto.randomUUID()),
      title,
      code,
      description: procedure.metadata.description || "",
      category: categoryMap[procedure.metadata.category] || "Production",
      priority: priorityMap[procedure.metadata.priority] || "Moyenne",
      status: this.mapStatus(String(webData.status || "draft")),
      estimatedDuration: procedure.metadata.estimatedTimeMinutes,
      requiredRoles: procedure.metadata.requiredRoles,
      steps: dbSteps,
      createdAt: webData.createdAt || new Date().toISOString(),
      updatedAt: webData.updatedAt || new Date().toISOString(),
      metadata,
    };
  }

  private mapStepTypeForDatabase(type: TStep["type"]): Step["type"] {
    const map: Record<TStep["type"], Step["type"]> = {
      consigne_simple: "consigne",
      saisie_donnees: "saisie",
      inspection_visuelle: "inspection",
      validation_securite: "validation",
      mesure_numerique: "mesure",
    };
    return map[type] || "consigne";
  }

  private mapMediaFileType(type: TProcedure["steps"][number]["mediaRequirements"][number]["type"]): MediaFile["type"] {
    const map: Record<TProcedure["steps"][number]["mediaRequirements"][number]["type"], MediaFile["type"]> = {
      photo: "image",
      video: "video",
      audio: "audio",
      signature: "signature",
    };
    return map[type] || "image";
  }
}
