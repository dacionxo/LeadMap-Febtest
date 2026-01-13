/**
 * IMAP QRESYNC (Quick Resynchronization) Support
 * 
 * QRESYNC extension patterns following james-project implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see RFC 5162: IMAP4 Extensions for Quick Mailbox Resynchronization
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/fetch/FetchProcessor.java
 */

import { createCondStoreManager, CondStoreManager } from './condstore'

/**
 * QRESYNC capability
 */
export const QRESYNC_CAPABILITY = 'QRESYNC'

/**
 * QRESYNC UID validity
 */
export type UidValidity = number

/**
 * QRESYNC sequence set
 */
export type SequenceSet = string | number | Array<number | string>

/**
 * QRESYNC select parameters
 */
export interface QResyncSelectParams {
  uidValidity: UidValidity
  modseq: number
  knownUids?: SequenceSet // Known UIDs
  seqMatchData?: SequenceSet // Sequence match data
}

/**
 * QRESYNC fetch parameters
 */
export interface QResyncFetchParams {
  changedSince?: number // Modseq to fetch changes since
  vanished?: boolean // Include vanished messages
  sequenceSet?: SequenceSet // Specific sequence set
}

/**
 * QRESYNC vanished messages
 */
export interface VanishedMessages {
  uids: number[]
  modseq: number
}

/**
 * QRESYNC result
 */
export interface QResyncResult {
  uidValidity: UidValidity
  modseq: number
  vanished?: VanishedMessages
  changed?: number[] // Changed UIDs
  flags?: Map<number, string[]> // UID -> flags mapping
}

/**
 * QRESYNC manager
 * Following james-project QRESYNC patterns
 */
export class QResyncManager {
  private uidValidity: UidValidity = 0
  private condStoreManager: CondStoreManager

  constructor(condStoreManager?: CondStoreManager) {
    // In a real implementation, this would use the actual CondStoreManager
    // For now, we'll create a placeholder
    this.uidValidity = Date.now() // Use timestamp as initial UID validity
    // Initialize condStoreManager - create default if not provided
    this.condStoreManager = condStoreManager || createCondStoreManager()
  }

  /**
   * Get UID validity
   * 
   * @returns UID validity
   */
  getUidValidity(): UidValidity {
    return this.uidValidity
  }

  /**
   * Set UID validity
   * 
   * @param validity - UID validity
   */
  setUidValidity(validity: UidValidity): void {
    this.uidValidity = validity
  }

  /**
   * Validate QRESYNC parameters
   * 
   * @param params - QRESYNC select parameters
   * @returns true if valid
   */
  validateParams(params: QResyncSelectParams): boolean {
    // Check UID validity
    if (params.uidValidity !== this.uidValidity) {
      return false
    }

    return true
  }

  /**
   * Get vanished messages
   * 
   * @param knownUids - Known UIDs from client
   * @param currentUids - Current UIDs in mailbox
   * @param modseq - Modseq threshold
   * @returns Vanished messages
   */
  getVanishedMessages(
    knownUids: number[],
    currentUids: number[],
    modseq: number
  ): VanishedMessages {
    const vanished = knownUids.filter(uid => !currentUids.includes(uid))
    return {
      uids: vanished,
      modseq,
    }
  }

  /**
   * Process QRESYNC select
   * 
   * @param params - QRESYNC select parameters
   * @param currentUids - Current UIDs in mailbox
   * @returns QRESYNC result
   */
  processSelect(
    params: QResyncSelectParams,
    currentUids: number[]
  ): QResyncResult {
    if (!this.validateParams(params)) {
      throw new Error('Invalid QRESYNC parameters')
    }

    const knownUids = this.parseSequenceSet(params.knownUids || [])
    const vanished = this.getVanishedMessages(knownUids, currentUids, params.modseq)

    return {
      uidValidity: this.uidValidity,
      modseq: params.modseq,
      vanished,
    }
  }

  /**
   * Parse sequence set
   * 
   * @param sequenceSet - Sequence set string or array
   * @returns Array of UIDs
   */
  private parseSequenceSet(sequenceSet: SequenceSet): number[] {
    if (typeof sequenceSet === 'number') {
      return [sequenceSet]
    }

    if (typeof sequenceSet === 'string') {
      // Parse sequence set string (e.g., "1:10", "1,3,5")
      const uids: number[] = []
      const parts = sequenceSet.split(',')
      for (const part of parts) {
        if (part.includes(':')) {
          const [start, end] = part.split(':').map(Number)
          for (let i = start; i <= end; i++) {
            uids.push(i)
          }
        } else {
          uids.push(Number(part))
        }
      }
      return uids
    }

    if (Array.isArray(sequenceSet)) {
      return sequenceSet.map(item => typeof item === 'number' ? item : Number(item))
    }

    return []
  }
}

/**
 * Create QRESYNC manager
 * 
 * @param condStoreManager - Optional CONDSTORE manager
 * @returns QRESYNC manager instance
 */
export function createQResyncManager(
  condStoreManager?: CondStoreManager
): QResyncManager {
  return new QResyncManager(condStoreManager)
}

