import { AppConfig, getConfig, updateCheckTime } from "./config";
import { openDatabase, FirebirdConnection } from "./firebird";
import { errorMessage, log } from "./logger";
import { getShortPathName } from "./shortPath";
import {
  BarcodeRow,
  CatalogCounts,
  getCounts,
  CurrencyRow,
  ImageRow,
  ItemRow,
  PriceRow,
  replaceCatalog,
} from "./sqlite";
import { asInt, asNumber, asText, asTimestamp, field, Row } from "./values";

export interface ServiceStatus {
  connected: boolean;
  lastSync: string | null;
  counts: CatalogCounts;
  lastError: string | null;
}

const ITEMS_SQL = `
  SELECT
    ITM_ID, ITM_CODE, ITM_NAME, ITM_UNIT, ITM_GROUP, ITM_DELETED_MARK,
    UNT_ID, UNT_NAME,
    ITMG_ID, ITMG_NAME
  FROM CTLG_ITM_ITEMS_REF
  LEFT OUTER JOIN CTLG_UNT_UNITS_REF ON ITM_UNIT = UNT_ID
  LEFT OUTER JOIN CTLG_ITM_GROUPS_REF ON ITM_GROUP = ITMG_ID
  WHERE ITM_DELETED_MARK = 0
`;

const PRICES_SQL = `
  SELECT PRC_ITEM, PRC_PRICE_TYPE, PRC_VALUE
  FROM CTLG_ITM_PRICES_REF
  WHERE PRC_PRICE_TYPE = ?
`;

const BARCODES_SQL = `
  SELECT BRCD_ID, BRCD_ITEM, BRCD_VALUE, BRCD_DELETED
  FROM CTLG_ITM_BARCODES_REF
  WHERE BRCD_DELETED = 0
`;

const IMAGES_SQL = `
  SELECT IMG_ID, IMG_ITEM, OCTET_LENGTH(IMG_FILE) AS IMG_BYTES, IMG_LAST_UPDATE, IMG_FILE
  FROM CTLG_ITM_IMAGES_REF
  WHERE IMG_DELETED = 0 AND IMG_FILE IS NOT NULL
`;

const CASH_SQL = `
  SELECT S.SST_DATE, S.SST_STATUS
  FROM SYS_SYNC_PROCCESS_REF S
  WHERE S.SST_STATUS = 1
`;

const ITEM_CHANGE_SQL = `
  SELECT FIRST 1 ITM_LAST_UPDATE
  FROM CTLG_ITM_ITEMS_REF
  ORDER BY ITM_LAST_UPDATE DESC
`;

const PRICE_CHANGE_SQL = `
  SELECT FIRST 1 PRC_LAST_UPDATE
  FROM CTLG_ITM_PRICES_REF
  ORDER BY PRC_LAST_UPDATE DESC
`;

const IMAGE_CHANGE_SQL = `
  SELECT FIRST 1 IMG_LAST_UPDATE
  FROM CTLG_ITM_IMAGES_REF
  ORDER BY IMG_LAST_UPDATE DESC
`;

const CURRENCIES_SQL = `
  SELECT CRNC_ID, CRNC_CODE_CHR, CRNC_EXCHANGE_RATE
  FROM CTLG_COMMON_CURRENCY_REF
  WHERE CRNC_DELETED = 0
`;

const CURRENCY_CHANGE_SQL = `
  SELECT FIRST 1 CRNC_LAST_UPDATE
  FROM CTLG_COMMON_CURRENCY_REF
  ORDER BY CRNC_LAST_UPDATE DESC
`;

export class SyncService {
  private db: FirebirdConnection | null = null;
  private connected = false;
  private hasCompletedSync = false;
  private lastSyncMarker = 0;
  private lastChangesTimestamp = 0;
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private timer: NodeJS.Timeout | null = null;
  private tail: Promise<unknown> = Promise.resolve();

  start(): Promise<void> {
    return this.enqueue(() => this.tick(true)).finally(() => {
      this.reschedule();
    });
  }

  setCheckTime(seconds: number): void {
    updateCheckTime(seconds);
    this.reschedule();
  }

  applyCheckTime(): void {
    this.reschedule();
  }

  getStatus(): ServiceStatus {
    return {
      connected: this.connected,
      lastSync: this.lastSyncAt,
      counts: getCounts(),
      lastError: this.lastError,
    };
  }

