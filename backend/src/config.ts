import fs from "fs";
import path from "path";
import { assertPriceFormula } from "./formula";
import { errorMessage, log } from "./logger";
import { MediaKind, normalizeMediaToken } from "./media";
import { backendRoot } from "./paths";
import { getExchangeRates } from "./sqlite";

export interface AppConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  price_type: number;
  check_time: number;
  sqlite_path: string;
  listen_port: number;
}

export type Language = "uz" | "ru" | "en";

export interface DisplaySettings {
  sync_time: number;
  name_font_size: number;
  price_font_size: number;
  background_color: string;
  name_font_color: string;
  price_font_color: string;
  update_screen_time: number;
  show_image: boolean;
  price_formula_enabled: boolean;
  price_formula: string;
  price_prefix: string;
  price_suffix: string;
  background_image: string;
  idle_media: string;
  language: Language;
}

export interface ConnectionSettings {
  host: string;
  database: string;
  user: string;
  password: string;
  price_type: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  host: "localhost",
  port: 3050,
  database: "C:/REGOS BASE/REGOS.FDB",
  user: "SYSDBA",
  password: "masterkey",
  price_type: 1,
  check_time: 60,
  sqlite_path: "data/prices.sqlite",
  listen_port: 3000,
};

export const DEFAULT_SETTINGS: DisplaySettings = {
  sync_time: 60,
  name_font_size: 70,
  price_font_size: 100,
  background_color: "#000000",
  name_font_color: "#03c2fc",
  price_font_color: "#03c2fc",
  update_screen_time: 15,
  show_image: true,
  price_formula_enabled: false,
  price_formula: "",
  price_prefix: "",
  price_suffix: "",
  background_image: "",
  idle_media: "",
  language: "ru",
};

let currentConfig: AppConfig = { ...DEFAULT_CONFIG };
let currentSettings: DisplaySettings = { ...DEFAULT_SETTINGS };
let configError: string | null = null;
let settingsError: string | null = null;

function configPath(): string {
  return path.join(backendRoot(), "config.json");
}

