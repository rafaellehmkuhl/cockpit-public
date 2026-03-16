/**
 * Lightweight performance instrumentation for measuring hot-path execution times.
 * Instrumentation is always active but has minimal overhead (~0.001ms per mark pair).
 */

/**
 * Aggregated statistics for a single instrumentation label
 */
export interface PerfMetric {
  /** Number of times this label was measured */
  count: number
  /** Total accumulated time in milliseconds */
  totalMs: number
  /** Minimum observed duration in milliseconds */
  minMs: number
  /** Maximum observed duration in milliseconds */
  maxMs: number
  /** Mean duration in milliseconds */
  meanMs: number
}

/**
 * A single recorded long task entry
 */
export interface LongTaskEntry {
  /** Duration of the long task in milliseconds */
  duration: number
  /** Start time relative to performance.timeOrigin */
  startTime: number
}

/**
 * Full performance report containing all collected metrics
 */
export interface PerfReport {
  /** Aggregated timing metrics keyed by label */
  metrics: Record<string, PerfMetric>
  /** Recorded long tasks (>50ms) that blocked the main thread */
  longTasks: LongTaskEntry[]
  /** Timestamp when the report was generated */
  generatedAt: number
}

/**
 * Internal accumulator for a single metric label
 */
interface MetricAccumulator {
  /** Number of measurements taken */
  count: number
  /** Total time across all measurements */
  totalMs: number
  /** Shortest measurement */
  minMs: number
  /** Longest measurement */
  maxMs: number
}

const activeMarks: Record<string, number> = {}
const metricAccumulators: Record<string, MetricAccumulator> = {}
const longTasks: LongTaskEntry[] = []
let instrumentationEnabled = false

/**
 * Enable performance instrumentation. When disabled, perfBegin/perfEnd are no-ops.
 * This allows the benchmark page to activate instrumentation on demand.
 */
export function enableInstrumentation(): void {
  instrumentationEnabled = true
}

/**
 * Disable performance instrumentation
 */
export function disableInstrumentation(): void {
  instrumentationEnabled = false
}

/**
 * Check whether instrumentation is currently enabled
 * @returns {boolean} True if instrumentation is active
 */
export function isInstrumentationEnabled(): boolean {
  return instrumentationEnabled
}

/**
 * Begin a performance measurement for the given label.
 * No-op when instrumentation is disabled.
 * @param {string} label - Unique identifier for this measurement
 */
export function perfBegin(label: string): void {
  if (!instrumentationEnabled) return
  activeMarks[label] = performance.now()
}

/**
 * End a performance measurement for the given label and accumulate the result.
 * No-op when instrumentation is disabled.
 * @param {string} label - Must match a previous perfBegin call
 */
export function perfEnd(label: string): void {
  if (!instrumentationEnabled) return
  const start = activeMarks[label]
  if (start === undefined) return
  const elapsed = performance.now() - start
  delete activeMarks[label]

  let acc = metricAccumulators[label]
  if (!acc) {
    acc = { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0 }
    metricAccumulators[label] = acc
  }
  acc.count++
  acc.totalMs += elapsed
  if (elapsed < acc.minMs) acc.minMs = elapsed
  if (elapsed > acc.maxMs) acc.maxMs = elapsed
}

/**
 * Get the aggregated performance report for all instrumented labels and long tasks
 * @returns {PerfReport} Snapshot of all accumulated metrics and long tasks
 */
export function getPerfReport(): PerfReport {
  const metrics: Record<string, PerfMetric> = {}
  for (const [label, acc] of Object.entries(metricAccumulators)) {
    metrics[label] = {
      count: acc.count,
      totalMs: acc.totalMs,
      minMs: acc.count > 0 ? acc.minMs : 0,
      maxMs: acc.maxMs,
      meanMs: acc.count > 0 ? acc.totalMs / acc.count : 0,
    }
  }
  return {
    metrics,
    longTasks: [...longTasks],
    generatedAt: Date.now(),
  }
}

/**
 * Reset all accumulated metrics and long task records
 */
export function resetPerfReport(): void {
  for (const key of Object.keys(metricAccumulators)) {
    delete metricAccumulators[key]
  }
  longTasks.length = 0
}

/**
 * Get the recorded long tasks
 * @returns {LongTaskEntry[]} Copy of all recorded long task entries
 */
export function getLongTasks(): LongTaskEntry[] {
  return [...longTasks]
}

/**
 * Reset only the long task records
 */
export function resetLongTasks(): void {
  longTasks.length = 0
}

if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push({ duration: entry.duration, startTime: entry.startTime })
      }
    })
    observer.observe({ type: 'longtask', buffered: true })
  } catch {
    // PerformanceObserver 'longtask' type not supported in this browser
  }
}
