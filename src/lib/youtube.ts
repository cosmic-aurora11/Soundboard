const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export type YouTubeParseResult =
  | { ok: true; videoId: string; canonicalUrl: string }
  | { ok: false; error: string }

export function parseYouTubeUrl(input: string): YouTubeParseResult {
  const value = input.trim()
  if (!value) {
    return { ok: false, error: 'Paste a YouTube video URL.' }
  }

  if (VIDEO_ID_PATTERN.test(value)) {
    return success(value)
  }

  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return { ok: false, error: 'That is not a valid URL.' }
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let candidate: string | null = null

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v')
    } else {
      const parts = url.pathname.split('/').filter(Boolean)
      if (['embed', 'shorts', 'live'].includes(parts[0])) {
        candidate = parts[1] ?? null
      }
    }
  } else {
    return { ok: false, error: 'Use a youtube.com or youtu.be video link.' }
  }

  if (!candidate || !VIDEO_ID_PATTERN.test(candidate)) {
    return { ok: false, error: 'This link does not contain a valid YouTube video ID.' }
  }

  return success(candidate)
}

function success(videoId: string): YouTubeParseResult {
  return {
    ok: true,
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  }
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}
