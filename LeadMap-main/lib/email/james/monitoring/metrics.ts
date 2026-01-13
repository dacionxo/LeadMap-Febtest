/**
 * Monitoring and Metrics Utilities
 * 
 * Metrics patterns following james-project implementation
 * Based on TimeMetric, MetricFactory, and metric collection patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/mailetcontainer-impl/src/main/java/org/apache/james/mailetcontainer/impl/ProcessorImpl.java
 * @see james-project/server/mailet/mailetcontainer-impl/src/main/java/org/apache/james/mailetcontainer/impl/JamesMailSpooler.java
 */

/**
 * Metric type
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer'

/**
 * Metric value
 */
export interface MetricValue {
  type: MetricType
  value: number
  labels?: Record<string, string>
  timestamp?: Date
}

/**
 * Timer metric
 */
export interface TimerMetric {
  start(): void
  stop(): number // Returns elapsed time in milliseconds
  stopAndPublish(): void // Stops and publishes the metric
  getElapsed(): number // Gets elapsed time without stopping
}

/**
 * Counter metric
 */
export interface CounterMetric {
  increment(value?: number): void
  decrement(value?: number): void
  getValue(): number
  reset(): void
}

/**
 * Gauge metric
 */
export interface GaugeMetric {
  set(value: number): void
  getValue(): number
  increment(value?: number): void
  decrement(value?: number): void
}

/**
 * Histogram metric
 */
export interface HistogramMetric {
  observe(value: number): void
  getCount(): number
  getSum(): number
  getBuckets(): Map<number, number> // Bucket boundaries -> counts
  reset(): void
}

/**
 * Metric factory
 * Following james-project MetricFactory patterns
 */
export interface MetricFactory {
  /**
   * Create a timer metric
   * 
   * @param name - Metric name
   * @param labels - Optional labels
   * @returns Timer metric
   */
  timer(name: string, labels?: Record<string, string>): TimerMetric

  /**
   * Create a counter metric
   * 
   * @param name - Metric name
   * @param labels - Optional labels
   * @returns Counter metric
   */
  counter(name: string, labels?: Record<string, string>): CounterMetric

  /**
   * Create a gauge metric
   * 
   * @param name - Metric name
   * @param labels - Optional labels
   * @returns Gauge metric
   */
  gauge(name: string, labels?: Record<string, string>): GaugeMetric

  /**
   * Create a histogram metric
   * 
   * @param name - Metric name
   * @param buckets - Bucket boundaries
   * @param labels - Optional labels
   * @returns Histogram metric
   */
  histogram(
    name: string,
    buckets?: number[],
    labels?: Record<string, string>
  ): HistogramMetric
}

/**
 * In-memory timer metric implementation
 */
class InMemoryTimerMetric implements TimerMetric {
  private startTime: number = 0
  private elapsed: number = 0
  private running: boolean = false

  constructor(
    private name: string,
    private labels: Record<string, string> = {},
    private onPublish: (name: string, value: number, labels: Record<string, string>) => void
  ) {}

  start(): void {
    this.startTime = Date.now()
    this.running = true
  }

  stop(): number {
    if (this.running) {
      this.elapsed = Date.now() - this.startTime
      this.running = false
    }
    return this.elapsed
  }

  stopAndPublish(): void {
    const elapsed = this.stop()
    this.onPublish(this.name, elapsed, this.labels)
  }

  getElapsed(): number {
    if (this.running) {
      return Date.now() - this.startTime
    }
    return this.elapsed
  }
}

/**
 * In-memory counter metric implementation
 */
class InMemoryCounterMetric implements CounterMetric {
  private value: number = 0

  constructor(
    private name: string,
    private labels: Record<string, string> = {},
    private onPublish: (name: string, value: number, labels: Record<string, string>) => void
  ) {}

  increment(value: number = 1): void {
    this.value += value
    this.onPublish(this.name, this.value, this.labels)
  }

  decrement(value: number = 1): void {
    this.value -= value
    this.onPublish(this.name, this.value, this.labels)
  }

  getValue(): number {
    return this.value
  }

  reset(): void {
    this.value = 0
  }
}

/**
 * In-memory gauge metric implementation
 */
