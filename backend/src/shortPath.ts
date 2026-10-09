import { execFile } from "child_process";
import fs from "fs";
import { errorMessage, log } from "./logger";

export function getShortPathName(longPath: string): Promise<string> {
  const normalized = longPath.replaceAll("/", "\\");
  if (process.platform !== "win32" || !fs.existsSync(normalized)) {
    return Promise.resolve(normalized);
  }

  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `(New-Object -ComObject Scripting.FileSystemObject).GetFile(${JSON.stringify(normalized)}).ShortPath`,
      ],
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          log(`Error getting short path name: ${errorMessage(error)}`);
          resolve(normalized);
          return;
        }
        const shortPath = stdout.replace(/^\uFEFF/, "").trim();
        resolve(shortPath || normalized);
      },
    );
  });
}
