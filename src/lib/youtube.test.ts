import { describe, expect, it } from 'vitest'
import { parseYouTubeUrl } from './youtube'

const VIDEO_ID = 'M7lc1UVf-VE'

describe('parseYouTubeUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?v=${VIDEO_ID}&list=example`,
    `https://youtu.be/${VIDEO_ID}?t=90`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
    `https://music.youtube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    `youtu.be/${VIDEO_ID}`,
    VIDEO_ID,
  ])('extracts the video ID from %s', (url) => {
    expect(parseYouTubeUrl(url)).toEqual({
      ok: true,
      videoId: VIDEO_ID,
      canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    })
  })

  it.each([
    '',
    'https://example.com/watch?v=M7lc1UVf-VE',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/watch?v=too-short',
    'not a url',
  ])('rejects invalid input %s', (url) => {
    expect(parseYouTubeUrl(url).ok).toBe(false)
  })
})
