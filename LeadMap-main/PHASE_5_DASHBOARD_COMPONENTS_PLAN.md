# Phase 5: Dashboard Components - Implementation Plan

## Overview

Phase 5 focuses on creating comprehensive dashboard components to visualize the A/B testing, campaign performance, template performance, and comparative analytics APIs built in Phase 4. All components will follow Mautic dashboard patterns and be fully responsive with mobile-first design.

## Implementation Strategy

### Architecture Approach
- **Component-Based**: Create reusable, composable React components
- **Mautic-Inspired**: Follow Mautic's dashboard visualization patterns (bar charts, comparison views, winner indicators)
- **Recharts Integration**: Use existing Recharts library for all visualizations
- **Real-time Updates**: Extend Supabase Realtime subscriptions to new components
- **Mobile-First**: Follow .cursorrules mobile-first approach with TailwindCSS

## World-Class To-Do List

### 📊 A/B Testing Dashboard Components

#### Task 1: Research Mautic Dashboard Patterns
**Priority**: High | **Estimated Time**: 30 minutes
- Review Mautic A/B testing dashboard UI patterns from Context7
- Study Mautic bar chart visualization for variant comparison
- Analyze winner determination UI patterns
- Document Mautic styling and layout patterns

**Deliverables**:
- Research notes on Mautic dashboard patterns
- Reference examples for implementation

---

#### Task 2: Create ABTestingDashboard Component
**Priority**: High | **Estimated Time**: 4 hours
**File**: `app/dashboard/marketing/components/ABTestingDashboard.tsx`

**Features**:
- Main container for A/B testing analytics
- Fetches variant data from `/api/email/analytics/variants`
- Displays parent email information
- Shows all variants with performance metrics
- Winner determination visualization
- Statistical significance indicators
- Test configuration display (winner criteria, sample size, confidence level)

**Mautic Patterns**:
- Bar chart visualization for variant comparison
- Winner badge/indicator
- Performance metrics cards
- Test status indicators

**Props Interface**:
```typescript
interface ABTestingDashboardProps {
  parentEmailId: string
  onVariantSelect?: (variantId: string) => void
  showDetails?: boolean
}
```

---

#### Task 3: Create VariantPerformanceCard Component
**Priority**: High | **Estimated Time**: 2 hours
**File**: `app/dashboard/marketing/components/VariantPerformanceCard.tsx`

**Features**:
- Individual variant performance display
- Sent/Delivered/Opened/Clicked/Replied counts
- Rate calculations (open rate, click rate, reply rate)
- Winner badge when variant is winner
- Statistical significance indicator
- Progress indicators for sample size
- Color-coded performance (green for winner, neutral for others)

**Mautic Patterns**:
- Card-based layout
- Metric badges
- Winner highlighting
- Performance indicators

**Props Interface**:
```typescript
interface VariantPerformanceCardProps {
  variant: {
    id: string
    variant_name: string
    variant_type: string
    status: string
    is_winner: boolean
    performance: {
      sent_count: number
      delivered_count: number
      opened_count: number
      clicked_count: number
      replied_count: number
      open_rate: number
      click_rate: number
      reply_rate: number
    }
  }
  minimumSampleSize?: number
  onSelect?: () => void
}
```

---

#### Task 4: Create VariantComparisonChart Component
**Priority**: High | **Estimated Time**: 3 hours
**File**: `app/dashboard/marketing/components/VariantComparisonChart.tsx`

**Features**:
- Side-by-side bar chart comparing all variants
- Multiple metrics (open rate, click rate, reply rate)
- Color-coded bars per variant
- Winner highlighting
- Interactive tooltips with detailed metrics
- Legend for metric types
- Responsive design

**Mautic Patterns**:
- Bar chart with multiple datasets (following Mautic A/B test bargraph pattern)
- Grouped bars for variant comparison
- Support template for custom chart rendering

**Props Interface**:
```typescript
interface VariantComparisonChartProps {
  variants: Array<{
    variant_name: string
    performance: {
      open_rate: number
      click_rate: number
      reply_rate: number
    }
    is_winner: boolean
  }>
  metrics?: ('open_rate' | 'click_rate' | 'reply_rate')[]
  height?: number
}
```

---

### 📈 Campaign Performance Dashboard Components

#### Task 5: Create CampaignPerformanceDashboard Component
**Priority**: High | **Estimated Time**: 4 hours
**File**: `app/dashboard/marketing/components/CampaignPerformanceDashboard.tsx`

**Features**:
- Main container for campaign performance analytics
- Fetches data from `/api/campaigns/[id]/performance`
- ROI metrics display
- Conversion tracking
- Daily performance trends
- Device/location breakdowns
- Date range selector
- Export functionality

