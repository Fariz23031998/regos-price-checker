import { DEFAULT_CONFIG, ensureConfig, ensureSettings, getConfig } from "./config";
import { errorMessage, log } from "./logger";
import { createAppHost } from "./listen";
import { createApp } from "./server";
import { initDatabase, resolveSqlitePath } from "./sqlite";
import { SyncService } from "./sync";

function openCatalog(): void {
  const configured = getConfig().sqlite_path;
  try {
    initDatabase(configured);
    return;
  } catch (error) {
    log(`Error opening SQLite '${configured}': ${errorMessage(error)}`);
  }

  const fallback = DEFAULT_CONFIG.sqlite_path;
  if (resolveSqlitePath(configured) !== resolveSqlitePath(fallback)) {
    try {
      initDatabase(fallback);
      log(`Using SQLite '${fallback}'`);
      return;
    } catch (error) {
      log(`Error opening SQLite '${fallback}': ${errorMessage(error)}`);
    }
  }

  log("Continuing without a SQLite database");
}

function listenCandidates(preferred: number): number[] {
  const ports = [preferred];
  if (!ports.includes(DEFAULT_CONFIG.listen_port)) ports.push(DEFAULT_CONFIG.listen_port);
  ports.push(0);
  return ports;
}

async function main(): Promise<void> {
  ensureConfig();
  ensureSettings();
  openCatalog();

  const syncService = new SyncService();
  const runtime = createAppHost();
  const app = createApp(syncService, runtime);
  await runtime.listen(app, listenCandidates(getConfig().listen_port));
  await syncService.start();
}

main().catch((error: unknown) => {
  log(`Fatal: ${errorMessage(error)}`);
  process.exit(1);
});
