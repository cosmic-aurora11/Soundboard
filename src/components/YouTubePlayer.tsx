import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { MusicPad, PlayerSnapshot, PlayerStatus } from '../types'

const FADE_DURATION_MS = 800

export interface YouTubePlayerHandle {
  selectPad: (pad: MusicPad) => void
  togglePlayback: () => void
  fadeStop: () => void
  setMasterVolume: (volume: number) => void
}

interface YouTubePlayerProps {
  volume: number
  onSnapshot: (snapshot: PlayerSnapshot) => void
}

let apiPromise: Promise<typeof YT> | null = null

function loadYouTubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      if (window.YT) resolve(window.YT)
      else reject(new Error('YouTube API did not initialize.'))
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    if (existing) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('Could not load the YouTube player. Check your connection.'))
    document.head.appendChild(script)
  })

  return apiPromise
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ volume, onSnapshot }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<YT.Player | null>(null)
    const volumeRef = useRef(volume)
    const snapshotRef = useRef<PlayerSnapshot>({
      activePadId: null,
      pendingPadId: null,
      status: 'loading',
      currentError: null,
    })
    const onSnapshotRef = useRef(onSnapshot)
    const operationRef = useRef(0)
    const frameRef = useRef<number | null>(null)

    useEffect(() => {
      onSnapshotRef.current = onSnapshot
    }, [onSnapshot])

    const emit = useCallback((partial: Partial<PlayerSnapshot>) => {
      snapshotRef.current = { ...snapshotRef.current, ...partial }
      onSnapshotRef.current(snapshotRef.current)
    }, [])

    const cancelMotion = useCallback(() => {
      operationRef.current += 1
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      return operationRef.current
    }, [])

    const fadeTo = useCallback((target: number, duration: number, operation: number): Promise<boolean> => {
      const player = playerRef.current
      if (!player) return Promise.resolve(false)
      const startVolume = player.getVolume()
      if (duration <= 0 || startVolume === target) {
        player.setVolume(target)
        return Promise.resolve(operation === operationRef.current)
      }

      return new Promise((resolve) => {
        const startedAt = performance.now()
        const step = (now: number) => {
          if (operation !== operationRef.current) {
            resolve(false)
            return
          }
          const progress = Math.min(1, (now - startedAt) / duration)
          const eased = progress * progress * (3 - 2 * progress)
          player.setVolume(Math.round(startVolume + (target - startVolume) * eased))
          if (progress < 1) {
            frameRef.current = requestAnimationFrame(step)
          } else {
            frameRef.current = null
            resolve(true)
          }
        }
        frameRef.current = requestAnimationFrame(step)
      })
    }, [])

    useEffect(() => {
      let cancelled = false
      loadYouTubeApi()
        .then((YTApi) => {
          if (cancelled || !containerRef.current) return
          playerRef.current = new YTApi.Player(containerRef.current, {
            width: '480',
            height: '270',
            playerVars: {
              playsinline: 1,
              enablejsapi: 1,
              origin: window.location.origin,
              rel: 0,
            },
            events: {
              onReady: (event) => {
                event.target.setVolume(volumeRef.current)
                emit({ status: 'ready', currentError: null })
              },
              onStateChange: (event) => {
                const status = stateToStatus(event.data)
                if (status === 'playing') {
                  const pendingPadId = snapshotRef.current.pendingPadId
                  emit({
                    activePadId: pendingPadId ?? snapshotRef.current.activePadId,
                    pendingPadId: null,
                    status,
                    currentError: null,
                  })
                  const operation = operationRef.current
                  void fadeTo(volumeRef.current, FADE_DURATION_MS, operation)
                } else if (status === 'stopped' && event.data === 0) {
                  emit({ activePadId: null, pendingPadId: null, status })
                } else {
                  emit({ status })
                }
              },
              onError: (event) => {
                emit({
                  status: 'error',
                  pendingPadId: null,
                  currentError: playerErrorMessage(event.data),
                })
              },
              onAutoplayBlocked: () => {
                emit({
                  status: 'paused',
                  currentError: 'Your browser blocked playback. Press play in the YouTube player to continue.',
                })
              },
            },
          })
        })
        .catch((error: unknown) => {
          emit({
            status: 'error',
            currentError: error instanceof Error ? error.message : 'Could not load the YouTube player.',
          })
        })

      return () => {
        cancelled = true
        cancelMotion()
        playerRef.current?.destroy()
        playerRef.current = null
      }
    }, [cancelMotion, emit, fadeTo])

    useEffect(() => {
      volumeRef.current = volume
    }, [volume])

    useImperativeHandle(ref, () => ({
      selectPad(pad) {
        const player = playerRef.current
        if (!player) {
          emit({ status: 'loading', currentError: 'The YouTube player is still loading. Try again in a moment.' })
          return
        }

        if (snapshotRef.current.activePadId === pad.id && !snapshotRef.current.pendingPadId) {
          if (player.getPlayerState() === 1) player.pauseVideo()
          else player.playVideo()
          return
        }

        const operation = cancelMotion()
        emit({ pendingPadId: pad.id, status: 'buffering', currentError: null })

        const loadSelection = () => {
          if (operation !== operationRef.current) return
          player.setVolume(0)
          player.loadVideoById(pad.videoId)
        }

        const hasCurrentTrack = snapshotRef.current.activePadId !== null
        if (hasCurrentTrack && player.getPlayerState() !== 0) {
          void fadeTo(0, FADE_DURATION_MS, operation).then((completed) => {
            if (completed) loadSelection()
          })
        } else {
          loadSelection()
        }
      },

      togglePlayback() {
        const player = playerRef.current
        if (!player || !snapshotRef.current.activePadId) return
        if (player.getPlayerState() === 1) player.pauseVideo()
        else player.playVideo()
      },

      fadeStop() {
        const player = playerRef.current
        if (!player) return
        const operation = cancelMotion()
        emit({ pendingPadId: null, currentError: null })
        void fadeTo(0, FADE_DURATION_MS, operation).then((completed) => {
          if (!completed) return
          player.stopVideo()
          player.setVolume(volumeRef.current)
          emit({ activePadId: null, pendingPadId: null, status: 'stopped' })
        })
      },

      setMasterVolume(nextVolume) {
        volumeRef.current = nextVolume
        const player = playerRef.current
        if (player && snapshotRef.current.status === 'playing' && snapshotRef.current.pendingPadId === null) {
          player.setVolume(nextVolume)
        }
      },
    }), [cancelMotion, emit, fadeTo])

    return (
      <div className="youtube-frame-shell" aria-label="YouTube player">
        <div ref={containerRef} className="youtube-frame" />
      </div>
    )
  },
)

function stateToStatus(state: number): PlayerStatus {
  switch (state) {
    case 1:
      return 'playing'
    case 2:
      return 'paused'
    case 3:
      return 'buffering'
    case 0:
      return 'stopped'
    default:
      return 'ready'
  }
}

function playerErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return 'YouTube rejected this video ID. Edit the pad and check its URL.'
    case 5:
      return 'This video cannot play in the embedded HTML5 player.'
    case 100:
      return 'This video was removed or made private.'
    case 101:
    case 150:
      return 'The video owner does not allow playback on other websites.'
    case 153:
      return 'YouTube could not verify this embedded player. Open the video on YouTube instead.'
    default:
      return 'YouTube could not play this selection.'
  }
}
