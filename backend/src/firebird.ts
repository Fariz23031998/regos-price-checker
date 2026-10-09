import { attachAsync, WIRE_CRYPT_ENABLE } from "node-firebird";
import { AppConfig } from "./config";
import { Row } from "./values";

const CONNECT_TIMEOUT_MS = 20000;
const QUERY_TIMEOUT_MS = 60000;

export interface FirebirdConnection {
  query(sql: string, params?: unknown[]): Promise<Row[]>;
  querySequential(sql: string, params?: unknown[]): Promise<Row[]>;
  detach(): Promise<void>;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function openDatabase(config: AppConfig, database: string): Promise<FirebirdConnection> {
  const connecting = attachAsync({
    host: config.host,
    port: config.port,
    database,
    user: config.user,
    password: config.password,
    lowercase_keys: false,
    encoding: "UTF8",
    wireCrypt: WIRE_CRYPT_ENABLE,
    numericMode: "safe",
    blobReadChunkSize: 65535,
  });

  let db;
  try {
    db = await withTimeout(connecting, CONNECT_TIMEOUT_MS, "Firebird connection timed out");
  } catch (error) {
    void connecting.then((late) => late.detachAsync()).catch(() => undefined);
    throw error;
  }

  return {
    query(sql: string, params: unknown[] = []) {
      return withTimeout(db.queryAsync<Row>(sql, params), QUERY_TIMEOUT_MS, "Firebird query timed out");
    },
    querySequential(sql: string, params: unknown[] = []) {
      const rows: Row[] = [];
      const reading = new Promise<Row[]>((resolve, reject) => {
        db.sequentially(
          sql,
          params,
          (row: Row) => {
            rows.push(row);
          },
          (error: unknown) => {
            if (error) reject(error instanceof Error ? error : new Error(String(error)));
            else resolve(rows);
          },
        );
      });
      return withTimeout(reading, QUERY_TIMEOUT_MS, "Firebird query timed out");
    },
    detach() {
      return db.detachAsync();
    },
  };
}
