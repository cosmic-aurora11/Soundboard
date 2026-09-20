import { act, cleanup, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { YouTubePlayer, type YouTubePlayerHandle } from './YouTubePlayer'

afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'YT'); vi.restoreAllMocks() })

it('loads saved start times and applies updated global fade duration without recreating the player', async () => {
  let options: YT.PlayerOptions
  let volume = 72
  const loadVideoById = vi.fn()
  const stopVideo = vi.fn()
  const constructor = vi.fn()
  class MockPlayer {
    constructor(_element: unknown, config: YT.PlayerOptions) { options = config; constructor() }
    getVolume = () => volume
    setVolume = (next: number) => { volume = next }
    getPlayerState = () => 1
    loadVideoById = loadVideoById
    stopVideo = stopVideo
    destroy = vi.fn()
  }
  window.YT = { Player: MockPlayer } as unknown as typeof YT
  const ref = createRef<YouTubePlayerHandle>()
  const onSnapshot = vi.fn()
  const view = render(<YouTubePlayer ref={ref} volume={72} fadeSeconds={0} onSnapshot={onSnapshot} />)
  await act(async () => {})
  const pad = { id: 'one', label: 'One', originalUrl: 'https://youtu.be/M7lc1UVf-VE', videoId: 'M7lc1UVf-VE', scenarioId: 'scene', starred: false }
  act(() => ref.current!.selectPad(pad))
  expect(loadVideoById).toHaveBeenLastCalledWith({ videoId: pad.videoId, startSeconds: 0 })
  act(() => options.events!.onStateChange!({ data: 1 } as YT.OnStateChangeEvent))
  expect(volume).toBe(72)
  await act(async () => ref.current!.selectPad({ ...pad, id: 'two', startSeconds: 90 }))
  expect(loadVideoById).toHaveBeenLastCalledWith({ videoId: pad.videoId, startSeconds: 90 })
  act(() => options.events!.onStateChange!({ data: 1 } as YT.OnStateChangeEvent))
  view.rerender(<YouTubePlayer ref={ref} volume={72} fadeSeconds={2} onSnapshot={onSnapshot} />)
  let frame: FrameRequestCallback = () => {}
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frame = callback; return 1 })
  vi.spyOn(performance, 'now').mockReturnValue(0)
  act(() => ref.current!.fadeStop())
  await act(async () => frame(1000))
  expect(volume).toBe(36)
  expect(stopVideo).not.toHaveBeenCalled()
  await act(async () => frame(2000))
  expect(stopVideo).toHaveBeenCalledOnce()
  expect(constructor).toHaveBeenCalledOnce()
})

