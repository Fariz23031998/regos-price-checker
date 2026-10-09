import { FormEvent, useEffect, useState } from "react";
import { getAdmin, saveAdmin } from "./api";
import { AppConfig, DisplaySettings, PRICE_FORMULA_HINT } from "./types";

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

  useEffect(() => {
    void getAdmin()
      .then((state) => {
        setConfig(state.config);
        setSettings(state.settings);
        setListeningPort(state.listeningPort);
        setConfigError(state.configError ?? "");
        setSettingsError(state.settingsError ?? "");
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить настройки");
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
        },
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
      setSettings(saved.settings);
      setListeningPort(saved.listeningPort);
      setConfigError(saved.configError ?? "");
      setSettingsError(saved.settingsError ?? "");
      if (saved.warning) setWarning(saved.warning);
      else setNotice("Сохранено");
      setSaving(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить настройки");
      setSaving(false);
    }
  }

  return (
    <form className="admin-page" onSubmit={onSubmit}>
      <a className="admin-back" href="/">
        К экрану
      </a>
      <section className="dialog">
        <h2>config.json</h2>
        {configError ? <p className="form-error">{configError}</p> : null}
        {listeningPort > 0 ? (
          <p className="admin-note">Сервер слушает порт {listeningPort}</p>
        ) : (
          <p className="form-error">Сервер не слушает порт</p>
        )}
        {config ? (
          <div className="form-grid">
            <label htmlFor="host">Ip адрес сервера</label>
            <input
              id="host"
              value={config.host}
              autoFocus
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, host: event.target.value })}
            />
            <label htmlFor="port">Порт Firebird</label>
            <input
              id="port"
              value={config.port}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, port: numberValue(event.target.value) })}
            />
            <label htmlFor="database">Пут к базу данных</label>
            <input
              id="database"
              value={config.database}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, database: event.target.value })}
            />
            <label htmlFor="user">Имя Пользователя</label>
            <input
              id="user"
              value={config.user}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, user: event.target.value })}
            />
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              value={config.password}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, password: event.target.value })}
            />
            <label htmlFor="price_type">Вид цена</label>
            <input
              id="price_type"
              value={config.price_type}
              onChange={(event) => setConfig({ ...config, price_type: numberValue(event.target.value) })}
            />
            <label htmlFor="check_time">Интервал проверки</label>
            <input
              id="check_time"
              value={config.check_time}
              onChange={(event) => setConfig({ ...config, check_time: numberValue(event.target.value) })}
            />
            <label htmlFor="sqlite_path">Путь SQLite</label>
            <input
              id="sqlite_path"
              value={config.sqlite_path}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, sqlite_path: event.target.value })}
            />
            <label htmlFor="listen_port">Порт сервера</label>
            <input
              id="listen_port"
              value={config.listen_port}
              autoComplete="off"
              onChange={(event) => setConfig({ ...config, listen_port: numberValue(event.target.value) })}
            />
          </div>
        ) : (
          <p>Загрузка...</p>
        )}
      </section>
      <section className="dialog">
        <h2>settings.json</h2>
        {settingsError ? <p className="form-error">{settingsError}</p> : null}
        {settings ? (
          <div className="form-grid">
            <label htmlFor="sync_time">Время Синхронизации</label>
            <input
              id="sync_time"
              value={settings.sync_time}
              onChange={(event) => setSettings({ ...settings, sync_time: numberValue(event.target.value) })}
            />
            <label htmlFor="name_font_size">Размер Названия</label>
            <input
              id="name_font_size"
              value={settings.name_font_size}
              onChange={(event) => setSettings({ ...settings, name_font_size: numberValue(event.target.value) })}
            />
            <label htmlFor="price_font_size">Размер Цена</label>
            <input
              id="price_font_size"
              value={settings.price_font_size}
              onChange={(event) => setSettings({ ...settings, price_font_size: numberValue(event.target.value) })}
            />
            <label htmlFor="background_color">Цвет фона</label>
            <input
              id="background_color"
              value={settings.background_color}
              onChange={(event) => setSettings({ ...settings, background_color: event.target.value })}
            />
            <label htmlFor="name_font_color">Цвет Названия</label>
            <input
              id="name_font_color"
              value={settings.name_font_color}
              onChange={(event) => setSettings({ ...settings, name_font_color: event.target.value })}
            />
            <label htmlFor="price_font_color">Цвет Цена</label>
            <input
              id="price_font_color"
              value={settings.price_font_color}
              onChange={(event) => setSettings({ ...settings, price_font_color: event.target.value })}
            />
            <label htmlFor="update_screen_time">Время Обновление экрана</label>
            <input
              id="update_screen_time"
              value={settings.update_screen_time}
              onChange={(event) =>
                setSettings({ ...settings, update_screen_time: numberValue(event.target.value) })
              }
            />
            <label htmlFor="show_image">Изображение</label>
            <input
              id="show_image"
              type="checkbox"
              checked={settings.show_image}
              onChange={(event) => setSettings({ ...settings, show_image: event.target.checked })}
            />
            <label htmlFor="price_formula_enabled">Формула цены</label>
            <input
              id="price_formula_enabled"
              type="checkbox"
              checked={settings.price_formula_enabled}
              onChange={(event) =>
                setSettings({ ...settings, price_formula_enabled: event.target.checked })
              }
            />
            <label htmlFor="price_formula" className="form-span">
              Формула
            </label>
            <input
              id="price_formula"
              className="form-span"
              value={settings.price_formula}
              placeholder="Math.ceil(price / 1000) * 1000"
              onChange={(event) => setSettings({ ...settings, price_formula: event.target.value })}
            />
            <p className="form-hint form-span">{PRICE_FORMULA_HINT}</p>
            <button type="submit" disabled={saving || !config}>
              Сохранить
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
