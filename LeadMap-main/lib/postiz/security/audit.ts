/**
 * Security Audit System for Postiz
 * 
 * Tracks and audits security-related events including:
 * - Service role usage
 * - Credential access
 * - Access control violations
 * - Suspicious activities
 * 
 * Phase 7: Quality, Security & Operations - Security
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { createLogger, type LogContext } from '../observability/logging'

export interface AuditEvent {
  id: string
  eventType: AuditEventType
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  workspaceId?: string
  resourceType: string
  resourceId?: string
  action: string
  outcome: 'success' | 'failure' | 'denied'
  metadata: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

export enum AuditEventType {
  // Service role usage
  SERVICE_ROLE_ACCESS = 'service_role_access',
  SERVICE_ROLE_QUERY = 'service_role_query',

  // Credential access
  CREDENTIAL_ACCESS = 'credential_access',
  CREDENTIAL_UPDATE = 'credential_update',
  CREDENTIAL_DELETE = 'credential_delete',

  // Access control
  ACCESS_DENIED = 'access_denied',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  CROSS_TENANT_ACCESS_ATTEMPT = 'cross_tenant_access_attempt',

  // Authentication
  OAUTH_INITIATED = 'oauth_initiated',
  OAUTH_COMPLETED = 'oauth_completed',
  OAUTH_FAILED = 'oauth_failed',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_REFRESH_FAILED = 'token_refresh_failed',

  // Data access
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  BULK_DATA_EXPORT = 'bulk_data_export',

  // Administrative actions
  WORKSPACE_CREATED = 'workspace_created',
  WORKSPACE_DELETED = 'workspace_deleted',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
  ROLE_CHANGED = 'role_changed',
}

/**
 * Security audit logger for Postiz
 */
export class PostizAudit {
  private supabase = getServiceRoleClient()
  private logger = createLogger('postiz-audit')

