import {
  AdminState,
  AppConfig,
  ConnectionSettings,
  DisplaySettings,
  LookupResult,
  ServiceStatus,
} from "./types";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function getSettings(): Promise<DisplaySettings> {
  const response = await fetch("/api/settings");
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<DisplaySettings>;
}

export async function saveSettings(settings: DisplaySettings): Promise<DisplaySettings> {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<DisplaySettings>;
}

export interface MediaSelection {
  backgroundFile: File | null;
  idleFile: File | null;
  removeBackground: boolean;
  removeIdle: boolean;
}

export const EMPTY_MEDIA_SELECTION: MediaSelection = {
  backgroundFile: null,
  idleFile: null,
  removeBackground: false,
  removeIdle: false,
};

export async function uploadMedia(kind: "background" | "idle", file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`/api/media/${kind}`, { method: "POST", body });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { background_image?: string; idle_media?: string };
  const token = kind === "background" ? payload.background_image : payload.idle_media;
  if (!token) throw new Error("Не удалось сохранить файл");
  return token;
}

export async function deleteMedia(kind: "background" | "idle"): Promise<void> {
  const response = await fetch(`/api/media/${kind}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response));
}

export async function applyMediaSelection(
  settings: DisplaySettings,
  selection: MediaSelection,
): Promise<DisplaySettings> {
  const next: DisplaySettings = { ...settings };
  if (selection.backgroundFile) {
    next.background_image = await uploadMedia("background", selection.backgroundFile);
  } else if (selection.removeBackground) {
    await deleteMedia("background");
    next.background_image = "";
  }
  if (selection.idleFile) {
    next.idle_media = await uploadMedia("idle", selection.idleFile);
  } else if (selection.removeIdle) {
    await deleteMedia("idle");
    next.idle_media = "";
  }
  return next;
}

export async function getAdmin(): Promise<AdminState> {
  const response = await fetch("/api/admin");
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<AdminState>;
}

export async function saveAdmin(config: AppConfig, settings: DisplaySettings): Promise<AdminState> {
  const response = await fetch("/api/admin", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, settings }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<AdminState>;
}

export async function getConnection(): Promise<ConnectionSettings> {
  const response = await fetch("/api/connection");
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<ConnectionSettings>;
}

export async function saveConnection(connection: ConnectionSettings): Promise<void> {
  const response = await fetch("/api/connection", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(connection),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function getStatus(): Promise<ServiceStatus> {
  const response = await fetch("/api/status");
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<ServiceStatus>;
}

export async function forceSync(): Promise<void> {
  const response = await fetch("/api/sync", { method: "POST" });
  if (!response.ok) throw new Error(await readError(response));
}

export async function lookup(barcode: string): Promise<LookupResult> {
  const response = await fetch(`/api/lookup?barcode=${encodeURIComponent(barcode)}`);
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<LookupResult>;
}
