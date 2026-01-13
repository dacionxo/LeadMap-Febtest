/**
 * Symphony Messenger Feature Flags
 * Controls gradual rollout of Symphony integration
 */

/**
 * Feature flag configuration
 */
export interface FeatureFlags {
  /** Enable Symphony for email queue processing */
  emailQueueEnabled: boolean
  /** Enable Symphony for campaign processing */
  campaignProcessingEnabled: boolean
  /** Enable Symphony for SMS drip processing */
  smsDripEnabled: boolean
  /** Enable Symphony for all new messages */
  symphonyEnabled: boolean
}

/**
 * Default feature flags (all disabled for gradual rollout)
 */
const defaultFlags: FeatureFlags = {
  emailQueueEnabled: false,
  campaignProcessingEnabled: false,
  smsDripEnabled: false,
  symphonyEnabled: false,
}

/**
 * Get feature flags from environment variables
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    emailQueueEnabled:
      process.env.SYMPHONY_EMAIL_QUEUE_ENABLED === 'true' ||
      defaultFlags.emailQueueEnabled,
    campaignProcessingEnabled:
      process.env.SYMPHONY_CAMPAIGN_PROCESSING_ENABLED === 'true' ||
      defaultFlags.campaignProcessingEnabled,
    smsDripEnabled:
      process.env.SYMPHONY_SMS_DRIP_ENABLED === 'true' ||
      defaultFlags.smsDripEnabled,
    symphonyEnabled:
      process.env.SYMPHONY_ENABLED === 'true' || defaultFlags.symphonyEnabled,
  }
}

/**
 * Check if Symphony is enabled for a specific feature
 */
export function isSymphonyEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags()
  return flags[feature] || flags.symphonyEnabled
}

/**
 * Check if email queue processing should use Symphony
 */
export function shouldUseSymphonyForEmailQueue(): boolean {
  return isSymphonyEnabled('emailQueueEnabled')
}

/**
 * Check if campaign processing should use Symphony
 */
export function shouldUseSymphonyForCampaigns(): boolean {
  return isSymphonyEnabled('campaignProcessingEnabled')
}

/**
 * Check if SMS drip should use Symphony
 */
export function shouldUseSymphonyForSMSDrip(): boolean {
  return isSymphonyEnabled('smsDripEnabled')
}


