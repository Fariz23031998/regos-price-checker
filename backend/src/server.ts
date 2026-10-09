import fs from "fs";
import path from "path";
import express from "express";
import {
  getConfig,
  getConfigError,
  getConnection,
  getSettings,
  getSettingsError,
  parseConfig,
  parseConnection,
  parseSettings,
  saveConfigAndSettings,
  saveConnection,
  saveSettings,
} from "./config";
import { applyPriceFormula } from "./formula";
import { errorMessage, log } from "./logger";
import { ServerRuntime } from "./listen";
import { backendRoot } from "./paths";
import {
  commitDatabaseSwap,
  getExchangeRates,
  getImage,
  lookupBarcode,
  LookupResult,
  openSqliteFile,
  resolveSqlitePath,
  rollbackDatabase,
  swapDatabase,
} from "./sqlite";
import { SyncService } from "./sync";

const FORMULA_ERROR = "Ошибка формулы цены";

function applyDisplayPrice(result: LookupResult): LookupResult {
  if (result.status !== "found" || result.price == null) return result;
  const settings = getSettings();
  if (!settings.price_formula_enabled || !settings.price_formula) return result;
  try {
    return {
      ...result,
      price: applyPriceFormula(settings.price_formula, result.price, getExchangeRates()),
    };
  } catch (error) {
    log(`Price formula error: ${errorMessage(error)}`);
    return { ...result, price: null, formulaError: FORMULA_ERROR };
  }
}

export function createApp(syncService: SyncService, runtime: ServerRuntime): express.Express {
  const app = express();
  app.use(express.json());

  const api = express.Router();

  api.get("/items/:id/image", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "Item id is required" });
      return;
    }
    const image = getImage(id);
    if (!image) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.setHeader("Content-Type", image.mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(image.data);
  });

  api.get("/lookup", (req, res) => {
    const barcode = typeof req.query.barcode === "string" ? req.query.barcode.trim() : "";
    if (!barcode || barcode.length > 128) {
      res.status(400).json({ error: "Barcode is required" });
      return;
    }
    try {
      res.json(applyDisplayPrice(lookupBarcode(barcode)));
    } catch (error) {
      res.status(503).json({ error: errorMessage(error) });
    }
  });

  api.get("/status", (_req, res) => {
    res.json(syncService.getStatus());
  });

  api.post("/sync", async (_req, res) => {
    try {
      const status = await syncService.forceSync();
      res.json({ ok: true, status });
    } catch (error) {
      res.status(503).json({ ok: false, error: errorMessage(error) });
    }
  });

  api.get("/settings", (_req, res) => {
    res.json(getSettings());
  });

  api.put("/settings", (req, res) => {
    try {
      const settings = saveSettings(parseSettings(req.body));
      syncService.setCheckTime(settings.sync_time);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  api.get("/connection", (_req, res) => {
    res.json(getConnection());
  });

  api.get("/admin", (_req, res) => {
    res.json(adminPayload(runtime));
  });

  api.put("/admin", async (req, res) => {
    try {
      const body = typeof req.body === "object" && req.body ? (req.body as { config?: unknown; settings?: unknown }) : {};
      const config = parseConfig(body.config);
      const settings = parseSettings(body.settings);
      const previous = getConfig();
      const sqliteChanged = resolveSqlitePath(config.sqlite_path) !== resolveSqlitePath(previous.sqlite_path);
      const listenChanged = config.listen_port !== previous.listen_port && config.listen_port !== runtime.getListeningPort();

      let pendingSqlite: ReturnType<typeof openSqliteFile> | null = null;
      let swapped = false;
      let rebound = false;
      try {
        if (sqliteChanged) {
          pendingSqlite = openSqliteFile(config.sqlite_path);
        }
        if (listenChanged) {
          await runtime.bindListenPort(config.listen_port);
          rebound = true;
        }
        if (pendingSqlite) {
          swapDatabase(pendingSqlite, config.sqlite_path);
          pendingSqlite = null;
          swapped = true;
        }
        saveConfigAndSettings(config, settings);
      } catch (error) {
        if (rebound) runtime.rollbackListenPort();
        if (swapped) rollbackDatabase();
        pendingSqlite?.close();
        res.status(400).json({ error: errorMessage(error) });
        return;
      }

      syncService.applyCheckTime();
      let warning: string | null = null;
      try {
        await syncService.reconnectAndSync();
      } catch (error) {
        warning = errorMessage(error);
        log(`Error: ${warning}`);
      }

      res.on("finish", () => {
        setTimeout(() => {
          if (rebound) runtime.commitListenPort();
          if (swapped) commitDatabaseSwap();
        }, 250);
      });
      res.json(adminPayload(runtime, warning));
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  api.put("/connection", async (req, res) => {
    try {
      const connection = parseConnection(req.body);
      saveConnection(connection);
      try {
        const status = await syncService.reconnectAndSync();
        res.json({ connection: getConnection(), status });
      } catch (error) {
        log(`Error: ${errorMessage(error)}`);
        res.status(503).json({ error: errorMessage(error), connection: getConnection() });
      }
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  });

  api.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use("/api", api);

  const frontendDist = path.resolve(backendRoot(), "../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  return app;
}

function adminPayload(runtime: ServerRuntime, warning: string | null = null) {
  return {
    config: getConfig(),
    settings: getSettings(),
    listeningPort: runtime.getListeningPort(),
    configError: getConfigError(),
    settingsError: getSettingsError(),
    warning,
  };
}
