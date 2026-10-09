import { FormEvent, useEffect, useState } from "react";
import { getConnection, saveConnection, saveSettings } from "./api";
import { ConnectionSettings, DisplaySettings, PRICE_FORMULA_HINT } from "./types";

interface SettingsPanelProps {
  initial: DisplaySettings;
  onCancel: () => void;
  onSaved: (settings: DisplaySettings) => void;
}

interface ConnectionPanelProps {
  onCancel: () => void;
  onSaved: () => void;
}

export function SettingsPanel({ initial, onCancel, onSaved }: SettingsPanelProps) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await saveSettings({
        sync_time: Number(draft.sync_time),
        name_font_size: Number(draft.name_font_size),
        price_font_size: Number(draft.price_font_size),
        background_color: draft.background_color.trim(),
        name_font_color: draft.name_font_color.trim(),
        price_font_color: draft.price_font_color.trim(),
        update_screen_time: Number(draft.update_screen_time),
        show_image: draft.show_image,
        price_formula_enabled: draft.price_formula_enabled,
        price_formula: draft.price_formula.trim(),
      });
      onSaved(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить настройки");
      setSaving(false);
    }
  }

  return (
    <form className="dialog" onSubmit={onSubmit}>
      <h2>Настройки</h2>
      <div className="form-grid">
        <label htmlFor="sync_time">Время Синхронизации</label>
        <input
          id="sync_time"
          value={draft.sync_time}
          autoFocus
          onChange={(event) => setDraft({ ...draft, sync_time: numberValue(event.target.value) })}
        />
        <label htmlFor="name_font_size">Размер Названия</label>
        <input
          id="name_font_size"
          value={draft.name_font_size}
          onChange={(event) => setDraft({ ...draft, name_font_size: numberValue(event.target.value) })}
        />
        <label htmlFor="price_font_size">Размер Цена</label>
        <input
          id="price_font_size"
          value={draft.price_font_size}
          onChange={(event) => setDraft({ ...draft, price_font_size: numberValue(event.target.value) })}
        />
        <label htmlFor="background_color">Цвет фона</label>
        <input
          id="background_color"
          value={draft.background_color}
          onChange={(event) => setDraft({ ...draft, background_color: event.target.value })}
        />
        <label htmlFor="name_font_color">Цвет Названия</label>
        <input
          id="name_font_color"
          value={draft.name_font_color}
          onChange={(event) => setDraft({ ...draft, name_font_color: event.target.value })}
        />
        <label htmlFor="price_font_color">Цвет Цена</label>
        <input
          id="price_font_color"
          value={draft.price_font_color}
          onChange={(event) => setDraft({ ...draft, price_font_color: event.target.value })}
        />
        <label htmlFor="update_screen_time">Время Обновление экрана</label>
        <input
          id="update_screen_time"
          value={draft.update_screen_time}
          onChange={(event) => setDraft({ ...draft, update_screen_time: numberValue(event.target.value) })}
        />
        <label htmlFor="show_image">Изображение</label>
        <input
          id="show_image"
          type="checkbox"
          checked={draft.show_image}
          onChange={(event) => setDraft({ ...draft, show_image: event.target.checked })}
        />
        <label htmlFor="price_formula_enabled">Формула цены</label>
        <input
          id="price_formula_enabled"
          type="checkbox"
          checked={draft.price_formula_enabled}
          onChange={(event) => setDraft({ ...draft, price_formula_enabled: event.target.checked })}
        />
        <label htmlFor="price_formula" className="form-span">
          Формула
        </label>
        <input
          id="price_formula"
          className="form-span"
          value={draft.price_formula}
          placeholder="Math.ceil(price / 1000) * 1000"
          onChange={(event) => setDraft({ ...draft, price_formula: event.target.value })}
        />
        <p className="form-hint form-span">{PRICE_FORMULA_HINT}</p>
        <button type="button" onClick={onCancel} disabled={saving}>
          Отменить
        </button>
        <button type="submit" disabled={saving}>
          Сохранить
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

export function ConnectionPanel({ onCancel, onSaved }: ConnectionPanelProps) {
  const [draft, setDraft] = useState<ConnectionSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getConnection()
      .then(setDraft)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Не получается подключится к базу данных...");
      });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await saveConnection({
        ...draft,
        host: draft.host.trim(),
        database: draft.database.trim(),
        user: draft.user.trim(),
        price_type: Number(draft.price_type),
      });
      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Не получается подключится к базу данных...",
      );
      setSaving(false);
    }
  }

  return (
    <form className="dialog" onSubmit={onSubmit}>
      <h2>Соединение</h2>
      {draft ? (
        <div className="form-grid">
          <label htmlFor="host">Ip адрес сервера</label>
          <input
            id="host"
            value={draft.host}
            autoFocus
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, host: event.target.value })}
          />
          <label htmlFor="database">Пут к базу данных</label>
          <input
            id="database"
            value={draft.database}
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, database: event.target.value })}
          />
          <label htmlFor="user">Имя Пользователя</label>
          <input
            id="user"
            value={draft.user}
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, user: event.target.value })}
          />
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            value={draft.password}
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
          />
          <label htmlFor="price_type">Вид цена</label>
          <input
            id="price_type"
            value={draft.price_type}
            onChange={(event) => setDraft({ ...draft, price_type: numberValue(event.target.value) })}
          />
          <button type="button" onClick={onCancel} disabled={saving}>
            Отменить
          </button>
          <button type="submit" disabled={saving}>
            Сохранить
          </button>
        </div>
      ) : (
        <p>Загрузка...</p>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

function numberValue(value: string): number {
  if (value.trim() === "") return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
