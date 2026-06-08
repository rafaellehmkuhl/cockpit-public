import { onUnmounted } from 'vue'

/**
 * Coalesces render requests to at most one `render` call per animation frame.
 *
 * Multiple triggers landing in the same frame (GSAP tween ticks, telemetry samples, resize events)
 * are collapsed into a single redraw. The pending frame is cancelled on unmount so no redraw runs
 * against a torn-down canvas.
 * @param {() => void} render - Callback invoked once per frame when a render has been scheduled.
 * @returns {() => void} Function that schedules `render` for the next animation frame.
 */
export const useCoalescedRender = (render: () => void): (() => void) => {
  let frameId: number | null = null

  const scheduleRender = (): void => {
    if (frameId !== null) return
    frameId = requestAnimationFrame(() => {
      frameId = null
      render()
    })
  }

  onUnmounted(() => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  })

  return scheduleRender
}
