export function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false;

  if (window.location.hostname === 'tauri.localhost') {
    console.debug('[TauriEnv] hostname=tauri.localhost => true');
    return true;
  }
  if (window.location.protocol === 'tauri:') {
    console.debug('[TauriEnv] protocol=tauri: => true');
    return true;
  }
  if ('__TAURI_INTERNALS__' in window) {
    console.debug('[TauriEnv] __TAURI_INTERNALS__ present => true');
    return true;
  }
  if ('__TAURI__' in window) {
    console.debug('[TauriEnv] __TAURI__ present => true');
    return true;
  }

  console.debug('[TauriEnv] false', {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
  });
  return false;
}
