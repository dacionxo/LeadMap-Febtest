/**
 * Symphony Messenger Test Mocks
 * Mock implementations for testing
 */

import type {
  Message,
  MessageEnvelope,
  Transport,
  MessageHandler,
  HandlerContext,
} from '@/lib/types/symphony'
import { TransportError } from '@/lib/symphony/errors'

/**
 * Mock transport for testing
 */
export class MockTransport implements Transport {
  private messages: MessageEnvelope[] = []
  private sentMessages: MessageEnvelope[] = []

  constructor(public readonly name: string = 'mock') {}

  async send(envelope: MessageEnvelope): Promise<void> {
    this.messages.push(envelope)
    this.sentMessages.push(envelope)
  }

  async receive(count: number = 1): Promise<MessageEnvelope[]> {
    const result = this.messages.splice(0, count)
    return result
  }

  async acknowledge(envelope: MessageEnvelope): Promise<void> {
    const index = this.messages.findIndex((m) => m.id === envelope.id)
    if (index !== -1) {
      this.messages.splice(index, 1)
    }
  }

  async reject(
    envelope: MessageEnvelope,
    error: Error
  ): Promise<void> {
    const index = this.messages.findIndex((m) => m.id === envelope.id)
    if (index !== -1) {
      this.messages.splice(index, 1)
    }
  }

  async getQueueDepth(): Promise<number> {
    return this.messages.length
  }

  getSentMessages(): MessageEnvelope[] {
    return [...this.sentMessages]
  }

  clear(): void {
    this.messages = []
    this.sentMessages = []
  }
}

/**
 * Mock handler for testing
 */
export class MockHandler implements MessageHandler {
  private handledMessages: Message[] = []
  private shouldFail = false
  private failMessage?: string

  async handle(
    message: Message,
    envelope: MessageEnvelope,
    context: HandlerContext
  ): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failMessage || 'Mock handler error')
    }

    this.handledMessages.push(message)
  }

  getHandledMessages(): Message[] {
    return [...this.handledMessages]
  }

  setShouldFail(shouldFail: boolean, message?: string): void {
    this.shouldFail = shouldFail
    this.failMessage = message
  }

  clear(): void {
    this.handledMessages = []
    this.shouldFail = false
    this.failMessage = undefined
  }
}

/**
 * Create a mock message envelope
 */
export function createMockEnvelope(
  message: Message,
  overrides?: Partial<MessageEnvelope>
): MessageEnvelope {
  return {
    id: overrides?.id || `mock-${Date.now()}`,
    message,
    headers: overrides?.headers || {},
    transportName: overrides?.transportName || 'mock',
    queueName: overrides?.queueName || 'default',
    priority: overrides?.priority || 5,
    availableAt: overrides?.availableAt || new Date(),
    metadata: overrides?.metadata || {},
    ...overrides,
  }
}

/**
 * Create a mock message
 */
export function createMockMessage(
  type: string = 'TestMessage',
  payload: Record<string, unknown> = { test: 'data' }
): Message {
  return {
    type,
    payload,
    metadata: {},
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}


