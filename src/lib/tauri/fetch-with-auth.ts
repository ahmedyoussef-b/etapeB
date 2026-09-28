import { isTauriEnv } from "./env";

export async function fetchWithAuth(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  if (!isTauriEnv()) {
    return fetch(input, init);
  }

  const token = await getTauriInjectToken();
  if (!token) {
    return fetch(input, init);
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}

async function getTauriInjectToken(): Promise<string | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const origin = window.location.origin;
    const token = await invoke<string>("get_inject_token", {
      vercel_url: origin,
    });
    return token;
  } catch (e) {
    console.error("[TauriAuth] Failed to get inject token", e);
    return null;
  }
}