**Mautic Patterns**:
- Campaign-level aggregation display
- ROI visualization
- Performance trend charts
- Metric cards

**Props Interface**:
```typescript
interface CampaignPerformanceDashboardProps {
  campaignId: string
  startDate?: string
  endDate?: string
  onDateRangeChange?: (start: string, end: string) => void
}
```

---

#### Task 6: Create ROIMetricsCard Component
**Priority**: High | **Estimated Time**: 2 hours
**File**: `app/dashboard/marketing/components/ROIMetricsCard.tsx`

**Features**:
- Campaign cost display
- Revenue display
- ROI percentage with trend indicator
- Cost per conversion
- Revenue per email
- Conversion count and rate
- Visual indicators (positive/negative ROI)
- Currency formatting

**Mautic Patterns**:
- Metric card layout
- Trend indicators
- Color-coded values (green for positive, red for negative)

**Props Interface**:
```typescript
interface ROIMetricsCardProps {
  roiData: {
    campaign_cost: number
    revenue: number
    roi_percentage: number
    cost_per_conversion: number
    revenue_per_email: number
    conversions: number
    conversion_rate: number
  }
  currency?: string
}
```

---

#### Task 7: Create CampaignPerformanceChart Component
**Priority**: Medium | **Estimated Time**: 3 hours
**File**: `app/dashboard/marketing/components/CampaignPerformanceChart.tsx`

**Features**:
- Time-series chart showing campaign performance
- Multiple metrics (sent, delivered, opened, clicked, conversions)
- ROI overlay (secondary Y-axis)
- Date range selection
- Interactive tooltips
- Legend for all metrics
- Responsive design

**Mautic Patterns**:
- Multi-line time-series chart
- Dual-axis support for ROI
- Performance trend visualization

**Props Interface**:
```typescript
interface CampaignPerformanceChartProps {
  dailyPerformance: Array<{
    report_date: string
    emails_sent: number
    emails_delivered: number
    emails_opened: number
    emails_clicked: number
    conversions: number
    revenue?: number
    roi_percentage?: number
  }>
  showROI?: boolean
  height?: number
}
```

---

### 📧 Template Performance Dashboard Components

#### Task 8: Create TemplatePerformanceDashboard Component
**Priority**: Medium | **Estimated Time**: 3 hours
**File**: `app/dashboard/marketing/components/TemplatePerformanceDashboard.tsx`

**Features**:
- Main container for template performance analytics
- Fetches data from `/api/email/analytics/templates`
- Template list with performance summary
- Individual template detail view
- Usage statistics
- Performance trends
- Template comparison view
- Filter and search functionality

**Mautic Patterns**:
- Template-level performance tracking
- Usage statistics display
- Performance comparison

**Props Interface**:
```typescript
interface TemplatePerformanceDashboardProps {
  templateId?: string
  startDate?: string
  endDate?: string
  showAll?: boolean
}
```

---

#### Task 9: Create TemplatePerformanceCard Component
**Priority**: Medium | **Estimated Time**: 2 hours
**File**: `app/dashboard/marketing/components/TemplatePerformanceCard.tsx`

**Features**:
- Individual template performance display
- Sent/Delivered/Opened/Clicked metrics
- Rate calculations
- Usage count (campaigns using template)
- Last used date
- Performance trend indicator
- Click to view details

**Mautic Patterns**:
- Card-based layout
- Metric display
- Usage tracking

**Props Interface**:
```typescript
interface TemplatePerformanceCardProps {
  template: {
    id: string
    title: string
    category?: string
    performance: {
      total_sent: number
      total_delivered: number
      total_opened: number
      total_clicked: number
      open_rate: number
      click_rate: number
    }
    campaigns_used?: number
    last_used_at?: string
  }
  onClick?: () => void
}
```

---

#### Task 10: Create TemplateComparisonView Component
**Priority**: Medium | **Estimated Time**: 3 hours
**File**: `app/dashboard/marketing/components/TemplateComparisonView.tsx`

**Features**:
- Side-by-side template comparison
- Performance ranking
- Best performer highlighting
- Metric comparison table
- Visual comparison charts
- Filter by category
- Sort by performance metrics

**Mautic Patterns**:
- Comparison table layout
- Ranking display
- Best performer indicators

**Props Interface**:
```typescript
interface TemplateComparisonViewProps {
  templates: Array<{
    id: string
    title: string
    performance: {
      open_rate: number
      click_rate: number
      total_sent: number
    }
  }>
  sortBy?: 'open_rate' | 'click_rate' | 'total_sent'
  limit?: number
}
```

---

### 🔄 Comparative Analytics Dashboard Components

#### Task 11: Create ComparativeAnalyticsDashboard Component
**Priority**: High | **Estimated Time**: 4 hours
**File**: `app/dashboard/marketing/components/ComparativeAnalyticsDashboard.tsx`

