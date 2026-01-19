/**
 * Widget Type System
 * Strongly typed configurations for all widget types
 */

import { ComponentType } from 'react'

export type WidgetType = 
  | 'kpi_number'
  | 'kpi_percentage'
  | 'kpi_currency'
  | 'chart_line'
  | 'chart_bar'
  | 'chart_pie'
  | 'table'
  | 'activity_feed'
  | 'battery_progress'
  | 'text'
  | 'actions'

export type TrendDirection = 'up' | 'down' | 'neutral'

export type RefreshPolicy = 'inherit' | 'realtime' | '1m' | '5m' | '15m' | '30m' | '1h' | 'manual'

export interface WidgetFilters {
  dateRange?: {
    from: Date
    to: Date
  }
  userIds?: string[]
  stage?: string[]
  status?: string[]
  source?: string[]
  [key: string]: any
}

export interface WidgetDisplayConfig {
  format?: 'number' | 'currency' | 'percentage' | 'duration'
  unit?: string
  decimals?: number
  showTrend?: boolean
  showIcon?: boolean
  colorScheme?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'secondary'
  thresholds?: {
    value: number
    color: string
  }[]
  showLegend?: boolean
  chartType?: 'line' | 'bar' | 'pie' | 'area'
}

export interface WidgetLayout {
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export interface WidgetDefinition {
  id: string
  type: WidgetType
  title: string
  description?: string
  icon: ComponentType<{ className?: string }>
  component: ComponentType<WidgetComponentProps>
  defaultEnabled: boolean
  category: 'metrics' | 'activity' | 'charts' | 'actions' | 'crm' | 'prospects'
  
  // Query configuration
  query?: {
    endpoint?: string
    metric?: string
    dataset?: string
  }
  
  // Filter configuration
  filters?: WidgetFilters
  
  // Display configuration
  display?: WidgetDisplayConfig
  
  // Layout configuration
  layout?: WidgetLayout
  
  // Refresh policy
  refreshPolicy?: RefreshPolicy
  
  // Metadata
  meta?: {
    name: string
    icon?: ComponentType<{ className?: string }>
    minSize?: { w: number; h: number }
    maxSize?: { w: number; h: number }
    defaultSize?: { w: number; h: number }
  }
}

export interface WidgetComponentProps {
  widget: WidgetDefinition
  data?: any
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onSettings?: () => void
  isFullscreen?: boolean
}

export interface WidgetSettings {
  title?: string
  filters?: WidgetFilters
  display?: WidgetDisplayConfig
  refreshPolicy?: RefreshPolicy
}

export interface KPIData {
  value: number | string
  change?: string
  trend?: TrendDirection
  label?: string
  previousValue?: number
  formattedValue?: string
}
