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

export interface AdminState {
  config: AppConfig;
  settings: DisplaySettings;
  listeningPort: number;
  configError: string | null;
  settingsError: string | null;
  warning: string | null;
}

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
}

export interface ConnectionSettings {
  host: string;
  database: string;
  user: string;
  password: string;
  price_type: number;
}

export interface CatalogCounts {
  items: number;
  prices: number;
  barcodes: number;
}

export interface ServiceStatus {
  connected: boolean;
  lastSync: string | null;
  counts: CatalogCounts;
  lastError: string | null;
}

export type LookupResult =
  | {
      status: "found";
      name: string;
      unitName: string;
      price: number | null;
      itemId: number;
      hasImage: boolean;
      imageId: number | null;
      formulaError?: string;
    }
  | { status: "not_found" };

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
};

export const PRICE_FORMULA_HINT = "Переменные: price и exchangeRate.USD";

export const SCAN_PROMPT = "СКАНИРУЙТЕ ШТРИХКОД";
export const NOT_FOUND = "Товар не найдено!";
export const NO_PRICE = "Цена не указано!";
export const UPDATED = "Данные Обновились";
export const CONNECTION_ERROR = "Не получается подключится к базу данных...";
export const NO_DATA = "Нет данных. Проверьте соединение с базой данных.";
