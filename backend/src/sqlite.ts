import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { backendRoot } from "./paths";

export interface ItemRow {
  ITM_ID: number;
  ITM_CODE: string;
  ITM_NAME: string;
  ITM_UNIT: number | null;
  ITM_GROUP: number | null;
  ITM_DELETED_MARK: number | null;
  UNT_ID: number | null;
  UNT_NAME: string;
  ITMG_ID: number | null;
  ITMG_NAME: string;
}

export interface PriceRow {
  PRC_ITEM: number;
  PRC_PRICE_TYPE: number;
  PRC_VALUE: number | null;
}

export interface BarcodeRow {
  BRCD_ID: number;
  BRCD_ITEM: number;
  BRCD_VALUE: string;
  BRCD_DELETED: number | null;
}

export interface ImageRow {
  IMG_ITEM: number;
  IMG_ID: number;
  MIME: string;
  DATA: Buffer;
}

export interface CurrencyRow {
  CRNC_ID: number;
  CRNC_CODE: string;
  CRNC_EXCHANGE_RATE: number;
}

export interface StoredImage {
  id: number;
  mime: string;
  data: Buffer;
}

export interface CatalogCounts {
  items: number;
  prices: number;
  barcodes: number;
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

let database: Database.Database | null = null;
let openedPath: string | null = null;
let staged = false;
let stagedPrevious: Database.Database | null = null;
let stagedPreviousPath: string | null = null;

const EMPTY_COUNTS: CatalogCounts = { items: 0, prices: 0, barcodes: 0 };

export function resolveSqlitePath(sqlitePath: string): string {
  const fullPath = path.isAbsolute(sqlitePath) ? sqlitePath : path.join(backendRoot(), sqlitePath);
  return path.normalize(fullPath);
}

export function openSqliteFile(sqlitePath: string): Database.Database {
  const fullPath = resolveSqlitePath(sqlitePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const connection = new Database(fullPath);
  try {
    prepareDatabase(connection);
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

export function initDatabase(sqlitePath: string): void {
  const next = openSqliteFile(sqlitePath);
  const previous = database;
  database = next;
  openedPath = resolveSqlitePath(sqlitePath);
  previous?.close();
}

export function swapDatabase(next: Database.Database, sqlitePath: string): void {
  stagedPrevious = database;
  stagedPreviousPath = openedPath;
  database = next;
  openedPath = resolveSqlitePath(sqlitePath);
  staged = true;
}

export function rollbackDatabase(): void {
  if (!staged) return;
  const failed = database;
  database = stagedPrevious;
  openedPath = stagedPreviousPath;
  stagedPrevious = null;
  stagedPreviousPath = null;
  staged = false;
  failed?.close();
}

export function commitDatabaseSwap(): void {
  if (!staged) return;
  stagedPrevious?.close();
  stagedPrevious = null;
  stagedPreviousPath = null;
  staged = false;
}

function prepareDatabase(connection: Database.Database): void {
  connection.pragma("journal_mode = WAL");
  connection.pragma("busy_timeout = 5000");
  connection.exec(`
    CREATE TABLE IF NOT EXISTS items (
      ITM_ID INTEGER PRIMARY KEY,
      ITM_CODE TEXT,
      ITM_NAME TEXT,
      ITM_UNIT INTEGER,
      ITM_GROUP INTEGER,
      ITM_DELETED_MARK INTEGER,
      UNT_ID INTEGER,
      UNT_NAME TEXT,
      ITMG_ID INTEGER,
      ITMG_NAME TEXT
    );

    CREATE TABLE IF NOT EXISTS prices (
      PRC_ITEM INTEGER,
      PRC_PRICE_TYPE INTEGER,
      PRC_VALUE REAL
    );

    CREATE TABLE IF NOT EXISTS barcodes (
      BRCD_ID INTEGER PRIMARY KEY,
      BRCD_ITEM INTEGER,
      BRCD_VALUE TEXT,
      BRCD_DELETED INTEGER
    );

    CREATE TABLE IF NOT EXISTS images (
      IMG_ITEM INTEGER PRIMARY KEY,
      IMG_ID INTEGER,
      MIME TEXT,
      DATA BLOB
    );

    CREATE TABLE IF NOT EXISTS currencies (
      CRNC_ID INTEGER PRIMARY KEY,
      CRNC_CODE TEXT,
      CRNC_EXCHANGE_RATE REAL
    );

    CREATE INDEX IF NOT EXISTS idx_barcodes_item ON barcodes (BRCD_ITEM);
    CREATE INDEX IF NOT EXISTS idx_prices_item ON prices (PRC_ITEM);
  `);
}

function db(): Database.Database {
  if (!database) throw new Error("SQLite is not initialized");
  return database;
}

export function replaceCatalog(
  items: ItemRow[],
  prices: PriceRow[],
  barcodes: BarcodeRow[],
  images: ImageRow[],
  currencies: CurrencyRow[],
): void {
  const connection = db();
  const insertItem = connection.prepare(`
    INSERT OR REPLACE INTO items (
      ITM_ID, ITM_CODE, ITM_NAME, ITM_UNIT, ITM_GROUP, ITM_DELETED_MARK,
      UNT_ID, UNT_NAME, ITMG_ID, ITMG_NAME
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPrice = connection.prepare(`
    INSERT INTO prices (PRC_ITEM, PRC_PRICE_TYPE, PRC_VALUE) VALUES (?, ?, ?)
  `);
  const insertBarcode = connection.prepare(`
    INSERT OR REPLACE INTO barcodes (BRCD_ID, BRCD_ITEM, BRCD_VALUE, BRCD_DELETED) VALUES (?, ?, ?, ?)
  `);
  const insertImage = connection.prepare(`
    INSERT INTO images (IMG_ITEM, IMG_ID, MIME, DATA) VALUES (?, ?, ?, ?)
  `);
  const insertCurrency = connection.prepare(`
    INSERT INTO currencies (CRNC_ID, CRNC_CODE, CRNC_EXCHANGE_RATE) VALUES (?, ?, ?)
  `);

  const write = connection.transaction(() => {
    connection.exec(
      "DELETE FROM barcodes; DELETE FROM prices; DELETE FROM items; DELETE FROM images; DELETE FROM currencies;",
    );
    for (const item of items) {
      insertItem.run(
        item.ITM_ID,
        item.ITM_CODE,
        item.ITM_NAME,
        item.ITM_UNIT,
        item.ITM_GROUP,
        item.ITM_DELETED_MARK,
        item.UNT_ID,
        item.UNT_NAME,
        item.ITMG_ID,
        item.ITMG_NAME,
      );
    }
    for (const price of prices) {
      insertPrice.run(price.PRC_ITEM, price.PRC_PRICE_TYPE, price.PRC_VALUE);
    }
    for (const barcode of barcodes) {
      insertBarcode.run(barcode.BRCD_ID, barcode.BRCD_ITEM, barcode.BRCD_VALUE, barcode.BRCD_DELETED);
    }
    for (const image of images) {
      insertImage.run(image.IMG_ITEM, image.IMG_ID, image.MIME, image.DATA);
    }
    for (const currency of currencies) {
      insertCurrency.run(currency.CRNC_ID, currency.CRNC_CODE, currency.CRNC_EXCHANGE_RATE);
    }
  });

  write();
}

export function getCounts(): CatalogCounts {
  if (!database) return { ...EMPTY_COUNTS };
  const connection = database;
  const count = (table: "items" | "prices" | "barcodes") => {
    const row = connection.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
    return row.c;
  };
  return {
    items: count("items"),
    prices: count("prices"),
    barcodes: count("barcodes"),
  };
}

interface LookupRow {
  ITM_ID: number | null;
  ITM_NAME: string | null;
  UNT_NAME: string | null;
  PRC_VALUE: number | null;
  IMG_ID: number | null;
}

interface ImageRecord {
  IMG_ID: number;
  MIME: string | null;
  DATA: Buffer | null;
}

export function lookupBarcode(barcode: string): LookupResult {
  if (!database) throw new Error("База SQLite не открыта");
  const row = database
    .prepare(
      `SELECT i.ITM_ID AS ITM_ID, i.ITM_NAME AS ITM_NAME, i.UNT_NAME AS UNT_NAME,
              p.PRC_VALUE AS PRC_VALUE, img.IMG_ID AS IMG_ID
       FROM barcodes b
       INNER JOIN items i ON i.ITM_ID = b.BRCD_ITEM
       LEFT JOIN prices p ON p.PRC_ITEM = i.ITM_ID
       LEFT JOIN images img ON img.IMG_ITEM = i.ITM_ID
       WHERE INSTR(LOWER(b.BRCD_VALUE), LOWER(?)) > 0
       ORDER BY b.BRCD_ID
       LIMIT 1`,
    )
    .get(barcode) as LookupRow | undefined;

  if (!row) return { status: "not_found" };
  const imageId = row.IMG_ID == null ? null : Number(row.IMG_ID);
  return {
    status: "found",
    name: row.ITM_NAME ?? "",
    unitName: row.UNT_NAME ?? "",
    price: row.PRC_VALUE == null ? null : Number(row.PRC_VALUE),
    itemId: Number(row.ITM_ID),
    hasImage: imageId != null,
    imageId,
  };
}

export function getExchangeRates(): Record<string, number> {
  if (!database) return {};
  const rows = database
    .prepare(`SELECT CRNC_CODE, CRNC_EXCHANGE_RATE FROM currencies ORDER BY CRNC_ID`)
    .all() as Array<{ CRNC_CODE: string | null; CRNC_EXCHANGE_RATE: number | null }>;
  const rates: Record<string, number> = {};
  for (const row of rows) {
    const code = (row.CRNC_CODE ?? "").trim();
    const rate = row.CRNC_EXCHANGE_RATE == null ? Number.NaN : Number(row.CRNC_EXCHANGE_RATE);
    if (!code || !Number.isFinite(rate)) continue;
    rates[code] = rate;
  }
  return rates;
}

export function getImage(itemId: number): StoredImage | null {
  if (!database) return null;
  const row = database
    .prepare(`SELECT IMG_ID, MIME, DATA FROM images WHERE IMG_ITEM = ?`)
    .get(itemId) as ImageRecord | undefined;
  if (!row || !row.DATA || row.DATA.length === 0) return null;
  return {
    id: Number(row.IMG_ID),
    mime: row.MIME || "application/octet-stream",
    data: row.DATA,
  };
}
