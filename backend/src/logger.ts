import fs from "fs";
import path from "path";
import { backendRoot } from "./paths";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function fileStamp(now: Date): string {
  return `log-${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}.log`;
}

function lineStamp(now: Date): string {
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return String(error);
}

export function log(text: string): void {
  const now = new Date();
  const dir = path.join(backendRoot(), "logs");
  fs.mkdirSync(dir, { recursive: true });
  const line = `${lineStamp(now)} - ${text}\n`;
  fs.appendFileSync(path.join(dir, fileStamp(now)), line, "utf8");
  console.log(line.trimEnd());
}
