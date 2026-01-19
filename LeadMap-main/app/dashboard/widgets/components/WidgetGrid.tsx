/**
 * Widget Grid Layout
 * Drag & drop grid system using react-grid-layout
 */

'use client'

import { useCallback, useMemo } from 'react'
import type { Layout } from 'react-grid-layout'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { WidgetDefinition, WidgetLayout } from '../types'
import { WidgetContainer } from './WidgetContainer'

// Layout item interface (individual item in a layout array)
export interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
}

const ResponsiveGridLayout = WidthProvider(Responsive)

interface WidgetGridProps {
  widgets: WidgetDefinition[]
  widgetData: Record<string, any>
  widgetLoading: Record<string, boolean>
  widgetErrors: Record<string, string | null>
  layouts?: { lg?: LayoutItem[]; md?: LayoutItem[]; sm?: LayoutItem[] }
  isEditable?: boolean
  isFullscreen?: boolean
  fullscreenWidgetId?: string | null
  onLayoutChange?: (layouts: { lg?: LayoutItem[]; md?: LayoutItem[]; sm?: LayoutItem[] }) => void
  onRemove?: (id: string) => void
  onRefresh?: (id: string) => void
  onSettings?: (id: string) => void
  onFullscreen?: (id: string) => void
  onExitFullscreen?: () => void
}

export function WidgetGrid({
  widgets,
  widgetData,
  widgetLoading,
  widgetErrors,
  layouts,
  isEditable = false,
  isFullscreen = false,
  fullscreenWidgetId,
  onLayoutChange,
  onRemove,
  onRefresh,
  onSettings,
  onFullscreen,
  onExitFullscreen
}: WidgetGridProps) {
  // Generate default layouts from widget definitions
  const defaultLayouts = useMemo(() => {
    const lg: LayoutItem[] = []
    const md: LayoutItem[] = []
    const sm: LayoutItem[] = []

    widgets.forEach((widget, index) => {
      const meta = widget.meta
      const defaultSize = meta?.defaultSize || { w: 1, h: 1 }
      const minSize = meta?.minSize || { w: 1, h: 1 }

      // Calculate position (simple grid layout)
      const cols = 12
      const x = (index * defaultSize.w) % cols
      const y = Math.floor((index * defaultSize.w) / cols) * defaultSize.h

      const baseLayout: LayoutItem = {
        i: widget.id,
        x,
        y,
        w: defaultSize.w,
        h: defaultSize.h,
        minW: minSize.w,
        minH: minSize.h,
        maxW: meta?.maxSize?.w || 6,
        maxH: meta?.maxSize?.h || 6,
      }

      lg.push(baseLayout)
      md.push({ ...baseLayout, w: Math.min(baseLayout.w, 6), h: baseLayout.h })
      sm.push({ ...baseLayout, w: 6, h: baseLayout.h })
    })

    return { lg, md, sm }
  }, [widgets])

  const currentLayouts = layouts || defaultLayouts

  const handleLayoutChange = useCallback(
    (layout: Layout, allLayouts: Partial<Record<string, Layout>>) => {
      if (onLayoutChange) {
        // Convert Layout (which is LayoutItem[]) to our format
        const formatted: { lg?: LayoutItem[]; md?: LayoutItem[]; sm?: LayoutItem[] } = {}
        Object.keys(allLayouts).forEach(key => {
          if (key === 'lg' || key === 'md' || key === 'sm') {
            const layoutArray = allLayouts[key]
            if (layoutArray) {
              formatted[key] = layoutArray as LayoutItem[]
            }
          }
        })
        onLayoutChange(formatted)
      }
    },
    [onLayoutChange]
  )

  // Handle fullscreen widget rendering
  const fullscreenWidget = isFullscreen && fullscreenWidgetId
    ? widgets.find(w => w.id === fullscreenWidgetId)
    : null

  if (fullscreenWidget) {
    return (
      <WidgetContainer
        widget={fullscreenWidget}
        data={widgetData[fullscreenWidget.id]}
        loading={widgetLoading[fullscreenWidget.id]}
        error={widgetErrors[fullscreenWidget.id]}
        isFullscreen={true}
        onRefresh={onRefresh ? () => onRefresh(fullscreenWidget.id) : undefined}
        onSettings={onSettings ? () => onSettings(fullscreenWidget.id) : undefined}
        onExitFullscreen={onExitFullscreen}
      />
    )
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={currentLayouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={100}
      isDraggable={isEditable}
      isResizable={isEditable}
      draggableHandle=".drag-handle"
      onLayoutChange={handleLayoutChange}
      margin={[16, 16]}
      containerPadding={[16, 16]}
      compactType="vertical"
      preventCollision={false}
    >
      {widgets.map((widget) => (
        <div key={widget.id} className="widget-item">
          <WidgetContainer
            widget={widget}
            data={widgetData[widget.id]}
            loading={widgetLoading[widget.id]}
            error={widgetErrors[widget.id]}
            isEditable={isEditable}
            onRemove={onRemove}
            onRefresh={onRefresh ? () => onRefresh(widget.id) : undefined}
            onSettings={onSettings ? () => onSettings(widget.id) : undefined}
            onFullscreen={onFullscreen ? () => onFullscreen(widget.id) : undefined}
          />
        </div>
      ))}
    </ResponsiveGridLayout>
  )
}
