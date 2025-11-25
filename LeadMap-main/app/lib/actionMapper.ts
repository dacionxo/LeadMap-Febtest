/**
 * Action Mapper
 * 
 * Maps actions to their target pages and handlers
 * Enables cross-page communication and action routing
 */

import { ActionType, ActionContext, Listing } from '@/app/contexts/PageStateContext'

// Re-export ActionType for convenience
export type { ActionType, ActionContext, Listing } from '@/app/contexts/PageStateContext'

// ============================================================================
// Action Route Configuration
// ============================================================================

export interface ActionRoute {
  targetPage: string
  handler?: (context: ActionContext) => Promise<void> | void
  requiresSelection?: boolean
  minSelections?: number
  maxSelections?: number
}

export const ACTION_ROUTES: Record<ActionType, ActionRoute> = {
  'save_to_crm': {
    targetPage: '/dashboard/lists',
    requiresSelection: true,
    minSelections: 1
  },
  'add_to_list': {
    targetPage: '/dashboard/lists',
    requiresSelection: true,
    minSelections: 1
  },
  'add_to_pipeline': {
    targetPage: '/dashboard/crm/pipeline',
    requiresSelection: true,
    minSelections: 1
  },
  'create_deal': {
    targetPage: '/dashboard/crm/deals',
    requiresSelection: true,
    minSelections: 1,
    maxSelections: 1
  },
  'send_email': {
    targetPage: '/dashboard/crm/sequences',
    requiresSelection: true,
    minSelections: 1
  },
  'make_call': {
    targetPage: '/dashboard/crm/activities',
    requiresSelection: true,
    minSelections: 1
  },
  'view_details': {
    targetPage: '', // Stays on current page
    requiresSelection: true,
    minSelections: 1,
    maxSelections: 1
  },
  'export': {
    targetPage: '', // Stays on current page
    requiresSelection: false
  },
  'import': {
    targetPage: '/admin',
    requiresSelection: false
  },
  'enrich': {
    targetPage: '/dashboard/prospect-enrich',
    requiresSelection: true,
    minSelections: 1
  },
  'create_task': {
    targetPage: '/dashboard/tasks',
    requiresSelection: true,
    minSelections: 1
  },
  'create_campaign': {
    targetPage: '/dashboard/crm/campaigns',
    requiresSelection: true,
    minSelections: 1
  },
  'add_to_sequence': {
    targetPage: '/dashboard/crm/sequences',
    requiresSelection: true,
    minSelections: 1
  }
}

// ============================================================================
// Action Validation
// ============================================================================

export function validateAction(
  action: ActionType,
  selectedCount: number,
  context?: ActionContext
): { valid: boolean; error?: string } {
  const route = ACTION_ROUTES[action]
  
  if (!route) {
    return { valid: false, error: `Unknown action: ${action}` }
  }
  
  if (route.requiresSelection && selectedCount === 0) {
    return { valid: false, error: 'Please select at least one item' }
  }
  
  if (route.minSelections && selectedCount < route.minSelections) {
    return { 
      valid: false, 
      error: `Please select at least ${route.minSelections} item(s)` 
    }
  }
  
  if (route.maxSelections && selectedCount > route.maxSelections) {
    return { 
      valid: false, 
      error: `Please select no more than ${route.maxSelections} item(s)` 
    }
  }
  
  return { valid: true }
}

// ============================================================================
// Action Execution Helpers
// ============================================================================

export function getActionTargetPage(action: ActionType, sourcePage: string): string {
  const route = ACTION_ROUTES[action]
  return route?.targetPage || sourcePage
}

export function prepareActionContext(
  action: ActionType,
  sourcePage: string,
  listingIds: string[],
  listings?: Listing[],
  metadata?: Record<string, any>
): ActionContext {
  return {
    sourcePage,
    targetPage: getActionTargetPage(action, sourcePage),
    listingIds,
    listings,
    metadata
  }
}

// ============================================================================
// Action Button Configuration
// ============================================================================

export interface ActionButtonConfig {
  action: ActionType
  label: string
  icon?: string
  color?: string
  requiresSelection?: boolean
  minSelections?: number
  maxSelections?: number
  tooltip?: string
}

export const ACTION_BUTTONS: ActionButtonConfig[] = [
  {
    action: 'save_to_crm',
    label: 'Save to CRM',
    icon: 'UserPlus',
    color: 'blue',
    requiresSelection: true,
    minSelections: 1
  },
  {
    action: 'add_to_list',
    label: 'Add to List',
    icon: 'List',
    color: 'purple',
    requiresSelection: true,
    minSelections: 1
  },
  {
    action: 'add_to_pipeline',
    label: 'Add to Pipeline',
    icon: 'TrendingUp',
    color: 'green',
    requiresSelection: true,
    minSelections: 1
  },
  {
    action: 'create_deal',
    label: 'Create Deal',
    icon: 'Briefcase',
    color: 'orange',
    requiresSelection: true,
    minSelections: 1,
    maxSelections: 1
  },
  {
    action: 'send_email',
    label: 'Send Email',
    icon: 'Mail',
    color: 'blue',
    requiresSelection: true,
    minSelections: 1
  },
  {
    action: 'make_call',
    label: 'Make Call',
    icon: 'Phone',
    color: 'green',
    requiresSelection: true,
    minSelections: 1
  },
  {
    action: 'view_details',
    label: 'View Details',
    icon: 'Eye',
    color: 'gray',
    requiresSelection: true,
    minSelections: 1,
    maxSelections: 1
  },
  {
    action: 'export',
    label: 'Export',
    icon: 'Download',
    color: 'blue',
    requiresSelection: false
  },
  {
    action: 'enrich',
    label: 'Enrich',
    icon: 'Sparkles',
    color: 'purple',
    requiresSelection: true,
    minSelections: 1
  },
  {
    action: 'create_task',
    label: 'Create Task',
    icon: 'CheckSquare',
    color: 'yellow',
    requiresSelection: true,
    minSelections: 1
  }
]

// ============================================================================
// Page Action Handlers
// ============================================================================

export interface PageActionHandler {
  page: string
  handlers: Partial<Record<ActionType, (context: ActionContext) => Promise<void> | void>>
}

// Register page-specific action handlers
const pageHandlers = new Map<string, Partial<Record<ActionType, (context: ActionContext) => Promise<void> | void>>>()

export function registerPageHandler(
  page: string,
  handlers: Partial<Record<ActionType, (context: ActionContext) => Promise<void> | void>>
) {
  pageHandlers.set(page, handlers)
}

export function getPageHandler(page: string, action: ActionType) {
  return pageHandlers.get(page)?.[action]
}

// ============================================================================
// Navigation Helpers
// ============================================================================

export function buildActionUrl(
  action: ActionType,
  sourcePage: string,
  listingIds?: string[],
  metadata?: Record<string, any>
): string {
  const targetPage = getActionTargetPage(action, sourcePage)
  const params = new URLSearchParams()
  
  if (listingIds && listingIds.length > 0) {
    params.set('ids', listingIds.join(','))
  }
  
  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, String(value))
      }
    })
  }
  
  params.set('action', action)
  params.set('source', sourcePage)
  
  return `${targetPage}?${params.toString()}`
}

