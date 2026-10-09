import { FormEvent, useEffect, useState } from "react";
import { applyMediaSelection, EMPTY_MEDIA_SELECTION, getAdmin, MediaSelection, saveAdmin } from "./api";
import { asLanguage, LANGUAGE_OPTIONS, Language, MessageKey, t } from "./i18n";
import { MediaSettingsFields } from "./mediaFields";
import { AppConfig, DisplaySettings } from "./types";

export function AdminPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [listeningPort, setListeningPort] = useState(0);
  const [configError, setConfigError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaSelection, setMediaSelection] = useState<MediaSelection>(EMPTY_MEDIA_SELECTION);
  const language = asLanguage(settings?.language);
  const text = (key: MessageKey, vars?: Record<string, string | number>) => t(language, key, vars);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    void getAdmin()
      .then((state) => {
        setConfig(state.config);
        setSettings({ ...state.settings, language: asLanguage(state.settings.language) });
        setListeningPort(state.listeningPort);
        setConfigError(state.configError ?? "");
        setSettingsError(state.settingsError ?? "");
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : t("ru", "loadFailed"));
      });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!config || !settings) return;
    setSaving(true);
    setError("");
    setWarning("");
    setNotice("");
    const previousPort = listeningPort;
    try {
      const saved = await saveAdmin(
        {
          host: config.host.trim(),
          port: Number(config.port),
          database: config.database.trim(),
          user: config.user.trim(),
          password: config.password,
          price_type: Number(config.price_type),
          check_time: Number(config.check_time),
          sqlite_path: config.sqlite_path.trim(),
          listen_port: Number(config.listen_port),
        },
        await applyMediaSelection(
          {
            sync_time: Number(settings.sync_time),
            name_font_size: Number(settings.name_font_size),
            price_font_size: Number(settings.price_font_size),
            background_color: settings.background_color.trim(),
            name_font_color: settings.name_font_color.trim(),
            price_font_color: settings.price_font_color.trim(),
            update_screen_time: Number(settings.update_screen_time),
            show_image: settings.show_image,
            price_formula_enabled: settings.price_formula_enabled,
            price_formula: settings.price_formula.trim(),
            price_prefix: settings.price_prefix,
            price_suffix: settings.price_suffix,
            background_image: settings.background_image,
            idle_media: settings.idle_media,
            language: asLanguage(settings.language),
          },
          mediaSelection,
        ),
      );
      if (
        previousPort > 0 &&
        saved.listeningPort !== previousPort &&
        window.location.port === String(previousPort)
      ) {
        window.location.assign(`${window.location.protocol}//${window.location.hostname}:${saved.listeningPort}/admin`);
        return;
      }
      setConfig(saved.config);
      setSettings({ ...saved.settings, language: asLanguage(saved.settings.language) });
      setListeningPort(saved.listeningPort);
      setConfigError(saved.configError ?? "");
      setSettingsError(saved.settingsError ?? "");
      if (saved.warning) setWarning(saved.warning);
      else setNotice(text("saved"));
      setMediaSelection(EMPTY_MEDIA_SELECTION);
      setSaving(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text("saveFailed"));
      setSaving(false);
    }
  }

  return (
    <form className="admin-page" onSubmit={onSubmit}>
      <a className="admin-back" href="/">
        {text("backToScreen")}
      </a>
      <section className="dialog">
        <h2>config.json</h2>
        {configError ? <p className="form-error">{configError}</p> : null}
        {listeningPort > 0 ? (
          <p className="admin-note">{text("serverListening", { port: listeningPort })}</p>
        ) : (
          <p className="form-error">{text("serverNotListening")}</p>
        )}
        {config ? (
          <div className="form-grid">
            <label htmlFor="host">{text("serverAddress")}</label>
            <input
              id="host"
              value={config.host}
              autoFocus
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, host: event.target.value })}
            />
            <label htmlFor="port">{text("firebirdPort")}</label>
            <input
              id="port"
              value={config.port}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, port: numberValue(event.target.value) })}
            />
            <label htmlFor="database">{text("databasePath")}</label>
            <input
              id="database"
              value={config.database}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, database: event.target.value })}
            />
            <label htmlFor="user">{text("userName")}</label>
            <input
              id="user"
              value={config.user}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, user: event.target.value })}
            />
            <label htmlFor="password">{text("password")}</label>
            <input
              id="password"
              value={config.password}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, password: event.target.value })}
            />
            <label htmlFor="price_type">{text("priceType")}</label>
            <input
              id="price_type"
              value={config.price_type}
              onChange={(event) => setConfig({ ...config, price_type: numberValue(event.target.value) })}
            />
            <label htmlFor="check_time">{text("checkInterval")}</label>
            <input
              id="check_time"
              value={config.check_time}
              onChange={(event) => setConfig({ ...config, check_time: numberValue(event.target.value) })}
            />
            <label htmlFor="sqlite_path">{text("sqlitePath")}</label>
            <input
              id="sqlite_path"
              value={config.sqlite_path}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, sqlite_path: event.target.value })}
            />
            <label htmlFor="listen_port">{text("listenPort")}</label>
            <input
              id="listen_port"
              value={config.listen_port}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, listen_port: numberValue(event.target.value) })}
            />
          </div>
        ) : (
          <p>{text("loading")}</p>
        )}
      </section>
      <section className="dialog">
        <h2>settings.json</h2>
        {settingsError ? <p className="form-error">{settingsError}</p> : null}
        {settings ? (
          <div className="form-grid">
            <label htmlFor="language">{text("language")}</label>
            <select
              id="language"
              value={language}
              onChange={(event) => setSettings({ ...settings, language: event.target.value as Language })}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label htmlFor="sync_time">{text("syncTime")}</label>
            <input
              id="sync_time"
              value={settings.sync_time}
              onChange={(event) => setSettings({ ...settings, sync_time: numberValue(event.target.value) })}
            />
            <label htmlFor="name_font_size">{text("nameSize")}</label>
            <input
              id="name_font_size"
              value={settings.name_font_size}
              onChange={(event) => setSettings({ ...settings, name_font_size: numberValue(event.target.value) })}
            />
            <label htmlFor="price_font_size">{text("priceSize")}</label>
            <input
              id="price_font_size"
              value={settings.price_font_size}
              onChange={(event) => setSettings({ ...settings, price_font_size: numberValue(event.target.value) })}
            />
            <label htmlFor="background_color">{text("backgroundColor")}</label>
            <input
              id="background_color"
              value={settings.background_color}
              onChange={(event) => setSettings({ ...settings, background_color: event.target.value })}
            />
            <label htmlFor="name_font_color">{text("nameColor")}</label>
            <input
              id="name_font_color"
              value={settings.name_font_color}
              onChange={(event) => setSettings({ ...settings, name_font_color: event.target.value })}
            />
            <label htmlFor="price_font_color">{text("priceColor")}</label>
            <input
              id="price_font_color"
              value={settings.price_font_color}
              onChange={(event) => setSettings({ ...settings, price_font_color: event.target.value })}
            />
            <label htmlFor="price_prefix">{text("pricePrefix")}</label>
            <input
              id="price_prefix"
              value={settings.price_prefix}
              maxLength={40}
              onChange={(event) => setSettings({ ...settings, price_prefix: event.target.value })}
            />
            <label htmlFor="price_suffix">{text("priceSuffix")}</label>
            <input
              id="price_suffix"
              value={settings.price_suffix}
              maxLength={40}
              onChange={(event) => setSettings({ ...settings, price_suffix: event.target.value })}
            />
            <p className="form-hint form-span">{text("priceAffixHint")}</p>
            <label htmlFor="update_screen_time">{text("screenReset")}</label>
            <input
              id="update_screen_time"
              value={settings.update_screen_time}
              onChange={(event) =>
                setSettings({ ...settings, update_screen_time: numberValue(event.target.value) })
              }
            />
            <label htmlFor="show_image">{text("image")}</label>
            <input
              id="show_image"
              type="checkbox"
              checked={settings.show_image}
              onChange={(event) => setSettings({ ...settings, show_image: event.target.checked })}
            />
            <MediaSettingsFields
              language={language}
              backgroundImage={settings.background_image}
              idleMedia={settings.idle_media}
              selection={mediaSelection}
              onSelection={setMediaSelection}
            />
            <label htmlFor="price_formula_enabled">{text("priceFormula")}</label>
            <input
              id="price_formula_enabled"
              type="checkbox"
              checked={settings.price_formula_enabled}
              onChange={(event) =>
                setSettings({ ...settings, price_formula_enabled: event.target.checked })
              }
            />
            <label htmlFor="price_formula" className="form-span">
              {text("formula")}
            </label>
            <input
              id="price_formula"
              className="form-span"
              value={settings.price_formula}
              placeholder="Math.ceil(price / 1000) * 1000"
              onChange={(event) => setSettings({ ...settings, price_formula: event.target.value })}
            />
            <p className="form-hint form-span">{text("formulaHint")}</p>
            <button type="submit" disabled={saving || !config}>
              {text("save")}
            </button>
          </div>
        ) : null}
        {notice ? <p className="admin-note">{notice}</p> : null}
        {warning ? <p className="form-warning">{warning}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>
    </form>
  );
}

function numberValue(value: string): number {
  if (value.trim() === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
