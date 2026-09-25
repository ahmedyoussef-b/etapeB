import { describe, it, expect } from 'vitest';
import { isButtonVisible, VISIBILITY_MATRIX, assertButtonVisibility } from '../lib/button-visibility';
import type { VisibilityContext } from '../lib/button-visibility';

const WEB_ADMIN: VisibilityContext = { env: 'web', isAdmin: true, isLocalEditable: false };
const WEB_USER: VisibilityContext = { env: 'web', isAdmin: false, isLocalEditable: false };
const TAURI_ADMIN_LOCAL: VisibilityContext = { env: 'tauri', isAdmin: true, isLocalEditable: true };
const TAURI_USER_LOCAL: VisibilityContext = { env: 'tauri', isAdmin: false, isLocalEditable: true };
const TAURI_ADMIN_REMOTE: VisibilityContext = { env: 'tauri', isAdmin: true, isLocalEditable: false };
const TAURI_USER_REMOTE: VisibilityContext = { env: 'tauri', isAdmin: false, isLocalEditable: false };

describe('structure-bdd button visibility', () => {
  it('matches the declared visibility matrix for every button/env combination', () => {
    const buttons = Object.keys(VISIBILITY_MATRIX) as Array<keyof typeof VISIBILITY_MATRIX>;
    const envs: Array<{ key: VisibilityContext['env']; ctx: VisibilityContext }> = [
      { key: 'web', ctx: WEB_ADMIN },
      { key: 'web', ctx: WEB_USER },
      { key: 'tauri', ctx: TAURI_ADMIN_LOCAL },
      { key: 'tauri', ctx: TAURI_USER_LOCAL },
      { key: 'tauri', ctx: TAURI_ADMIN_REMOTE },
      { key: 'tauri', ctx: TAURI_USER_REMOTE },
    ];

    for (const button of buttons) {
      for (const { key: envKey, ctx } of envs) {
        const expected = VISIBILITY_MATRIX[button][envKey];
        const actual = isButtonVisible(button, ctx);
        const adminRequired = button !== 'syncFromWeb';
        const localEditableRequired = button === 'syncFromWeb';
        const effectiveExpected = expected && (!adminRequired || ctx.isAdmin) && (!localEditableRequired || ctx.isLocalEditable);
        expect(actual, `${button} in ${envKey} admin=${ctx.isAdmin} localEditable=${ctx.isLocalEditable}`).toBe(effectiveExpected);
      }
    }
  });

  it('allows assertButtonVisibility to validate exact expectations', () => {
    expect(() => assertButtonVisibility('resetLocal', WEB_ADMIN, false)).not.toThrow();
    expect(() => assertButtonVisibility('resetLocal', TAURI_ADMIN_LOCAL, true)).not.toThrow();
    expect(() => assertButtonVisibility('resetLocal', WEB_ADMIN, true)).toThrow();
    expect(() => assertButtonVisibility('resetLocal', TAURI_USER_REMOTE, true)).toThrow();
  });

  it('never shows local-only buttons in web env', () => {
    const localOnly = ['resetLocal', 'injectFromWeb', 'syncFromWeb', 'vectorize', 'purgeVectoriel'] as const;
    for (const button of localOnly) {
      expect(isButtonVisible(button, WEB_ADMIN)).toBe(false);
      expect(isButtonVisible(button, WEB_USER)).toBe(false);
    }
  });

  it('never shows admin buttons to non-admin users', () => {
    const adminOnly = ['resetLocal', 'resetWeb', 'injectFromWeb', 'vectorize', 'purgeVectoriel', 'implante'] as const;
    for (const button of adminOnly) {
      expect(isButtonVisible(button, WEB_USER)).toBe(false);
      expect(isButtonVisible(button, TAURI_USER_LOCAL)).toBe(false);
      expect(isButtonVisible(button, TAURI_USER_REMOTE)).toBe(false);
    }
  });

  it('always shows implante and resetWeb to admins regardless of env', () => {
    expect(isButtonVisible('implante', WEB_ADMIN)).toBe(true);
    expect(isButtonVisible('implante', TAURI_ADMIN_LOCAL)).toBe(true);
    expect(isButtonVisible('resetWeb', WEB_ADMIN)).toBe(true);
    expect(isButtonVisible('resetWeb', TAURI_ADMIN_REMOTE)).toBe(true);
  });
});
