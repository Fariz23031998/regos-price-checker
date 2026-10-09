import { FormEvent, useEffect, useRef, useState } from "react";
import { forceSync, getSettings, getStatus, lookup } from "./api";
import { formatPrice } from "./format";
import { ConnectionPanel, SettingsPanel } from "./panels";
import {
  CONNECTION_ERROR,
  DEFAULT_SETTINGS,
  DisplaySettings,
  NO_DATA,
  NO_PRICE,
  NOT_FOUND,
  SCAN_PROMPT,
  UPDATED,
} from "./types";

type Panel = "settings" | "connection" | null;

function isAlreadyFullscreen(): boolean {
  if (document.fullscreenElement) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  return window.innerWidth >= screen.width - 1 && window.innerHeight >= screen.height - 1;
}

export function App() {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [headline, setHeadline] = useState(SCAN_PROMPT);
  const [priceText, setPriceText] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [barcode, setBarcode] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [askFullscreen, setAskFullscreen] = useState(() => !isAlreadyFullscreen());
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef(settings);
  const viewGen = useRef(0);
  const resetTimer = useRef<number | null>(null);

  settingsRef.current = settings;

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch(() => undefined);
    void showIdle();
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = settings.background_color;
  }, [settings.background_color]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (panel || askFullscreen) return;
      inputRef.current?.focus();
    }, 1000);
    return () => window.clearInterval(id);
  }, [panel, askFullscreen]);

  useEffect(() => {
    if (!askFullscreen) return;
    inputRef.current?.blur();
  }, [askFullscreen]);

  useEffect(() => {
    if (headline !== CONNECTION_ERROR && headline !== NO_DATA) return;
    const id = window.setInterval(() => {
      void showIdle();
    }, 5000);
    return () => window.clearInterval(id);
  }, [headline]);

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  async function showIdle() {
    const generation = viewGen.current;
    try {
      const status = await getStatus();
      if (viewGen.current !== generation) return;
      const empty = status.counts.items === 0 && status.counts.barcodes === 0;
      if (empty && !status.connected) setHeadline(CONNECTION_ERROR);
      else if (empty) setHeadline(NO_DATA);
      else setHeadline(SCAN_PROMPT);
    } catch {
      if (viewGen.current !== generation) return;
      setHeadline(CONNECTION_ERROR);
    }
    if (viewGen.current === generation) {
      setPriceText("");
      setImageSrc("");
    }
  }

  function scheduleReset(seconds?: number) {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    const delay = (seconds ?? settingsRef.current.update_screen_time) * 1000;
    const generation = viewGen.current;
    resetTimer.current = window.setTimeout(() => {
      if (viewGen.current === generation) void showIdle();
    }, delay);
  }

  function showMessage(text: string, price = "", resetSeconds?: number, image = "") {
    viewGen.current += 1;
    setHeadline(text);
    setPriceText(price);
    setImageSrc(image);
    scheduleReset(resetSeconds);
  }

  function closePanel() {
    setPanel(null);
    viewGen.current += 1;
    void showIdle();
  }

  function stayWindowed() {
    setAskFullscreen(false);
    inputRef.current?.focus();
  }

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // The browser rejected fullscreen; keep the window as it is.
    }
    setAskFullscreen(false);
    inputRef.current?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("barcode");
    const typed = field instanceof HTMLInputElement ? field.value : barcode;
    const value = typed.trim();
    setBarcode("");
    if (!value || panel || askFullscreen) return;
    if (resetTimer.current) window.clearTimeout(resetTimer.current);

    const command = value.toLowerCase();
    if (command === "admin") {
      window.location.assign("/admin");
      return;
    }
    if (command === "settings") {
      viewGen.current += 1;
      setPanel("settings");
      return;
    }
    if (command === "connection") {
      viewGen.current += 1;
      setPanel("connection");
      return;
    }
    if (command === "update") {
      try {
        await forceSync();
        showMessage(UPDATED);
      } catch {
        showMessage(CONNECTION_ERROR, "", 50);
      }
      return;
    }

    try {
      const result = await lookup(value);
      if (result.status === "not_found") {
        showMessage(NOT_FOUND);
        return;
      }
      const price = result.formulaError
        ? result.formulaError
        : result.price == null
          ? NO_PRICE
          : formatPrice(result.price);
      const image =
        settingsRef.current.show_image && result.hasImage && result.imageId != null
          ? `/api/items/${result.itemId}/image?v=${result.imageId}`
          : "";
      showMessage(`${result.name} (${result.unitName})`, price, undefined, image);
    } catch {
      showMessage(CONNECTION_ERROR, "", 50);
    }
  }

  return (
    <div
      className="app"
      style={{
        backgroundColor: settings.background_color,
        ["--name-size" as string]: `${settings.name_font_size}px`,
        ["--price-size" as string]: `${settings.price_font_size}px`,
        ["--name-color" as string]: settings.name_font_color,
        ["--price-color" as string]: settings.price_font_color,
      }}
    >
      <main className="stage">
        {imageSrc ? (
          <img className="product-image" src={imageSrc} alt="" onError={() => setImageSrc("")} />
        ) : null}
        <h1 className="name">{headline}</h1>
        {priceText ? <p className="price">{priceText}</p> : null}
      </main>
      <form className="barcode-bar" onSubmit={onSubmit}>
        <input
          id="barcode"
          name="barcode"
          ref={inputRef}
          className="barcode-input"
          value={barcode}
          aria-label="Сканируйте штрихкод"
          placeholder="Сканируйте штрихкод"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={!askFullscreen}
          onChange={(event) => setBarcode(event.target.value)}
        />
      </form>
      {panel ? (
        <div className="overlay">
          {panel === "settings" ? (
            <SettingsPanel initial={settings} onCancel={closePanel} onSaved={(next) => {
              setSettings(next);
              closePanel();
            }} />
          ) : (
            <ConnectionPanel
              onCancel={closePanel}
              onSaved={() => {
                closePanel();
                showMessage(UPDATED);
              }}
            />
          )}
        </div>
      ) : null}
      {askFullscreen ? (
        <div className="overlay">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="fullscreen-title">
            <h2 id="fullscreen-title">Полноэкранный режим</h2>
            <p>Открыть приложение на весь экран?</p>
            <div className="form-grid">
              <button type="button" onClick={stayWindowed}>
                Продолжить в окне
              </button>
              <button type="button" onClick={() => void enterFullscreen()}>
                На весь экран
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