**Features**:
- Main container for comparative analytics
- Fetches data from `/api/email/analytics/compare`
- Comparison type selector (campaigns/templates/mailboxes/time_periods)
- Entity selector (multi-select)
- Date range selector
- Metric selector
- Comparison results display
- Difference calculations
- Best performer identification

**Mautic Patterns**:
- Side-by-side comparison layout
- Multi-dimensional analysis
- Difference visualization

**Props Interface**:
```typescript
interface ComparativeAnalyticsDashboardProps {
  comparisonType?: 'campaigns' | 'templates' | 'mailboxes' | 'time_periods'
  defaultMetric?: 'open_rate' | 'click_rate' | 'reply_rate'
  onComparisonChange?: (comparison: any) => void
}
```

---

#### Task 12: Create ComparisonSelector Component
**Priority**: High | **Estimated Time**: 3 hours
**File**: `app/dashboard/marketing/components/ComparisonSelector.tsx`

**Features**:
- Comparison type dropdown (campaigns/templates/mailboxes/time_periods)
- Entity multi-select dropdown
- Date range picker
- Metric selector dropdown
- Apply comparison button
- Reset button
- Validation (minimum 2 entities)
- Loading states

**Mautic Patterns**:
- Filter/selector UI patterns
- Multi-select functionality

**Props Interface**:
```typescript
interface ComparisonSelectorProps {
  comparisonType: 'campaigns' | 'templates' | 'mailboxes' | 'time_periods'
  availableEntities: Array<{ id: string; name: string }>
  selectedEntities: string[]
  onTypeChange: (type: string) => void
  onEntitiesChange: (ids: string[]) => void
  onDateRangeChange: (start: string, end: string) => void
  onMetricChange: (metric: string) => void
  onApply: () => void
  loading?: boolean
}
```

---

#### Task 13: Create ComparisonTable Component
**Priority**: High | **Estimated Time**: 3 hours
**File**: `app/dashboard/marketing/components/ComparisonTable.tsx`

**Features**:
- Side-by-side comparison table
- Entity names and types
- All metrics (sent, delivered, opened, clicked, replied, rates)
- Difference calculations (absolute and percentage)
- Best performer highlighting
- Sortable columns
- Responsive table design
- Export to CSV

**Mautic Patterns**:
- Comparison table layout
- Difference indicators
- Best performer badges

**Props Interface**:
```typescript
interface ComparisonTableProps {
  comparisons: Array<{
    id: string
    name: string
    type: string
    metrics: {
      sent: number
      delivered: number
      opened: number
      clicked: number
      replied: number
      open_rate: number
      click_rate: number
      reply_rate: number
    }
    difference?: number
    difference_percent?: number
    is_best: boolean
  }>
  metric: string
  onSort?: (column: string) => void
}
```

---

#### Task 14: Create ComparisonChart Component
**Priority**: Medium | **Estimated Time**: 3 hours
**File**: `app/dashboard/marketing/components/ComparisonChart.tsx`

**Features**:
- Multi-series bar/line chart
- Color-coded series per entity
- Selected metric visualization
- Interactive tooltips
- Legend with entity names
- Best performer highlighting
- Responsive design

**Mautic Patterns**:
- Multi-series chart visualization
- Color coding
- Interactive tooltips

**Props Interface**:
```typescript
interface ComparisonChartProps {
  comparisons: Array<{
    id: string
    name: string
    metrics: {
      [key: string]: number
    }
    is_best: boolean
  }>
  metric: string
  chartType?: 'bar' | 'line'
  height?: number
}
```

---

### 🔗 Integration & Enhancement

#### Task 15: Integrate Components into EmailAnalyticsDashboard
**Priority**: High | **Estimated Time**: 3 hours
**File**: `app/dashboard/marketing/components/EmailAnalyticsDashboard.tsx`

**Features**:
- Add tabbed navigation for different analytics views
- Integrate A/B Testing Dashboard
- Integrate Campaign Performance Dashboard
- Integrate Template Performance Dashboard
- Integrate Comparative Analytics Dashboard
- Maintain existing components (Device, Location, Health, Heatmap)
- Unified date range and filter controls
- Smooth transitions between views

**Implementation**:
- Add tab navigation component
- Create sections for each dashboard type
- Share common state (date range, mailbox filter)
- Maintain real-time updates across all views

---

#### Task 16: Add Real-time Updates for New Components
**Priority**: Medium | **Estimated Time**: 2 hours
**Files**: All new dashboard components

**Features**:
- Extend Supabase Realtime subscriptions
- Subscribe to `email_variants` table changes
- Subscribe to `variant_performance` table changes
- Subscribe to `campaign_performance` table changes
- Subscribe to `template_performance` table changes
- Auto-refresh components on data changes
- Toggle real-time updates on/off
- User-scoped subscriptions for security

