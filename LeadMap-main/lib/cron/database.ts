/**
 * Database utilities for cron jobs
 * Provides type-safe Supabase client wrapper and helper functions
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DatabaseError } from './errors'
import type { DatabaseOperationResult } from '@/lib/types/cron'

/**
 * Gets a type-safe Supabase service role client for cron jobs
 * Uses singleton pattern to prevent multiple client instances
 * 
 * @returns Supabase client with service role permissions
 */
export function getCronSupabaseClient(): SupabaseClient {
  try {
    return getServiceRoleClient()
  } catch (error) {
    throw new DatabaseError(
      'Failed to initialize Supabase client',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

/**
 * Executes a database query with proper error handling
 * 
 * @param operation - The database operation to execute
 * @param context - Context for error messages
 * @returns Result with success flag and data/error
 */
export async function executeDatabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: unknown }>,
  context?: {
    operation?: string
    table?: string
    [key: string]: unknown
  }
): Promise<DatabaseOperationResult<T>> {
  try {
    const result = await operation()

    if (result.error) {
      const errorMessage =
        result.error instanceof Error
          ? result.error.message
          : 'Database operation failed'

      console.error('Database operation error:', {
        ...context,
        error: errorMessage,
      })

      return {
        success: false,
        error: errorMessage,
      }
    }

    return {
      success: true,
      data: result.data ?? undefined,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error'

    // TODO: Replace with structured logging (Sentry or similar) in production
    console.error('[Database Operation] Exception:', {
      ...context,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Executes a database update operation with type safety
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param data - Update data (typed as any for Supabase compatibility)
 * @param filter - Filter function that receives the update builder and applies filters (e.g., (updateBuilder) => updateBuilder.eq('id', id))
 * @param context - Context for error messages
 * @returns Result with success flag and count
 */
export async function executeUpdateOperation(
  supabase: SupabaseClient,
  table: string,
  data: Record<string, unknown>,
  filter: (updateBuilder: any) => any, // Update builder after .update() call
  context?: {
    operation?: string
    [key: string]: unknown
  }
): Promise<DatabaseOperationResult<number>> {
  return executeDatabaseOperation(
    async () => {
      // CRITICAL FIX: In Supabase, the correct flow is:
      // 1. supabase.from(table) - returns query builder
      // 2. .update(data) - returns filter builder (PostgrestFilterBuilder)
      // 3. .eq('id', value) - called on filter builder
      const query = supabase.from(table)
      const updateBuilder = query.update(data)
      const filteredQuery = filter(updateBuilder)
      const result = await filteredQuery
      return {
        data: result.data,
        error: result.error,
      }
    },
    {
      ...context,
      table,
      operation: 'update',
    }
  )
}

/**
 * Executes a database insert operation with type safety
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param data - Insert data (can be single object or array)
 * @param context - Context for error messages
 * @returns Result with success flag and inserted data
 */
export async function executeInsertOperation<T>(
  supabase: SupabaseClient,
  table: string,
  data: T | T[],
  context?: {
    operation?: string
    [key: string]: unknown
  }
): Promise<DatabaseOperationResult<T>> {
  return executeDatabaseOperation(
    async () => {
      // Use .select() to return inserted data
      const dataArray = Array.isArray(data) ? data : [data]
      const result = await supabase.from(table).insert(dataArray as object[]).select()
      return {
        data: result.data as T | null,
        error: result.error,
      }
    },
    {
      ...context,
      table,
      operation: 'insert',
    }
  )
}

/**
 * Executes a database select operation with type safety
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param select - Select columns (default: '*')
 * @param filter - Filter function that operates on the result of .select() (e.g., .eq('id', id))
 * @param context - Context for error messages
 * @returns Result with success flag and data
 * 
 * Note: When using .single(), the result will be a single object, not an array.
 * Callers should handle this appropriately (see schedule-next-step.ts for example).
 */
export async function executeSelectOperation<T>(
  supabase: SupabaseClient,
  table: string,
  select: string = '*',
  filter?: (query: any) => any,
  context?: {
    operation?: string
    [key: string]: unknown
  }
): Promise<DatabaseOperationResult<T[] | T>> {
  return executeDatabaseOperation(
    async () => {
      let query = supabase.from(table).select(select)
      if (filter) {
        query = filter(query)
      }
      const result = await query
      return {
        data: result.data as T[] | T | null,
        error: result.error,
      }
    },
    {
      ...context,
      table,
      operation: 'select',
    }
  )
}

/**
 * Executes a database delete operation with type safety
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param filter - Filter function (e.g., .eq('id', id))
 * @param context - Context for error messages
 * @returns Result with success flag (Supabase delete returns null for data by default)
 */
export async function executeDeleteOperation(
  supabase: SupabaseClient,
  table: string,
  filter: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>,
  context?: {
    operation?: string
    [key: string]: unknown
  }
): Promise<DatabaseOperationResult<null>> {
  return executeDatabaseOperation(
    async () => {
      let query = supabase.from(table)
      query = filter(query as ReturnType<typeof supabase.from>) as typeof query
      const result = await query.delete()
      return {
        data: result.data,
        error: result.error,
      }
    },
    {
      ...context,
      table,
      operation: 'delete',
    }
  )
}

