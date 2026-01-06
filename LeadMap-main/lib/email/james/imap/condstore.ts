/**
 * IMAP CONDSTORE (Conditional STORE) Support
 * 
 * CONDSTORE extension patterns following james-project implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see RFC 4551: IMAP Extension for Conditional STORE Operation
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/fetch/FetchProcessor.java
 */

/**
 * CONDSTORE capability
 */
export const CONDSTORE_CAPABILITY = 'CONDSTORE'

/**
 * ModSeq (modification sequence) value
 */
export type ModSeq = number

/**
 * CONDSTORE fetch item
 */
export interface CondStoreFetchItem {
  modseq?: ModSeq // Request messages with modseq >= this value
  changedSince?: ModSeq // Request messages changed since this modseq
}

/**
 * CONDSTORE store flags result
 */
export interface CondStoreResult {
  success: boolean
  modseq?: ModSeq // New modseq after operation
  unchanged?: number[] // UIDs that were unchanged
  error?: string
}

/**
 * CONDSTORE metadata
 */
export interface CondStoreMetadata {
  highestModSeq: ModSeq
  perMessageModSeq?: Map<number, ModSeq> // UID -> ModSeq mapping
}

/**
 * CONDSTORE manager
 * Following james-project CONDSTORE patterns
 */
export class CondStoreManager {
  private highestModSeq: ModSeq = 0
  private perMessageModSeq: Map<number, ModSeq> = new Map()

  /**
   * Get highest modseq
   * 
   * @returns Highest modseq
   */
  getHighestModSeq(): ModSeq {
    return this.highestModSeq
  }

  /**
   * Get modseq for message
   * 
   * @param uid - Message UID
   * @returns Modseq or undefined
   */
  getMessageModSeq(uid: number): ModSeq | undefined {
    return this.perMessageModSeq.get(uid)
  }

  /**
   * Increment modseq and assign to message
   * 
   * @param uid - Message UID
   * @returns New modseq
   */
  incrementModSeq(uid: number): ModSeq {
    this.highestModSeq++
    this.perMessageModSeq.set(uid, this.highestModSeq)
    return this.highestModSeq
  }

  /**
   * Get metadata
   * 
   * @returns CONDSTORE metadata
   */
  getMetadata(): CondStoreMetadata {
    return {
      highestModSeq: this.highestModSeq,
      perMessageModSeq: new Map(this.perMessageModSeq),
    }
  }

  /**
   * Check if message changed since modseq
   * 
   * @param uid - Message UID
   * @param changedSince - Modseq to check against
   * @returns true if message changed
   */
  hasChangedSince(uid: number, changedSince: ModSeq): boolean {
    const messageModSeq = this.perMessageModSeq.get(uid)
    if (!messageModSeq) {
      return false
    }
    return messageModSeq > changedSince
  }

  /**
   * Get changed UIDs since modseq
   * 
   * @param changedSince - Modseq to check against
   * @returns Array of changed UIDs
   */
  getChangedUids(changedSince: ModSeq): number[] {
    const changed: number[] = []
    for (const [uid, modseq] of this.perMessageModSeq.entries()) {
      if (modseq > changedSince) {
        changed.push(uid)
      }
    }
    return changed
  }
}

/**
 * Create CONDSTORE manager
 * 
 * @returns CONDSTORE manager instance
 */
export function createCondStoreManager(): CondStoreManager {
  return new CondStoreManager()
}