class InMemoryGaugeMetric implements GaugeMetric {
  private value: number = 0

  constructor(
    private name: string,
    private labels: Record<string, string> = {},
    private onPublish: (name: string, value: number, labels: Record<string, string>) => void
  ) {}

  set(value: number): void {
    this.value = value
    this.onPublish(this.name, this.value, this.labels)
  }

  getValue(): number {
    return this.value
  }

  increment(value: number = 1): void {
    this.value += value
    this.onPublish(this.name, this.value, this.labels)
  }

  decrement(value: number = 1): void {
    this.value -= value
    this.onPublish(this.name, this.value, this.labels)
  }
}

/**
 * In-memory histogram metric implementation
 */
class InMemoryHistogramMetric implements HistogramMetric {
  private values: number[] = []
  private buckets: Map<number, number> = new Map()

  constructor(
    private name: string,
    private bucketBoundaries: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    private labels: Record<string, string> = {},
    private onPublish: (name: string, value: number, labels: Record<string, string>) => void
  ) {
    // Initialize buckets
    for (const boundary of bucketBoundaries) {
      this.buckets.set(boundary, 0)
    }
  }

  observe(value: number): void {
    this.values.push(value)

    // Update buckets
    for (const boundary of this.bucketBoundaries) {
      if (value <= boundary) {
        this.buckets.set(boundary, (this.buckets.get(boundary) || 0) + 1)
      }
    }

    this.onPublish(this.name, value, this.labels)
  }

  getCount(): number {
    return this.values.length
  }

  getSum(): number {
    return this.values.reduce((sum, val) => sum + val, 0)
  }

  getBuckets(): Map<number, number> {
    return new Map(this.buckets)
  }

  reset(): void {
    this.values = []
    for (const boundary of this.bucketBoundaries) {
      this.buckets.set(boundary, 0)
    }
  }
}

/**
 * In-memory metric factory
 * Following james-project patterns
 */
export class InMemoryMetricFactory implements MetricFactory {
  private metrics = new Map<string, MetricValue[]>()

  constructor(
    private onMetric?: (name: string, value: number, labels: Record<string, string>) => void
  ) {}

  timer(name: string, labels: Record<string, string> = {}): TimerMetric {
    return new InMemoryTimerMetric(name, labels, (n, v, l) => this.recordMetric(n, v, l, 'timer'))
  }

  counter(name: string, labels: Record<string, string> = {}): CounterMetric {
    return new InMemoryCounterMetric(name, labels, (n, v, l) => this.recordMetric(n, v, l, 'counter'))
  }

  gauge(name: string, labels: Record<string, string> = {}): GaugeMetric {
    return new InMemoryGaugeMetric(name, labels, (n, v, l) => this.recordMetric(n, v, l, 'gauge'))
  }

  histogram(
    name: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    labels: Record<string, string> = {}
  ): HistogramMetric {
    return new InMemoryHistogramMetric(name, buckets, labels, (n, v, l) => this.recordMetric(n, v, l, 'histogram'))
  }

  /**
   * Record a metric
   */
  private recordMetric(
    name: string,
    value: number,
    labels: Record<string, string>,
    type: MetricType
  ): void {
    const metric: MetricValue = {
      type,
      value,
      labels,
      timestamp: new Date(),
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(metric)

    // Keep only last 1000 metrics per name
    const metrics = this.metrics.get(name)!
    if (metrics.length > 1000) {
      metrics.shift()
    }

    // Call optional callback
    if (this.onMetric) {
      this.onMetric(name, value, labels)
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): Map<string, MetricValue[]> {
    return new Map(this.metrics)
  }

  /**
   * Get metrics for a specific name
   */
  getMetricsByName(name: string): MetricValue[] {
    return this.metrics.get(name) || []
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear()
  }
}

/**
 * Create metric factory
 * 
 * @param onMetric - Optional callback for metric events
 * @returns Metric factory instance
 */
export function createMetricFactory(
  onMetric?: (name: string, value: number, labels: Record<string, string>) => void
): MetricFactory {
  return new InMemoryMetricFactory(onMetric)
}

/**
 * Global metric factory instance
 */
export const globalMetricFactory = createMetricFactory()