  forceSync(): Promise<ServiceStatus> {
    return this.enqueue(async () => {
      if (!this.connected) {
        const ok = await this.connect();
        if (!ok) throw new Error(this.lastError ?? "Can't connect to the Firebird.");
      }
      await this.syncAll();
      await this.captureMarkers();
      return this.getStatus();
    });
  }

  reconnectAndSync(): Promise<ServiceStatus> {
    return this.enqueue(async () => {
      await this.safeDetach();
      this.connected = false;
      const ok = await this.connect();
      if (!ok) throw new Error(this.lastError ?? "Can't connect to the Firebird.");
      await this.syncAll();
      await this.captureMarkers();
      return this.getStatus();
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private reschedule(): void {
    if (this.timer) clearTimeout(this.timer);
    const seconds = Math.max(1, getConfig().check_time);
    this.timer = setTimeout(() => {
      void this.enqueue(() => this.tick(false))
        .catch((error: unknown) => {
          log(`Service error: ${errorMessage(error)}`);
        })
        .finally(() => this.reschedule());
    }, seconds * 1000);
  }

  private async tick(force: boolean): Promise<void> {
    try {
      if (!this.connected) {
        const ok = await this.connect();
        if (!ok) return;
        if (force || !this.hasCompletedSync) {
          await this.syncAll();
          await this.captureMarkers();
          return;
        }
      }

      if (force) {
        await this.syncAll();
        await this.captureMarkers();
        return;
      }

      const markers = await this.readMarkers();
      if (!markers) return;
      const changed = markers.cash > this.lastSyncMarker || markers.latest > this.lastChangesTimestamp;
      if (!changed) return;

      await this.syncAll();
      this.lastSyncMarker = markers.cash;
      this.lastChangesTimestamp = markers.latest;
    } catch (error) {
      log(`Service error: ${errorMessage(error)}`);
    }
  }

  private async connect(): Promise<boolean> {
    const config = getConfig();
    try {
      const database = await getShortPathName(config.database);
      this.db = await openDatabase(config, database);
      this.connected = true;
      this.lastError = null;
      log("Connected to the Firebird.");
      return true;
    } catch (error) {
      this.connected = false;
      this.db = null;
      this.lastError = errorMessage(error);
      log("Can't connect to the Firebird.");
      log(`Error: ${this.lastError}`);
      return false;
    }
  }

  private async safeDetach(): Promise<void> {
    const current = this.db;
    this.db = null;
    if (!current) return;
    try {
      await current.detach();
    } catch (error) {
      log(`Error: ${errorMessage(error)}`);
    }
  }

  private async readMarkers(): Promise<{ cash: number; latest: number } | null> {
    if (!this.db) {
      this.connected = false;
      return null;
    }

    try {
      const cashRows = await this.db.query(CASH_SQL);
      let cash = 0;
      for (const row of cashRows) {
        const timestamp = asTimestamp(field(row, "SST_DATE"));
        if (timestamp > cash) cash = timestamp;
      }

      const itemRows = await this.db.query(ITEM_CHANGE_SQL);
      const priceRows = await this.db.query(PRICE_CHANGE_SQL);
      const imageRows = await this.db.query(IMAGE_CHANGE_SQL);
      const currencyRows = await this.db.query(CURRENCY_CHANGE_SQL);
      const latest = Math.max(
        asTimestamp(itemRows[0] ? field(itemRows[0], "ITM_LAST_UPDATE") : 0),
        asTimestamp(priceRows[0] ? field(priceRows[0], "PRC_LAST_UPDATE") : 0),
        asTimestamp(imageRows[0] ? field(imageRows[0], "IMG_LAST_UPDATE") : 0),
        asTimestamp(currencyRows[0] ? field(currencyRows[0], "CRNC_LAST_UPDATE") : 0),
      );
      return { cash, latest };
    } catch (error) {
      this.failConnection(error);
      return null;
    }
  }

  private async captureMarkers(): Promise<void> {
    const markers = await this.readMarkers();
    if (!markers) return;
    this.lastSyncMarker = markers.cash;
    this.lastChangesTimestamp = markers.latest;
  }

  private async syncAll(): Promise<void> {
    if (!this.db) throw new Error("Can't connect to the Firebird.");
    const config: AppConfig = getConfig();
    try {
      const items = mapItems(await this.db.query(ITEMS_SQL));
      const prices = mapPrices(await this.db.query(PRICES_SQL, [config.price_type]));
      const barcodes = mapBarcodes(await this.db.query(BARCODES_SQL));
      const images = mapImages(await this.db.querySequential(IMAGES_SQL));
      const currencies = mapCurrencies(await this.db.query(CURRENCIES_SQL));
      replaceCatalog(items, prices, barcodes, images, currencies);
      this.hasCompletedSync = true;
      this.lastError = null;
      this.lastSyncAt = new Date().toISOString();
      log(
        `Synced ${items.length} items, ${prices.length} prices, ${barcodes.length} barcodes, ${images.length} images, ${currencies.length} currencies.`,
      );
    } catch (error) {
      this.failConnection(error);
      throw error;
    }
  }

  private failConnection(error: unknown): void {
    this.connected = false;
    this.lastError = errorMessage(error);
    log(`Error: ${this.lastError}`);
    void this.safeDetach();
  }
}

function mapItems(rows: Row[]): ItemRow[] {
  const items: ItemRow[] = [];
  for (const row of rows) {
    const id = asInt(field(row, "ITM_ID"));
    if (id == null) continue;
    items.push({
      ITM_ID: id,
      ITM_CODE: asText(field(row, "ITM_CODE")),
      ITM_NAME: asText(field(row, "ITM_NAME")),
      ITM_UNIT: asInt(field(row, "ITM_UNIT")),
      ITM_GROUP: asInt(field(row, "ITM_GROUP")),
      ITM_DELETED_MARK: asInt(field(row, "ITM_DELETED_MARK")),
      UNT_ID: asInt(field(row, "UNT_ID")),
      UNT_NAME: asText(field(row, "UNT_NAME")),
      ITMG_ID: asInt(field(row, "ITMG_ID")),
      ITMG_NAME: asText(field(row, "ITMG_NAME")),
    });
  }
  return items;
}

function mapPrices(rows: Row[]): PriceRow[] {
  const prices: PriceRow[] = [];
  for (const row of rows) {
    const itemId = asInt(field(row, "PRC_ITEM"));
    const priceType = asInt(field(row, "PRC_PRICE_TYPE"));
    if (itemId == null || priceType == null) continue;
    prices.push({
      PRC_ITEM: itemId,
      PRC_PRICE_TYPE: priceType,
      PRC_VALUE: asNumber(field(row, "PRC_VALUE")),
    });
  }
  return prices;
}

function mapImages(rows: Row[]): ImageRow[] {
  const byItem = new Map<number, { image: ImageRow; updated: number }>();
  for (const row of rows) {
    const itemId = asInt(field(row, "IMG_ITEM"));
    const id = asInt(field(row, "IMG_ID"));
    const data = asBuffer(field(row, "IMG_FILE"));
    if (itemId == null || id == null || !data || data.length === 0) continue;
    const bytes = asInt(field(row, "IMG_BYTES"));
    if (bytes != null && data.length !== bytes) continue;
    const updated = asTimestamp(field(row, "IMG_LAST_UPDATE"));
    const image: ImageRow = {
      IMG_ITEM: itemId,
      IMG_ID: id,
      MIME: imageMime(data),
      DATA: data,
    };
    const current = byItem.get(itemId);
    if (!current || updated > current.updated || (updated === current.updated && id > current.image.IMG_ID)) {
      byItem.set(itemId, { image, updated });
    }
  }
  return [...byItem.values()].map((entry) => entry.image);
}

function asBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

function imageMime(data: Buffer): string {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return "image/png";
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (data.length >= 6) {
    const signature = data.subarray(0, 6).toString("ascii");
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
}

function mapCurrencies(rows: Row[]): CurrencyRow[] {
  const currencies: CurrencyRow[] = [];
  for (const row of rows) {
    const id = asInt(field(row, "CRNC_ID"));
    const code = asText(field(row, "CRNC_CODE_CHR"));
    const rate = asNumber(field(row, "CRNC_EXCHANGE_RATE"));
    if (id == null || !code || rate == null) continue;
    currencies.push({
      CRNC_ID: id,
      CRNC_CODE: code,
      CRNC_EXCHANGE_RATE: rate,
    });
  }
  return currencies;
}

function mapBarcodes(rows: Row[]): BarcodeRow[] {
  const barcodes: BarcodeRow[] = [];
  for (const row of rows) {
    const id = asInt(field(row, "BRCD_ID"));
    const itemId = asInt(field(row, "BRCD_ITEM"));
    if (id == null || itemId == null) continue;
    barcodes.push({
      BRCD_ID: id,
      BRCD_ITEM: itemId,
      BRCD_VALUE: asText(field(row, "BRCD_VALUE")),
      BRCD_DELETED: asInt(field(row, "BRCD_DELETED")),
    });
  }
  return barcodes;
}