**Implementation**:
- Use existing real-time pattern from EmailAnalyticsDashboard
- Add subscriptions in each component's useEffect
- Clean up subscriptions on unmount
- Handle connection errors gracefully

---

### 🎨 Design & UX

#### Task 17: Implement Mobile-Responsive Design
**Priority**: High | **Estimated Time**: 4 hours
**Files**: All new components

**Features**:
- Mobile-first TailwindCSS approach
- Responsive breakpoints (sm, md, lg, xl)
- Stack components vertically on mobile
- Horizontal scroll for tables on mobile
- Touch-friendly interactive elements
- Collapsible sections on mobile
- Optimized chart sizes for mobile

**Implementation**:
- Use TailwindCSS responsive utilities
- Test on multiple screen sizes
- Ensure charts are readable on mobile
- Optimize table layouts for small screens

---

#### Task 18: Add Loading States and Error Handling
**Priority**: High | **Estimated Time**: 3 hours
**Files**: All new components

**Features**:
- Loading skeletons for all components
- Error boundaries for graceful error handling
- Empty states when no data available
- Retry mechanisms for failed requests
- User-friendly error messages
- Loading indicators during data fetches

**Implementation**:
- Create reusable LoadingSkeleton component
- Create ErrorBoundary wrapper
- Create EmptyState component
- Add try-catch blocks in data fetching
- Display appropriate messages

---

#### Task 19: Add Interactive Features
**Priority**: Medium | **Estimated Time**: 3 hours
**Files**: All new components

**Features**:
- Date range pickers (react-datepicker or similar)
- Metric selector dropdowns
- Filter dropdowns (mailbox, campaign, template)
- Export buttons (CSV, JSON, PDF)
- Refresh buttons
- Print functionality
- Share links with filters

**Implementation**:
- Use date picker library
- Create reusable Select components
- Implement export functions
- Add print styles
- Generate shareable URLs

---

### 📝 Documentation

#### Task 20: Create Phase 5 Implementation Summary
**Priority**: Medium | **Estimated Time**: 1 hour
**File**: `PHASE_5_IMPLEMENTATION_SUMMARY.md`

**Content**:
- Overview of Phase 5 implementation
- List of all created components
- Integration points
- Mautic patterns followed
- Usage examples
- Props documentation
- Testing recommendations
- Next steps

---

## Implementation Order

### Phase 5A: A/B Testing Dashboard (Tasks 1-4)
1. Research Mautic patterns
2. Create ABTestingDashboard
3. Create VariantPerformanceCard
4. Create VariantComparisonChart

### Phase 5B: Campaign Performance Dashboard (Tasks 5-7)
5. Create CampaignPerformanceDashboard
6. Create ROIMetricsCard
7. Create CampaignPerformanceChart

### Phase 5C: Template Performance Dashboard (Tasks 8-10)
8. Create TemplatePerformanceDashboard
9. Create TemplatePerformanceCard
10. Create TemplateComparisonView

### Phase 5D: Comparative Analytics Dashboard (Tasks 11-14)
11. Create ComparativeAnalyticsDashboard
12. Create ComparisonSelector
13. Create ComparisonTable
14. Create ComparisonChart

### Phase 5E: Integration & Polish (Tasks 15-20)
15. Integrate into EmailAnalyticsDashboard
16. Add real-time updates
17. Implement mobile-responsive design
18. Add loading states and error handling
19. Add interactive features
20. Create implementation summary

## Success Criteria

✅ All dashboard components created and functional
✅ Mautic patterns followed for visualization
✅ Fully responsive mobile-first design
✅ Real-time updates working
✅ Error handling and loading states implemented
✅ Integrated into main EmailAnalyticsDashboard
✅ Documentation complete

## Estimated Total Time

**Total**: ~45-50 hours
- A/B Testing Dashboard: ~9 hours
- Campaign Performance Dashboard: ~9 hours
- Template Performance Dashboard: ~8 hours
- Comparative Analytics Dashboard: ~13 hours
- Integration & Polish: ~11 hours

## Dependencies

- Phase 4 APIs must be complete and tested
- Recharts library (already installed)
- Supabase Realtime (already configured)
- TailwindCSS (already configured)
- React hooks (useState, useEffect, useCallback)

## Notes

- All components should follow .cursorrules TypeScript and React best practices
- Use functional components with TypeScript interfaces
- Implement proper error handling and edge cases
- Ensure accessibility (ARIA labels, keyboard navigation)
- Follow mobile-first responsive design principles
- Use TailwindCSS for all styling
- Maintain consistency with existing dashboard components




