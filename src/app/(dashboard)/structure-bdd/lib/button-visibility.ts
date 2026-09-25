export type ButtonKey =
  | 'resetLocal'
  | 'resetWeb'
  | 'injectFromWeb'
  | 'syncFromWeb'
  | 'vectorize'
  | 'purgeVectoriel'
  | 'implante';

export type VisibilityEnv = 'web' | 'tauri';

export interface VisibilityContext {
  env: VisibilityEnv;
  isAdmin: boolean;
  isLocalEditable: boolean;
}

const RULES: Record<ButtonKey, (ctx: VisibilityContext) => boolean> = {
  resetLocal: ({ env, isAdmin }) => env === 'tauri' && isAdmin,
  resetWeb: ({ isAdmin }) => isAdmin,
  injectFromWeb: ({ env, isAdmin }) => env === 'tauri' && isAdmin,
  syncFromWeb: ({ env, isLocalEditable }) => env === 'tauri' && isLocalEditable,
  vectorize: ({ env, isAdmin }) => env === 'tauri' && isAdmin,
  purgeVectoriel: ({ env, isAdmin }) => env === 'tauri' && isAdmin,
  implante: ({ isAdmin }) => isAdmin,
};

export const VISIBILITY_MATRIX: Record<ButtonKey, { web: boolean; tauri: boolean }> = {
  resetLocal: { web: false, tauri: true },
  resetWeb: { web: true, tauri: true },
  injectFromWeb: { web: false, tauri: true },
  syncFromWeb: { web: false, tauri: true },
  vectorize: { web: false, tauri: true },
  purgeVectoriel: { web: false, tauri: true },
  implante: { web: true, tauri: true },
};

export function isButtonVisible(key: ButtonKey, ctx: VisibilityContext): boolean {
  return RULES[key](ctx);
}

export function assertButtonVisibility(
  key: ButtonKey,
  ctx: VisibilityContext,
  expectedVisible: boolean,
): void {
  const visible = isButtonVisible(key, ctx);
  if (visible !== expectedVisible) {
    throw new Error(
      `[structure-bdd] visibility guard failed for ${key}: expected=${expectedVisible}, actual=${visible}, ctx=${JSON.stringify(ctx)}`,
    );
  }
}
