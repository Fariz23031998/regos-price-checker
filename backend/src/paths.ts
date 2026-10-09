import path from "path";

export function backendRoot(): string {
  return path.resolve(__dirname, "..");
}
