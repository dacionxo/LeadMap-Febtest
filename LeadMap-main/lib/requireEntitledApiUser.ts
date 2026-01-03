/**
 * API route guard to require authenticated user with active trial or subscription
 */

import { NextResponse, NextRequest } from "next/server";
import { getEntitlement } from "@/lib/entitlements";
import { getUserIdFromRequest } from "@/lib/auth";
import { getServiceRoleClient } from "@/lib/supabase-singleton";

export type EntitledUser = {
  id: string;
  email: string;
  trialEndsAt: Date | null;
  subscriptionStatus: string;
};

export type RequireEntitlementResult =
  | { ok: false; res: NextResponse }
  | { ok: true; user: EntitledUser; ent: ReturnType<typeof getEntitlement> };

/**
 * Require authenticated user with active trial or subscription
 * Returns early with 401/402 response if user is not authenticated or not entitled
 * @param req - Next.js request object
 * @returns Result object with either error response or user + entitlement
 */
export async function requireEntitledApiUser(
  req: NextRequest | Request
): Promise<RequireEntitlementResult> {
  // Get user ID from auth
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Get user from database
  const supabase = getServiceRoleClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, trial_end, subscription_status")
    .eq("id", userId)
    .single();

  if (error || !user) {
    console.error("Error fetching user:", error);
    return {
      ok: false,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Check entitlement
  const ent = getEntitlement({
    trialEndsAt: user.trial_end,
    subscriptionStatus: (user.subscription_status as string) || "none",
  });

  if (!ent.canUseApp) {
    return {
      ok: false,
      res: NextResponse.json(
        {
          error: "Payment required",
          reason: ent.reason,
          trialEndsAt: ent.trialEndsAt,
        },
        { status: 402 }
      ),
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email || "",
      trialEndsAt: user.trial_end ? new Date(user.trial_end) : null,
      subscriptionStatus: (user.subscription_status as string) || "none",
    },
    ent,
  };
}