function settingsPath(): string {
  return path.join(backendRoot(), "settings.json");
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`, "utf8");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) return fallback;
  return numeric;
}

function language(value: unknown): Language {
  return value === "uz" || value === "en" ? value : "ru";
}

function flag(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function normalizeConfig(value: unknown): AppConfig {
  const source = typeof value === "object" && value ? (value as Partial<AppConfig>) : {};
  return {
    host: text(source.host, DEFAULT_CONFIG.host),
    port: integer(source.port, DEFAULT_CONFIG.port, 1, 65535),
    database: text(source.database, DEFAULT_CONFIG.database),
    user: text(source.user, DEFAULT_CONFIG.user),
    password: typeof source.password === "string" ? source.password : DEFAULT_CONFIG.password,
    price_type: integer(source.price_type, DEFAULT_CONFIG.price_type, 1, 999999),
    check_time: integer(source.check_time, DEFAULT_CONFIG.check_time, 1, 86400),
    sqlite_path: text(source.sqlite_path, DEFAULT_CONFIG.sqlite_path),
    listen_port: integer(source.listen_port, DEFAULT_CONFIG.listen_port, 1, 65535),
  };
}

function normalizeSettings(value: unknown): DisplaySettings {
  const source = typeof value === "object" && value ? (value as Partial<DisplaySettings>) : {};
  return {
    sync_time: integer(source.sync_time, DEFAULT_SETTINGS.sync_time, 1, 86400),
    name_font_size: integer(source.name_font_size, DEFAULT_SETTINGS.name_font_size, 1, 500),
    price_font_size: integer(source.price_font_size, DEFAULT_SETTINGS.price_font_size, 1, 500),
    background_color: text(source.background_color, DEFAULT_SETTINGS.background_color),
    name_font_color: text(source.name_font_color, DEFAULT_SETTINGS.name_font_color),
    price_font_color: text(source.price_font_color, DEFAULT_SETTINGS.price_font_color),
    update_screen_time: integer(source.update_screen_time, DEFAULT_SETTINGS.update_screen_time, 1, 3600),
    show_image: flag(source.show_image, DEFAULT_SETTINGS.show_image),
    price_formula_enabled: flag(source.price_formula_enabled, DEFAULT_SETTINGS.price_formula_enabled),
    price_formula: formulaText(source.price_formula),
    price_prefix: affix(source.price_prefix),
    price_suffix: affix(source.price_suffix),
    background_image: normalizeMediaToken("background", source.background_image),
    idle_media: normalizeMediaToken("idle", source.idle_media),
    language: language(source.language),
  };
}

function formulaText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 500);
}

function affix(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 40);
}

function loadOrCreate<T>(
  filePath: string,
  filename: string,
  fallback: T,
  normalize: (value: unknown) => T,
): { value: T; error: string | null } {
  if (!fs.existsSync(filePath)) {
    try {
      writeJson(filePath, fallback);
    } catch (error) {
      const message = `Не удалось создать ${filename}: ${errorMessage(error)}`;
      log(`Error: ${message}`);
      return { value: normalize(fallback), error: message };
    }
    return { value: normalize(fallback), error: null };
  }

  let parsed: unknown;
  try {
    parsed = readJson(filePath);
  } catch (error) {
    log(`Error: File '${filename}' contains invalid JSON`);
    log(`Error reading JSON file: ${errorMessage(error)}`);
    return { value: normalize(fallback), error: `Файл ${filename} содержит неверный JSON` };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    log(`Error: File '${filename}' must contain a JSON object`);
    return { value: normalize(fallback), error: `Файл ${filename} должен быть объектом JSON` };
  }

  return { value: normalize(parsed), error: null };
}

export function ensureConfig(): AppConfig {
  const loaded = loadOrCreate(configPath(), "config.json", DEFAULT_CONFIG, normalizeConfig);
  currentConfig = loaded.value;
  configError = loaded.error;
  return currentConfig;
}

export function ensureSettings(): DisplaySettings {
  const loaded = loadOrCreate(settingsPath(), "settings.json", DEFAULT_SETTINGS, normalizeSettings);
  currentSettings = loaded.value;
  settingsError = loaded.error;
  return currentSettings;
}

export function getConfig(): AppConfig {
  return currentConfig;
}

export function getSettings(): DisplaySettings {
  return currentSettings;
}

export function getConfigError(): string | null {
  return configError;
}

export function getSettingsError(): string | null {
  return settingsError;
}

export function getConnection(): ConnectionSettings {
  return {
    host: currentConfig.host,
    database: currentConfig.database,
    user: currentConfig.user,
    password: currentConfig.password,
    price_type: currentConfig.price_type,
  };
}

export function saveConnection(connection: ConnectionSettings): AppConfig {
  currentConfig = normalizeConfig({
    ...currentConfig,
    host: connection.host,
    database: connection.database,
    user: connection.user,
    password: connection.password,
    price_type: connection.price_type,
  });
  writeJson(configPath(), currentConfig);
  return currentConfig;
}

export function saveSettings(settings: DisplaySettings): DisplaySettings {
  currentSettings = normalizeSettings(settings);
  writeJson(settingsPath(), currentSettings);
  return currentSettings;
}

export function updateCheckTime(seconds: number): void {
  currentConfig = normalizeConfig({ ...currentConfig, check_time: seconds });
  writeJson(configPath(), currentConfig);
}

export function saveConfigAndSettings(config: AppConfig, settings: DisplaySettings): void {
  const previousConfig = currentConfig;
  const previousSettings = currentSettings;
  const previousConfigError = configError;
  const previousSettingsError = settingsError;
  currentConfig = { ...config };
  currentSettings = { ...settings };
  configError = null;
  settingsError = null;
  let configWritten = false;
  try {
    writeJson(configPath(), currentConfig);
    configWritten = true;
    writeJson(settingsPath(), currentSettings);
  } catch (error) {
    currentConfig = previousConfig;
    currentSettings = previousSettings;
    configError = previousConfigError;
    settingsError = previousSettingsError;
    if (configWritten) {
      try {
        writeJson(configPath(), currentConfig);
      } catch (restoreError) {
        log(`Error restoring config.json: ${errorMessage(restoreError)}`);
      }
    }
    throw error;
  }
}

export function parseConfig(value: unknown): AppConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Укажите параметры конфигурации");
  }
  const source = value as Partial<AppConfig>;
  const required: Array<keyof AppConfig> = [
    "host",
    "port",
    "database",
    "user",
    "password",
    "price_type",
    "check_time",
    "sqlite_path",
    "listen_port",
  ];
  for (const key of required) {
    if (source[key] == null || (key !== "password" && source[key] === "")) {
      throw new Error("Заполните все поля конфигурации");
    }
  }
  if (typeof source.password !== "string") {
    throw new Error("Укажите пароль");
  }
  const config = normalizeConfig(source);
  if (
    config.port !== integer(source.port, -1, 1, 65535) ||
    config.price_type !== integer(source.price_type, -1, 1, 999999) ||
    config.check_time !== integer(source.check_time, -1, 1, 86400) ||
    config.listen_port !== integer(source.listen_port, -1, 1, 65535)
  ) {
    throw new Error("Укажите целые числа в полях порта, вида цены и времени");
  }
  if (!text(source.host, "") || !text(source.database, "") || !text(source.user, "") || !text(source.sqlite_path, "")) {
    throw new Error("Заполните адрес, путь к базе, имя пользователя и путь SQLite");
  }
  return {
    ...config,
    password: source.password,
  };
}

export function parseSettings(value: unknown): DisplaySettings {
  if (typeof value !== "object" || !value) {
    throw new Error("Укажите настройки");
  }
  const source = value as Partial<DisplaySettings>;
  const settings = normalizeSettings(source);
  const required: Array<keyof DisplaySettings> = [
    "sync_time",
    "name_font_size",
    "price_font_size",
    "background_color",
    "name_font_color",
    "price_font_color",
    "update_screen_time",
    "show_image",
    "price_formula_enabled",
  ];
  for (const key of required) {
    if (source[key] == null || source[key] === "") {
      throw new Error("Заполните все поля настроек");
    }
  }
  if (typeof source.price_formula === "string" && source.price_formula.trim().length > 500) {
    throw new Error("Формула цены слишком длинная");
  }
  requireAffix(source.price_prefix, "Префикс цены слишком длинный");
  requireAffix(source.price_suffix, "Суффикс цены слишком длинный");
  requireStoredMedia("background", source.background_image, "Фоновое изображение не найдено");
  requireStoredMedia("idle", source.idle_media, "Файл рекламы не найден");
  if (
    settings.sync_time !== integer(source.sync_time, -1, 1, 86400) ||
    settings.name_font_size !== integer(source.name_font_size, -1, 1, 500) ||
    settings.price_font_size !== integer(source.price_font_size, -1, 1, 500) ||
    settings.update_screen_time !== integer(source.update_screen_time, -1, 1, 3600)
  ) {
    throw new Error("Укажите целые числа в полях времени и размера шрифта");
  }
  if (settings.price_formula_enabled) {
    if (!settings.price_formula) throw new Error("Укажите формулу цены");
    let rates: Record<string, number> = {};
    try {
      rates = getExchangeRates();
    } catch {
      rates = {};
    }
    assertPriceFormula(settings.price_formula, rates);
  }
  return settings;
}

function requireAffix(value: unknown, tooLong: string): void {
  if (value == null) return;
  if (typeof value !== "string" || value.length > 40) throw new Error(tooLong);
}

function requireStoredMedia(kind: MediaKind, value: unknown, message: string): void {
  if (value == null || value === "") return;
  if (typeof value !== "string") throw new Error(message);
  const token = value.trim().toLowerCase();
  if (normalizeMediaToken(kind, value) !== token) throw new Error(message);
}

export function parseConnection(value: unknown): ConnectionSettings {
  if (typeof value !== "object" || !value) {
    throw new Error("Укажите параметры соединения");
  }
  const source = value as Partial<ConnectionSettings>;
  if (!text(source.host, "") || !text(source.database, "") || !text(source.user, "")) {
    throw new Error("Заполните адрес, путь к базе и имя пользователя");
  }
  if (typeof source.password !== "string") {
    throw new Error("Укажите пароль");
  }
  const priceType = integer(source.price_type, -1, 1, 999999);
  if (priceType < 1) {
    throw new Error("Укажите вид цены целым числом");
  }
  return {
    host: text(source.host, ""),
    database: text(source.database, ""),
    user: text(source.user, ""),
    password: source.password,
    price_type: priceType,
  };
}
