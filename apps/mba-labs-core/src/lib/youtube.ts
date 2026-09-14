const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function getYouTubeVideoId(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (YOUTUBE_ID.test(raw) && !raw.includes(".")) return raw;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return YOUTUBE_ID.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const watchId = url.searchParams.get("v") ?? "";
      if (YOUTUBE_ID.test(watchId)) return watchId;

      const parts = url.pathname.split("/").filter(Boolean);
      const markerIndex = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
      const id = markerIndex >= 0 ? parts[markerIndex + 1] ?? "" : "";
      return YOUTUBE_ID.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function getYouTubeEmbedUrl(value: string | null | undefined) {
  const id = getYouTubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` : null;
}

export function getYouTubeThumbnailUrl(value: string | null | undefined) {
  const id = getYouTubeVideoId(value);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
