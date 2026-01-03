/**
 * Authentication utilities for server-side requests
 */

import { NextRequest } from "next/server";
import { getRouteHandlerClient } from "@/lib/supabase-singleton";

/**
 * Get the authenticated user ID from a request
 * @param req - Next.js request object
 * @returns User ID if authenticated, null otherwise
 */
export async function getUserIdFromRequest(
  req: NextRequest | Request
): Promise<string | null> {
  try {
    const supabase = await getRouteHandlerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error("Error getting user ID from request:", error);
    return null;
  }
}

/**
 * Get the authenticated user from a request (for server components)
 * @returns User object if authenticated, null otherwise
 */
export async function getCurrentUser(): Promise<{
  id: string;
  email?: string;
} | null> {
  try {
    const { createServerComponentClient } = await import(
      "@supabase/auth-helpers-nextjs"
    );
    const { cookies } = await import("next/headers");

    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