  /**
   * Log an audit event
   */
  async logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        ...event,
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        timestamp: new Date().toISOString(),
      }

      // Store in activity_logs with special audit flag
      await (this.supabase.from('activity_logs') as any).insert({
        workspace_id: event.workspaceId || null,
        user_id: event.userId || null,
        activity_type: event.eventType as any,
        activity_description: `${event.action} - ${event.outcome}`,
        activity_metadata: {
          audit: true,
          severity: event.severity,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          action: event.action,
          outcome: event.outcome,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          ...event.metadata,
        },
        occurred_at: auditEvent.timestamp,
      })

      // Log high/critical severity events
      if (['high', 'critical'].includes(event.severity)) {
        this.logger.warn(`Security audit event: ${event.eventType}`, {
          severity: event.severity,
          action: event.action,
          outcome: event.outcome,
          userId: event.userId,
          workspaceId: event.workspaceId,
        })
      }

      // In production, you might want to send critical events to a security monitoring system
      if (event.severity === 'critical') {
        // await this.sendSecurityAlert(auditEvent)
      }
    } catch (error: any) {
      // Don't fail the operation if audit logging fails
      this.logger.error('Failed to log audit event', error)
    }
  }

  /**
   * Audit service role usage
   */
  async auditServiceRoleUsage(
    operation: string,
    resourceType: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      eventType: AuditEventType.SERVICE_ROLE_ACCESS,
      severity: 'medium',
      resourceType,
      resourceId,
      action: operation,
      outcome: 'success',
      metadata: {
        operation,
        ...metadata,
      },
    })
  }

  /**
   * Audit credential access
   */
  async auditCredentialAccess(
    userId: string,
    workspaceId: string,
    socialAccountId: string,
    action: 'read' | 'update' | 'delete',
    outcome: 'success' | 'failure' | 'denied'
  ): Promise<void> {
    await this.logAuditEvent({
      eventType:
        action === 'read'
          ? AuditEventType.CREDENTIAL_ACCESS
          : action === 'update'
            ? AuditEventType.CREDENTIAL_UPDATE
            : AuditEventType.CREDENTIAL_DELETE,
      severity: outcome === 'denied' ? 'high' : action === 'delete' ? 'medium' : 'low',
      userId,
      workspaceId,
      resourceType: 'credential',
      resourceId: socialAccountId,
      action: `credential_${action}`,
      outcome,
      metadata: {
        socialAccountId,
      },
    })
  }

  /**
   * Audit access denied
   */
  async auditAccessDenied(
    userId: string,
    workspaceId: string,
    resourceType: string,
    resourceId?: string,
    reason?: string
  ): Promise<void> {
    await this.logAuditEvent({
      eventType: AuditEventType.ACCESS_DENIED,
      severity: 'medium',
      userId,
      workspaceId,
      resourceType,
      resourceId,
      action: 'access_denied',
      outcome: 'denied',
      metadata: {
        reason,
      },
    })
  }

  /**
   * Audit cross-tenant access attempt
   */
  async auditCrossTenantAccessAttempt(
    userId: string,
    attemptedWorkspaceId: string,
    userWorkspaceId: string,
    resourceType: string,
    resourceId?: string
  ): Promise<void> {
    await this.logAuditEvent({
      eventType: AuditEventType.CROSS_TENANT_ACCESS_ATTEMPT,
      severity: 'critical',
      userId,
      workspaceId: attemptedWorkspaceId,
      resourceType,
      resourceId,
      action: 'cross_tenant_access_attempt',
      outcome: 'denied',
      metadata: {
        attemptedWorkspaceId,
        userWorkspaceId,
      },
    })
  }

  /**
   * Audit OAuth operation
   */
  async auditOAuthOperation(
    userId: string,
    workspaceId: string,
    provider: string,
    operation: 'initiated' | 'completed' | 'failed',
    metadata?: Record<string, any>
  ): Promise<void> {
    const eventType =
      operation === 'initiated'
        ? AuditEventType.OAUTH_INITIATED
        : operation === 'completed'
          ? AuditEventType.OAUTH_COMPLETED
          : AuditEventType.OAUTH_FAILED

    await this.logAuditEvent({
      eventType,
      severity: operation === 'failed' ? 'medium' : 'low',
      userId,
      workspaceId,
      resourceType: 'oauth',
      resourceId: provider,
      action: `oauth_${operation}`,
      outcome: operation === 'completed' ? 'success' : 'failure',
      metadata: {
        provider,
        ...metadata,
      },
    })
  }

  /**
   * Get audit events for a workspace
   */
  async getAuditEvents(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
    eventTypes?: AuditEventType[]
  ): Promise<AuditEvent[]> {
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    const end = endDate || new Date()

    let query = this.supabase
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('activity_metadata->>audit', 'true')
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(1000)

    if (eventTypes && eventTypes.length > 0) {
      query = query.in('activity_type', eventTypes as any[])
    }

    const queryResult = await query

    const logs = queryResult.data as Array<{
      id: string
      activity_type: string
      activity_metadata: {
        audit?: boolean
        severity?: string
        resourceType?: string
        resourceId?: string
        action?: string
        outcome?: string
        ipAddress?: string
        userAgent?: string
        [key: string]: any
      } | null
      user_id: string | null
      workspace_id: string
      occurred_at: string
    }> | null
    const error = queryResult.error

    if (error || !logs) {
      return []
    }

    return logs.map((log) => ({
      id: log.id,
      eventType: log.activity_type as AuditEventType,
      severity: (log.activity_metadata?.severity || 'low') as AuditEvent['severity'],
      userId: log.user_id || undefined,
      workspaceId: log.workspace_id,
      resourceType: log.activity_metadata?.resourceType || 'unknown',
      resourceId: log.activity_metadata?.resourceId,
      action: log.activity_metadata?.action || 'unknown',
      outcome: (log.activity_metadata?.outcome || 'success') as AuditEvent['outcome'],
      metadata: log.activity_metadata || {},
      ipAddress: log.activity_metadata?.ipAddress,
      userAgent: log.activity_metadata?.userAgent,
      timestamp: log.occurred_at,
    }))
  }

  /**
   * Check for suspicious activities
   */
  async checkSuspiciousActivities(workspaceId: string, days: number = 7): Promise<AuditEvent[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get critical and high severity events
    const events = await this.getAuditEvents(workspaceId, startDate)

    return events.filter(
      (e) =>
        e.severity === 'critical' ||
        (e.severity === 'high' &&
          (e.eventType === AuditEventType.CROSS_TENANT_ACCESS_ATTEMPT ||
            e.eventType === AuditEventType.UNAUTHORIZED_ACCESS ||
            e.outcome === 'denied'))
    )
  }
}

/**
 * Singleton audit instance
 */
export const postizAudit = new PostizAudit()
