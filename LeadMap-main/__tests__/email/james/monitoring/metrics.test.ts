/**
 * Metrics Tests
 * 
 * Comprehensive tests for james-project metrics utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  InMemoryMetricFactory,
  createMetricFactory,
} from '@/lib/email/james/monitoring/metrics'

describe('Metrics', () => {
  let metricFactory: InMemoryMetricFactory

  beforeEach(() => {
    metricFactory = createMetricFactory() as InMemoryMetricFactory
  })

  describe('Timer', () => {
    it('should measure elapsed time', async () => {
      const timer = metricFactory.timer('test_timer')
      timer.start()

      await new Promise(resolve => setTimeout(resolve, 100))

      const elapsed = timer.stop()
      expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some timing variance
      expect(elapsed).toBeLessThan(300) // Allow more variance for CI
    })

    it('should publish metric on stopAndPublish', () => {
      const timer = metricFactory.timer('test_timer')
      timer.start()
      timer.stopAndPublish()

      const metrics = metricFactory.getMetricsByName('test_timer')
      expect(metrics.length).toBeGreaterThan(0)
      expect(metrics[0].type).toBe('timer')
    })
  })

  describe('Counter', () => {
    it('should increment counter', () => {
      const counter = metricFactory.counter('test_counter')
      counter.increment()
      counter.increment(5)

      expect(counter.getValue()).toBe(6)
    })

    it('should decrement counter', () => {
      const counter = metricFactory.counter('test_counter')
      counter.increment(10)
      counter.decrement(3)

      expect(counter.getValue()).toBe(7)
    })

    it('should reset counter', () => {
      const counter = metricFactory.counter('test_counter')
      counter.increment(5)
      counter.reset()

      expect(counter.getValue()).toBe(0)
    })
  })

  describe('Gauge', () => {
    it('should set gauge value', () => {
      const gauge = metricFactory.gauge('test_gauge')
      gauge.set(42)

      expect(gauge.getValue()).toBe(42)
    })

    it('should increment and decrement gauge', () => {
      const gauge = metricFactory.gauge('test_gauge')
      gauge.set(10)
      gauge.increment(5)
      gauge.decrement(3)

      expect(gauge.getValue()).toBe(12)
    })
  })

  describe('Histogram', () => {
    it('should observe values', () => {
      const histogram = metricFactory.histogram('test_histogram')
      histogram.observe(0.1)
      histogram.observe(0.5)
      histogram.observe(1.0)

      expect(histogram.getCount()).toBe(3)
      expect(histogram.getSum()).toBe(1.6)
    })

    it('should track buckets', () => {
      const histogram = metricFactory.histogram('test_histogram', [0.1, 0.5, 1.0])
      histogram.observe(0.05)
      histogram.observe(0.3)
      histogram.observe(0.8)

      const buckets = histogram.getBuckets()
      expect(buckets.get(0.1)).toBeGreaterThan(0)
      expect(buckets.get(0.5)).toBeGreaterThan(0)
      expect(buckets.get(1.0)).toBeGreaterThan(0)
    })
  })
})

