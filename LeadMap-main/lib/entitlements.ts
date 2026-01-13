/**
 * Central entitlement logic for subscription gating
 * This is the single source of truth for determining if a user can access the app
 */

export type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

export type UserEntitlement = {
  canUseApp: boolean;
  reason: "paid" | "trial" | "expired";
  trialEndsAt?: Date | null;
};

/**
 * Determines if a user can use the app based on trial and subscription status
 * @param user - User object with trialEndsAt and subscriptionStatus
 * @returns UserEntitlement object indicating access status
 */
export function getEntitlement(user: {
  trialEndsAt: Date | null | string;
  subscriptionStatus: SubscriptionStatus | string;
}): UserEntitlement {
  const now = new Date();

  // Convert trialEndsAt to Date if it's a string
  const trialEndsAt =
    typeof user.trialEndsAt === "string"
      ? new Date(user.trialEndsAt)
      : user.trialEndsAt;

  // Check if trial is still active
  const trialActive = !!trialEndsAt && now < trialEndsAt;

  // Determine if paid subscription is active
  // "active" and "trialing" are both valid paid statuses
  // Optionally allow "past_due" for grace period (currently not included)
  const paidActive =
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "trialing";

  // Priority: Paid > Trial > Expired
  if (paidActive) {
    return {
      canUseApp: true,
      reason: "paid",
      trialEndsAt: trialEndsAt,
    };
  }

  if (trialActive) {
    return {
      canUseApp: true,
      reason: "trial",
      trialEndsAt: trialEndsAt,
    };
  }

  return {
    canUseApp: false,
    reason: "expired",
    trialEndsAt: trialEndsAt,
  };
}

