import { FormEvent, useEffect, useRef, useState } from "react";
import { forceSync, getSettings, getStatus, lookup } from "./api";
import { formatPrice } from "./format";
import { asLanguage, t } from "./i18n";
import { ConnectionPanel, SettingsPanel } from "./panels";
import { DEFAULT_SETTINGS, DisplaySettings } from "./types";

type Panel = "settings" | "connection" | null;
type NoticeKey = "scanPrompt" | "notFound" | "updated" | "connectionError" | "noData";
type PriceKey = "noPrice" | "formulaError";

function isAlreadyFullscreen(): boolean {
  if (document.fullscreenElement) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  return window.innerWidth >= screen.width - 1 && window.innerHeight >= screen.height - 1;
}

export function App() {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [notice, setNotice] = useState<NoticeKey | "product">("scanPrompt");
  const [productName, setProductName] = useState("");
  const [priceKey, setPriceKey] = useState<PriceKey | null>(null);
  const [priceText, setPriceText] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [barcode, setBarcode] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [askFullscreen, setAskFullscreen] = useState(() => !isAlreadyFullscreen());
  const [mediaRevision, setMediaRevision] = useState(0);
  const [idleFailed, setIdleFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef(settings);
  const viewGen = useRef(0);
  const resetTimer = useRef<number | null>(null);

  settingsRef.current = settings;
  const language = settings.language;
  const headline = notice === "product" ? productName : t(language, notice);
  const price = priceKey
    ? t(language, priceKey)
    : priceText
      ? `${settings.price_prefix}${priceText}${settings.price_suffix}`
      : "";
  const backgroundUrl = settings.background_image
    ? `/api/media/background?v=${encodeURIComponent(settings.background_image)}-${mediaRevision}`
    : "";
  const idleUrl = settings.idle_media
    ? `/api/media/idle?v=${encodeURIComponent(settings.idle_media)}-${mediaRevision}`
    : "";
  const showIdleAd = notice === "scanPrompt" && Boolean(settings.idle_media) && !idleFailed;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    void getSettings()
      .then((next) => {
        setSettings({ ...next, language: asLanguage(next.language) });
        setMediaRevision(Date.now());
      })
      .catch(() => undefined);
    void showIdle();
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = settings.background_color;
  }, [settings.background_color]);

  useEffect(() => {
    setIdleFailed(false);
  }, [settings.idle_media, mediaRevision, notice]);

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
    if (notice !== "connectionError" && notice !== "noData") return;
    const id = window.setInterval(() => {
      void showIdle();
    }, 5000);
    return () => window.clearInterval(id);
  }, [notice]);

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
      if (empty && !status.connected) setNotice("connectionError");
      else if (empty) setNotice("noData");
      else setNotice("scanPrompt");
    } catch {
      if (viewGen.current !== generation) return;
      setNotice("connectionError");
    }
    if (viewGen.current === generation) {
      setProductName("");
      setPriceKey(null);
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

  function showNotice(key: NoticeKey, resetSeconds?: number) {
    viewGen.current += 1;
    setNotice(key);
    setProductName("");
    setPriceKey(null);
    setPriceText("");
    setImageSrc("");
    scheduleReset(resetSeconds);
  }

  function showProduct(name: string, nextPrice: string, nextPriceKey: PriceKey | null, image: string) {
    viewGen.current += 1;
    setNotice("product");
    setProductName(name);
    setPriceKey(nextPriceKey);
    setPriceText(nextPriceKey ? "" : nextPrice);
    setImageSrc(image);
    scheduleReset();
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
        showNotice("updated");
      } catch {
        showNotice("connectionError", 50);
      }
      return;
    }

    try {
      const result = await lookup(value);
      if (result.status === "not_found") {
        showNotice("notFound");
        return;
      }
      const nextPriceKey: PriceKey | null = result.formulaError ? "formulaError" : result.price == null ? "noPrice" : null;
      const nextPrice = nextPriceKey || result.price == null ? "" : formatPrice(result.price);
      const image =
        settingsRef.current.show_image && result.hasImage && result.imageId != null
          ? `/api/items/${result.itemId}/image?v=${result.imageId}`
          : "";
      showProduct(`${result.name} (${result.unitName})`, nextPrice, nextPriceKey, image);
    } catch {
      showNotice("connectionError", 50);
    }
  }

  const scanLabel = t(language, "scanBarcode");

  return (
    <div
      className="app"
      style={{
        backgroundColor: settings.background_color,
        ...(backgroundUrl
          ? {
              backgroundImage: `url("${backgroundUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : {}),
        ["--name-size" as string]: `${settings.name_font_size}px`,
        ["--price-size" as string]: `${settings.price_font_size}px`,
        ["--name-color" as string]: settings.name_font_color,
        ["--price-color" as string]: settings.price_font_color,
      }}
    >
      <main className={showIdleAd ? "stage stage-idle" : "stage"}>
        {showIdleAd ? (
          <>
            <p className="idle-prompt">{scanLabel}</p>
            {settings.idle_media === "mp4" || settings.idle_media === "webm" ? (
              <IdleVideo src={idleUrl} onError={() => setIdleFailed(true)} />
            ) : (
              <img className="idle-media" src={idleUrl} alt="" onError={() => setIdleFailed(true)} />
            )}
          </>
        ) : (
          <>
            {imageSrc ? (
              <img className="product-image" src={imageSrc} alt="" onError={() => setImageSrc("")} />
            ) : null}
            <h1 className="name">{headline}</h1>
            {price ? <p className="price">{price}</p> : null}
          </>
        )}
      </main>
      <form className="barcode-bar" onSubmit={onSubmit}>
        <input
          id="barcode"
          name="barcode"
          ref={inputRef}
          className="barcode-input"
          value={barcode}
          aria-label={scanLabel}
          placeholder={scanLabel}
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
              setSettings({ ...next, language: asLanguage(next.language) });
              setMediaRevision(Date.now());
              closePanel();
            }} />
          ) : (
            <ConnectionPanel
              language={language}
              onCancel={closePanel}
              onSaved={() => {
                closePanel();
                showNotice("updated");
              }}
            />
          )}
        </div>
      ) : null}
      {askFullscreen ? (
        <div className="overlay">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="fullscreen-title">
            <h2 id="fullscreen-title">{t(language, "fullscreenTitle")}</h2>
            <p>{t(language, "fullscreenPrompt")}</p>
            <div className="form-grid">
              <button type="button" onClick={stayWindowed}>
                {t(language, "stayWindowed")}
              </button>
              <button type="button" onClick={() => void enterFullscreen()}>
                {t(language, "enterFullscreen")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IdleVideo({ src, onError }: { src: string; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => undefined);
  }, [src]);
  return (
    <video
      ref={ref}
      className="idle-media"
      src={src}
      autoPlay
      muted
      loop
      playsInline
      onError={onError}
    />
  );
}
