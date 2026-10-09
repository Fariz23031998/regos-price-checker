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
