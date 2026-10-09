import fs from "fs";
import { ensureConfig, ensureSettings, getConfig, getConfigError, getSettings, getSettingsError } from "./src/config";

const settingsPath = "settings.json";
const configPath = "config.json";
const settingsOriginal = fs.readFileSync(settingsPath, "utf8");
const configOriginal = fs.readFileSync(configPath, "utf8");

fs.writeFileSync(settingsPath, "{");
fs.writeFileSync(configPath, "[]");

try {
  ensureSettings();
  ensureConfig();
  const settingsAfter = fs.readFileSync(settingsPath, "utf8");
  const configAfter = fs.readFileSync(configPath, "utf8");
  console.log(`settingsError=${getSettingsError()}`);
  console.log(`configError=${getConfigError()}`);
  console.log(`settingsUntouched=${settingsAfter === "{"}`);
  console.log(`configUntouched=${configAfter === "[]"}`);
  console.log(`settingsSync=${getSettings().sync_time}`);
  console.log(`configPort=${getConfig().port}`);
} finally {
  fs.writeFileSync(settingsPath, settingsOriginal);
  fs.writeFileSync(configPath, configOriginal);
}
