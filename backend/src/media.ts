import fs from "fs";
import path from "path";
import { backendRoot } from "./paths";

export const IMAGE_EXTENSIONS = ["jpg", "png", "webp", "gif"] as const;
export const IDLE_EXTENSIONS = ["jpg", "png", "webp", "gif", "mp4", "webm"] as const;
export const IMAGE_BYTE_LIMIT = 20 * 1024 * 1024;
export const VIDEO_BYTE_LIMIT = 200 * 1024 * 1024;

export type MediaKind = "background" | "idle";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function mediaDir(): string {
  return path.join(backendRoot(), "media");
}

function extensionsFor(kind: MediaKind): readonly string[] {
  return kind === "background" ? IMAGE_EXTENSIONS : IDLE_EXTENSIONS;
}

function mediaPath(kind: MediaKind, ext: string): string {
  return path.join(mediaDir(), `${kind}.${ext}`);
}

function extensionFromName(originalName: string): string {
  const base = path.basename(originalName);
  const dot = base.lastIndexOf(".");
  if (dot < 1) return "";
  const raw = base.slice(dot + 1).toLowerCase();
  if (raw === "jpeg") return "jpg";
  return extensionsFor("idle").includes(raw) ? raw : "";
}

export function normalizeMediaToken(kind: MediaKind, value: unknown): string {
  if (typeof value !== "string") return "";
  const token = value.trim().toLowerCase();
  if (!token || !extensionsFor(kind).includes(token)) return "";
  if (!fs.existsSync(mediaPath(kind, token))) return "";
  return token;
}

export function resolveMediaExtension(kind: MediaKind, mime: string, originalName: string, size: number): string {
  if (!Number.isFinite(size) || size <= 0) throw new Error("Выберите файл");
  const fromName = extensionFromName(originalName);
  const fromMime = MIME_TO_EXT[mime.toLowerCase()] ?? "";
  if (fromMime && fromName && fromMime !== fromName) {
    throw new Error("Тип файла не совпадает с расширением");
  }
  const octet = mime === "" || mime.toLowerCase() === "application/octet-stream";
  const ext = fromMime || (octet ? fromName : "");
  if (!ext || !extensionsFor(kind).includes(ext)) {
    throw new Error(
      kind === "background"
        ? "Для фона выберите изображение JPEG, PNG, WEBP или GIF"
        : "Для рекламы выберите фото JPEG, PNG, WEBP, GIF или видео MP4, WEBM",
    );
  }
  const image = (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
  if (image && size > IMAGE_BYTE_LIMIT) throw new Error("Изображение не должно быть больше 20 МБ");
  if (!image && size > VIDEO_BYTE_LIMIT) throw new Error("Видео не должно быть больше 200 МБ");
  return ext;
}

export function storeUploadedFile(
  kind: MediaKind,
  tempPath: string,
  mime: string,
  originalName: string,
  size: number,
): string {
  const ext = resolveMediaExtension(kind, mime, originalName, size);
  const root = path.resolve(mediaDir());
  const resolvedTemp = path.resolve(tempPath);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!resolvedTemp.startsWith(prefix)) throw new Error("Не удалось сохранить файл");
  fs.mkdirSync(root, { recursive: true });
  const dest = mediaPath(kind, ext);
  fs.copyFileSync(resolvedTemp, dest);
  try {
    fs.unlinkSync(resolvedTemp);
  } catch {
    // The stored file is already in place.
  }
  for (const other of extensionsFor(kind)) {
    if (other === ext) continue;
    const extra = mediaPath(kind, other);
    if (fs.existsSync(extra)) fs.unlinkSync(extra);
  }
  return ext;
}

export function removeStoredMedia(kind: MediaKind): void {
  for (const ext of extensionsFor(kind)) {
    const filePath = mediaPath(kind, ext);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

export function findMedia(kind: MediaKind): { ext: string; filePath: string; mime: string } | null {
  for (const ext of extensionsFor(kind)) {
    const filePath = mediaPath(kind, ext);
    if (!fs.existsSync(filePath)) continue;
    const mime = MIME[ext];
    if (!mime) continue;
    return { ext, filePath, mime };
  }
  return null;
}
