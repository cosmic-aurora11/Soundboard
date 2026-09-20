export {}

declare global {
  namespace YT {
    interface PlayerEvent {
      target: Player
    }

    interface OnStateChangeEvent extends PlayerEvent {
      data: number
    }

    interface OnErrorEvent extends PlayerEvent {
      data: number
    }

    interface PlayerOptions {
      width?: string | number
      height?: string | number
      videoId?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: PlayerEvent) => void
        onStateChange?: (event: OnStateChangeEvent) => void
        onError?: (event: OnErrorEvent) => void
        onAutoplayBlocked?: (event: PlayerEvent) => void
      }
    }

    class Player {
      constructor(elementId: string | HTMLElement, options: PlayerOptions)
      loadVideoById(video: string | { videoId: string; startSeconds: number }): void
      playVideo(): void
      pauseVideo(): void
      stopVideo(): void
      setVolume(volume: number): void
      getVolume(): number
      getPlayerState(): number
      destroy(): void
    }
  }

  interface Window {
    YT?: typeof YT
    onYouTubeIframeAPIReady?: () => void
  }
}
