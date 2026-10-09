import { FormEvent, useEffect, useState } from "react";
import { applyMediaSelection, EMPTY_MEDIA_SELECTION, getConnection, MediaSelection, saveConnection, saveSettings } from "./api";
import { asLanguage, LANGUAGE_OPTIONS, Language, t } from "./i18n";
import { MediaSettingsFields } from "./mediaFields";
import { ConnectionSettings, DisplaySettings } from "./types";

interface SettingsPanelProps {
  initial: DisplaySettings;
  onCancel: () => void;
  onSaved: (settings: DisplaySettings) => void;
}

interface ConnectionPanelProps {
  language: Language;
  onCancel: () => void;
  onSaved: () => void;
}

export function SettingsPanel({ initial, onCancel, onSaved }: SettingsPanelProps) {
  const [draft, setDraft] = useState(initial);
  const [mediaSelection, setMediaSelection] = useState<MediaSelection>(EMPTY_MEDIA_SELECTION);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const text = (key: Parameters<typeof t>[1]) => t(draft.language, key);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await saveSettings(
        await applyMediaSelection(
          {
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
            price_prefix: draft.price_prefix,
            price_suffix: draft.price_suffix,
            background_image: draft.background_image,
            idle_media: draft.idle_media,
            language: asLanguage(draft.language),
          },
          mediaSelection,
        ),
      );
      onSaved(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text("saveFailed"));
      setSaving(false);
    }
  }

  return (
    <form className="dialog" onSubmit={onSubmit}>
      <h2>{text("settingsTitle")}</h2>
      <div className="form-grid">
        <label htmlFor="language">{text("language")}</label>
        <select
          id="language"
          value={asLanguage(draft.language)}
          onChange={(event) => setDraft({ ...draft, language: event.target.value as Language })}
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
          value={draft.sync_time}
          autoFocus
          onChange={(event) => setDraft({ ...draft, sync_time: numberValue(event.target.value) })}
        />
        <label htmlFor="name_font_size">{text("nameSize")}</label>
        <input
          id="name_font_size"
          value={draft.name_font_size}
          onChange={(event) => setDraft({ ...draft, name_font_size: numberValue(event.target.value) })}
        />
        <label htmlFor="price_font_size">{text("priceSize")}</label>
        <input
          id="price_font_size"
          value={draft.price_font_size}
          onChange={(event) => setDraft({ ...draft, price_font_size: numberValue(event.target.value) })}
        />
        <label htmlFor="background_color">{text("backgroundColor")}</label>
        <input
          id="background_color"
          value={draft.background_color}
          onChange={(event) => setDraft({ ...draft, background_color: event.target.value })}
        />
        <label htmlFor="name_font_color">{text("nameColor")}</label>
        <input
          id="name_font_color"
          value={draft.name_font_color}
          onChange={(event) => setDraft({ ...draft, name_font_color: event.target.value })}
        />
        <label htmlFor="price_font_color">{text("priceColor")}</label>
        <input
          id="price_font_color"
          value={draft.price_font_color}
          onChange={(event) => setDraft({ ...draft, price_font_color: event.target.value })}
        />
        <label htmlFor="price_prefix">{text("pricePrefix")}</label>
        <input
          id="price_prefix"
          value={draft.price_prefix}
          maxLength={40}
          onChange={(event) => setDraft({ ...draft, price_prefix: event.target.value })}
        />
        <label htmlFor="price_suffix">{text("priceSuffix")}</label>
        <input
          id="price_suffix"
          value={draft.price_suffix}
          maxLength={40}
          onChange={(event) => setDraft({ ...draft, price_suffix: event.target.value })}
        />
        <p className="form-hint form-span">{text("priceAffixHint")}</p>
        <label htmlFor="update_screen_time">{text("screenReset")}</label>
        <input
          id="update_screen_time"
          value={draft.update_screen_time}
          onChange={(event) => setDraft({ ...draft, update_screen_time: numberValue(event.target.value) })}
        />
        <label htmlFor="show_image">{text("image")}</label>
        <input
          id="show_image"
          type="checkbox"
          checked={draft.show_image}
          onChange={(event) => setDraft({ ...draft, show_image: event.target.checked })}
        />
        <MediaSettingsFields
          language={asLanguage(draft.language)}
          backgroundImage={draft.background_image}
          idleMedia={draft.idle_media}
          selection={mediaSelection}
          onSelection={setMediaSelection}
        />
        <label htmlFor="price_formula_enabled">{text("priceFormula")}</label>
        <input
          id="price_formula_enabled"
          type="checkbox"
          checked={draft.price_formula_enabled}
          onChange={(event) => setDraft({ ...draft, price_formula_enabled: event.target.checked })}
        />
        <label htmlFor="price_formula" className="form-span">
          {text("formula")}
        </label>
        <input
          id="price_formula"
          className="form-span"
          value={draft.price_formula}
          placeholder="Math.ceil(price / 1000) * 1000"
          onChange={(event) => setDraft({ ...draft, price_formula: event.target.value })}
        />
        <p className="form-hint form-span">{text("formulaHint")}</p>
        <button type="button" onClick={onCancel} disabled={saving}>
          {text("cancel")}
        </button>
        <button type="submit" disabled={saving}>
          {text("save")}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

export function ConnectionPanel({ language, onCancel, onSaved }: ConnectionPanelProps) {
  const [draft, setDraft] = useState<ConnectionSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const text = (key: Parameters<typeof t>[1]) => t(language, key);

  useEffect(() => {
    void getConnection()
      .then(setDraft)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : text("connectionError"));
      });
  }, [language]);

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
      setError(saveError instanceof Error ? saveError.message : text("connectionError"));
      setSaving(false);
    }
  }

  return (
    <form className="dialog" onSubmit={onSubmit}>
      <h2>{text("connectionTitle")}</h2>
      {draft ? (
        <div className="form-grid">
          <label htmlFor="host">{text("serverAddress")}</label>
          <input
            id="host"
            value={draft.host}
            autoFocus
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, host: event.target.value })}
          />
          <label htmlFor="database">{text("databasePath")}</label>
          <input
            id="database"
            value={draft.database}
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, database: event.target.value })}
          />
          <label htmlFor="user">{text("userName")}</label>
          <input
            id="user"
            value={draft.user}
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, user: event.target.value })}
          />
          <label htmlFor="password">{text("password")}</label>
          <input
            id="password"
            value={draft.password}
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, password: event.target.value })}
          />
          <label htmlFor="price_type">{text("priceType")}</label>
          <input
            id="price_type"
            value={draft.price_type}
            onChange={(event) => setDraft({ ...draft, price_type: numberValue(event.target.value) })}
          />
          <button type="button" onClick={onCancel} disabled={saving}>
            {text("cancel")}
          </button>
          <button type="submit" disabled={saving}>
            {text("save")}
          </button>
        </div>
      ) : (
        <p>{text("loading")}</p>
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
