import { useEffect, useRef, useState } from "react";
import { MediaSelection } from "./api";
import { Language, t } from "./i18n";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
const IDLE_ACCEPT = `${IMAGE_ACCEPT},video/mp4,video/webm,.mp4,.webm`;

interface MediaSettingsFieldsProps {
  language: Language;
  backgroundImage: string;
  idleMedia: string;
  selection: MediaSelection;
  onSelection: (selection: MediaSelection) => void;
}

export function MediaSettingsFields({
  language,
  backgroundImage,
  idleMedia,
  selection,
  onSelection,
}: MediaSettingsFieldsProps) {
  const text = (key: Parameters<typeof t>[1]) => t(language, key);
  const backgroundInput = useRef<HTMLInputElement>(null);
  const idleInput = useRef<HTMLInputElement>(null);
  const backgroundPreviewUrl = useObjectUrl(selection.backgroundFile);
  const idlePreviewUrl = useObjectUrl(selection.idleFile);

  useEffect(() => {
    if (!selection.backgroundFile && backgroundInput.current) backgroundInput.current.value = "";
  }, [selection.backgroundFile]);

  useEffect(() => {
    if (!selection.idleFile && idleInput.current) idleInput.current.value = "";
  }, [selection.idleFile]);

  const backgroundPreview = selection.backgroundFile
    ? backgroundPreviewUrl
    : !selection.removeBackground && backgroundImage
      ? `/api/media/background?v=${encodeURIComponent(backgroundImage)}`
      : "";
  const idlePreview = selection.idleFile
    ? idlePreviewUrl
    : !selection.removeIdle && idleMedia
      ? `/api/media/idle?v=${encodeURIComponent(idleMedia)}`
      : "";
  const idlePreviewIsVideo = selection.idleFile ? isVideoFile(selection.idleFile) : isVideoToken(idleMedia);

  function removeBackground() {
    if (selection.backgroundFile) {
      onSelection({ ...selection, backgroundFile: null });
      return;
    }
    onSelection({ ...selection, removeBackground: !selection.removeBackground });
  }

  function removeIdle() {
    if (selection.idleFile) {
      onSelection({ ...selection, idleFile: null });
      return;
    }
    onSelection({ ...selection, removeIdle: !selection.removeIdle });
  }

  return (
    <>
      <label htmlFor="background_image">{text("backgroundImage")}</label>
      <div className="media-field">
        <input
          id="background_image"
          ref={backgroundInput}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={(event) =>
            onSelection({
              ...selection,
              backgroundFile: event.target.files?.[0] ?? null,
              removeBackground: false,
            })
          }
        />
        {backgroundPreview ? <img className="media-preview" src={backgroundPreview} alt="" /> : null}
        {selection.removeBackground ? <p className="form-hint">{text("mediaPendingDelete")}</p> : null}
        {backgroundImage || selection.backgroundFile || selection.removeBackground ? (
          <button type="button" onClick={removeBackground}>
            {selection.removeBackground ? text("keepFile") : text("removeFile")}
          </button>
        ) : null}
      </div>
      <label htmlFor="idle_media">{text("idleAd")}</label>
      <div className="media-field">
        <input
          id="idle_media"
          ref={idleInput}
          type="file"
          accept={IDLE_ACCEPT}
          onChange={(event) =>
            onSelection({
              ...selection,
              idleFile: event.target.files?.[0] ?? null,
              removeIdle: false,
            })
          }
        />
        {idlePreview ? (
          idlePreviewIsVideo ? (
            <video className="media-preview" src={idlePreview} muted controls />
          ) : (
            <img className="media-preview" src={idlePreview} alt="" />
          )
        ) : null}
        {selection.removeIdle ? <p className="form-hint">{text("mediaPendingDelete")}</p> : null}
        {idleMedia || selection.idleFile || selection.removeIdle ? (
          <button type="button" onClick={removeIdle}>
            {selection.removeIdle ? text("keepFile") : text("removeFile")}
          </button>
        ) : null}
      </div>
      <p className="form-hint form-span">{text("idleAdHint")}</p>
    </>
  );
}

function useObjectUrl(file: File | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function isVideoToken(token: string): boolean {
  return token === "mp4" || token === "webm";
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm)$/i.test(file.name);
}
