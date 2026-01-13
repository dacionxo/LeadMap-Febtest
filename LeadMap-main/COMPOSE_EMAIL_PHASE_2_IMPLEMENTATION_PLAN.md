# Compose Email System - Phase 2 Implementation Plan

**Document Version**: 1.0  
**Last Updated**: 2025  
**Status**: Phase 2 - Planning & Ready for Implementation  
**Based On**: Mautic patterns, .cursorrules guidelines, Context7 documentation

---

## 📋 Phase 2 Overview

Phase 2 focuses on implementing the core components and foundational infrastructure for the email composition system. This phase establishes the component architecture, state management, and basic functionality before adding the visual builder (GrapesJS) in Phase 3.

---

## ✅ Phase 2 Goals

1. Create TypeScript interfaces file with all type definitions
2. Implement enhanced ComposeEmail container component
3. Create modular sub-components (SettingsPanel, TemplateSelector, etc.)
4. Implement basic HTML editor (foundation for future GrapesJS integration)
5. Integrate with existing APIs and systems
6. Establish component structure for future enhancements

---

## 📁 File Structure to Create

```
app/dashboard/marketing/components/compose-email/
├── types.ts                          # TypeScript interfaces (Phase 1 definitions)
├── ComposeEmailEnhanced.tsx          # Enhanced container component
├── components/
│   ├── EmailComposerHeader.tsx      # Header with title and actions
│   ├── EmailComposerFooter.tsx      # Footer with Send/Save/Cancel
│   ├── EmailSettingsPanel.tsx       # Settings sidebar
│   ├── TemplateSelector.tsx         # Template selection component
│   ├── EmailEditorBasic.tsx         # Basic HTML editor (before GrapesJS)
│   └── EmailPreviewBasic.tsx        # Basic preview component
└── hooks/
    ├── useEmailComposition.ts       # Composition state management hook
    └── useEmailValidation.ts        # Validation logic hook
```

---

## 🏗️ Component Implementation Strategy

### 1. TypeScript Interfaces (types.ts)

**Location**: `app/dashboard/marketing/components/compose-email/types.ts`

**Content**: All interfaces from Phase 1 documentation:
- EmailComposition
- MailboxSelection
- EmailTemplateSelection
- EmailToken, TokenCategory, TokenContext
- DynamicContentFilter, DynamicContentVariant, DynamicContentBlock
- GrapesJSConfig, EmailBuilderState
- EmailPreviewConfig
- EmailScheduleConfig, EmailTrackingConfig
- EmailValidationError, EmailValidationResult
- All component props interfaces
- API response interfaces

**Pattern**: Follow .cursorrules - interfaces over types, no `any` types

---

### 2. ComposeEmailEnhanced Container Component

**Location**: `app/dashboard/marketing/components/compose-email/ComposeEmailEnhanced.tsx`

**Responsibilities**:
- Main container orchestrating all child components
- State management for email composition
- API integration (fetch mailboxes, templates, send emails)
- Error handling and validation
- Coordinate child component interactions

**State Structure**:
```typescript
const [composition, setComposition] = useState<EmailComposition>({
  mailboxId: '',
  to: [],
  subject: '',
  htmlContent: '<p>Hi There!</p>',
  editorMode: 'html', // Start with HTML, add builder later
  sendType: 'now',
  status: 'draft',
  // ... other fields
})

const [mailboxes, setMailboxes] = useState<MailboxSelection[]>([])
const [templates, setTemplates] = useState<EmailTemplateSelection[]>([])
const [validation, setValidation] = useState<EmailValidationResult>({ isValid: true, errors: [] })
const [saving, setSaving] = useState(false)
const [sending, setSending] = useState(false)
```

**Layout Structure**:
```tsx
<div className="space-y-6">
  <EmailComposerHeader />
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Left Sidebar */}
    <div className="lg:col-span-1">
      <EmailSettingsPanel />
      <TemplateSelector />
    </div>
    
    {/* Main Editor Area */}
    <div className="lg:col-span-2">
      <EmailEditorBasic />
      {/* Future: EmailBuilder will replace this */}
    </div>
  </div>
  <EmailComposerFooter />
</div>
```

**API Integration**:
- `GET /api/mailboxes` - Fetch mailboxes
- `GET /api/email-templates` - Fetch templates
- `POST /api/emails/send` - Send email
- Error handling with user-friendly messages

**Patterns**:
- Follow existing component patterns (ErrorBoundary, LoadingSkeleton)
- Use TailwindCSS for styling
- Dark mode support
- Accessibility (ARIA labels, keyboard navigation)
- Early returns for error conditions

---

### 3. EmailSettingsPanel Component

**Location**: `app/dashboard/marketing/components/compose-email/components/EmailSettingsPanel.tsx`

**Responsibilities**:
- Mailbox selection
- Sender name/email configuration
- Reply-to address
- Scheduling options (now/schedule)
- Tracking options (opens, clicks, UTM)
- Validation feedback

**Props**:
```typescript
interface EmailSettingsPanelProps {
  composition: EmailComposition
  mailboxes: MailboxSelection[]
  onCompositionChange: (updates: Partial<EmailComposition>) => void
  trackingConfig?: EmailTrackingConfig
  onTrackingConfigChange?: (config: EmailTrackingConfig) => void
  scheduleConfig?: EmailScheduleConfig
  onScheduleConfigChange?: (config: EmailScheduleConfig) => void
}
```

**Features**:
- Mailbox dropdown with provider info
- Sender name/email fields
- Reply-to toggle and input
- Schedule datetime picker
- Tracking toggles
- UTM parameter inputs
- Validation error display

**Patterns**:
- TailwindCSS styling
- Dark mode support
- Accessible form controls
- Clear visual hierarchy

---

### 4. TemplateSelector Component

**Location**: `app/dashboard/marketing/components/compose-email/components/TemplateSelector.tsx`

**Responsibilities**:
- Display available templates
- Template search/filter
- Template selection
- Load template into editor
- Preview template thumbnails (future)

**Props**:
```typescript
interface TemplateSelectorProps {
  templates: EmailTemplateSelection[]
  selectedTemplateId?: string
  onTemplateSelect: (template: EmailTemplateSelection | null) => void
  onTemplateLoad?: (template: EmailTemplateSelection) => void
  category?: string
}
```

**Features**:
- Template list/grid view
- Search functionality
- Category filter (if applicable)
- Select and load template
- Clear selection option

**Integration**:
- Use existing `/api/email-templates` endpoint
- Load template HTML/body into editor
- Update composition state with template content

---

### 5. EmailEditorBasic Component

**Location**: `app/dashboard/marketing/components/compose-email/components/EmailEditorBasic.tsx`

**Responsibilities**:
- Basic HTML textarea editor (temporary, until GrapesJS integration)
- Mode switching placeholder (builder/html/mjml)
- Content editing
- Token insertion support (future)

**Props**:
```typescript
interface EmailEditorProps {
  content: string
  mode: 'builder' | 'html' | 'mjml' | 'rich-text'
  onChange: (content: string) => void
  onModeChange?: (mode: 'builder' | 'html' | 'mjml' | 'rich-text') => void
}
```

**Features**:
- HTML textarea editor (Phase 2)
- Mode toggle UI (disabled until Phase 3)
- Content synchronization
- Font mono for HTML editing

**Future Enhancement** (Phase 3):
- Replace with EmailBuilder (GrapesJS wrapper)
- Add MJML editor
- Add rich text editor option

---

### 6. EmailComposerHeader Component

**Location**: `app/dashboard/marketing/components/compose-email/components/EmailComposerHeader.tsx`

**Responsibilities**:
- Page title and description
- Action buttons (Save Draft, Preview)
- Status indicators

**Features**:
- Title: "Compose Email"
- Description text
- Save Draft button (future API integration)
- Preview toggle button
- Status badge (draft/scheduled)

---

### 7. EmailComposerFooter Component

**Location**: `app/dashboard/marketing/components/compose-email/components/EmailComposerFooter.tsx`

**Responsibilities**:
- Send/Schedule button
- Cancel button
- Loading states
- Validation feedback

**Props**:
```typescript
interface EmailComposerFooterProps {
  onSend: () => Promise<void>
  onCancel?: () => void
  sending: boolean
  isValid: boolean
  validationErrors?: EmailValidationError[]
}
```

**Features**:
- Send Now button (primary action)
- Schedule button (when schedule mode)
- Cancel button
- Loading spinner during send
- Validation error summary
- Disabled state when invalid

---

### 8. Custom Hooks

#### useEmailComposition Hook

**Location**: `app/dashboard/marketing/components/compose-email/hooks/useEmailComposition.ts`

**Purpose**: Centralize composition state management logic

**Returns**:
```typescript
{
  composition: EmailComposition
  updateComposition: (updates: Partial<EmailComposition>) => void
  resetComposition: () => void
  validateComposition: () => EmailValidationResult
}
```

**Features**:
- State management
- Update helpers
- Reset functionality
- Validation logic

#### useEmailValidation Hook

**Location**: `app/dashboard/marketing/components/compose-email/hooks/useEmailValidation.ts`

**Purpose**: Email composition validation logic

**Returns**:
```typescript
{
  validate: (composition: EmailComposition) => EmailValidationResult
  errors: EmailValidationError[]
  warnings: EmailValidationError[]
  isValid: boolean
}
```

**Validation Rules**:
- Required fields: mailboxId, to, subject, htmlContent
- Email format validation for recipients
- Subject length validation
- HTML content validation (basic)

---

## 🔌 API Integration

### Existing Endpoints (Use As-Is)
1. `GET /api/mailboxes` - Fetch mailboxes ✅
2. `GET /api/email-templates` - Fetch templates ✅
3. `POST /api/emails/send` - Send email ✅

### API Request/Response Patterns

**Send Email**:
```typescript
POST /api/emails/send
Body: {
  mailboxId: string
  to: string[]
  subject: string
  html: string
  scheduleAt?: string
  // ... other fields
}
Response: {
  success: boolean
  messageId?: string
  error?: string
}
```

**Error Handling**:
- Try-catch blocks for all API calls
- User-friendly error messages
- Error logging for debugging
- Loading states during API calls

---

## ✅ Code Quality Standards

### TypeScript
- ✅ Interfaces over types (per .cursorrules)
- ✅ No `any` types (except where necessary)
- ✅ Proper type inference
- ✅ Type-safe API calls

### React
- ✅ Functional components with hooks
- ✅ Descriptive naming (handle* for event handlers)
- ✅ Early returns for error conditions
- ✅ Proper error handling with ErrorBoundary

### Styling
- ✅ TailwindCSS only (per .cursorrules)
- ✅ Dark mode support (dark: classes)
- ✅ Mobile-responsive (grid layout with lg: breakpoints)
- ✅ Accessible (ARIA labels, keyboard navigation)

### Error Handling
- ✅ Try-catch blocks for async operations
- ✅ User-friendly error messages
- ✅ ErrorBoundary for component errors
- ✅ Error logging with console.error

---

## 📝 Implementation Checklist

### Phase 2.1: Foundation
- [ ] Create `types.ts` with all TypeScript interfaces
- [ ] Create component directory structure
- [ ] Set up custom hooks directory

### Phase 2.2: Core Components
- [ ] Implement `useEmailComposition` hook
- [ ] Implement `useEmailValidation` hook
- [ ] Implement `EmailComposerHeader` component
- [ ] Implement `EmailComposerFooter` component
- [ ] Implement `EmailSettingsPanel` component
- [ ] Implement `TemplateSelector` component
- [ ] Implement `EmailEditorBasic` component

### Phase 2.3: Container Component
- [ ] Implement `ComposeEmailEnhanced` container
- [ ] Integrate all sub-components
- [ ] Implement state management
- [ ] Implement API integration
- [ ] Add error handling
- [ ] Add loading states

### Phase 2.4: Integration & Testing
- [ ] Integrate with existing EmailMarketing page
- [ ] Test mailbox selection
- [ ] Test template loading
- [ ] Test email sending
- [ ] Test validation
- [ ] Test error handling
- [ ] Test dark mode
- [ ] Test mobile responsiveness

---

## 🚀 Migration Strategy

### Option 1: Parallel Implementation
- Keep existing `ComposeEmail.tsx` as-is
- Create `ComposeEmailEnhanced.tsx` as new version
- Test new version thoroughly
- Replace old component once stable

### Option 2: Gradual Enhancement
- Enhance existing `ComposeEmail.tsx` incrementally
- Add new components gradually
- Maintain backward compatibility
- Migrate features one-by-one

**Recommendation**: Option 1 (Parallel Implementation) for cleaner separation and easier rollback.

---

## 📚 References

- **Phase 1 Summary**: `COMPOSE_EMAIL_PHASE_1_SUMMARY.md`
- **TODO List**: `COMPOSE_EMAIL_REVITALIZATION_TODO.md`
- **Mautic Reference**: `mautic-reference/plugins/GrapesJsBuilderBundle/`
- **Existing Components**: `app/dashboard/marketing/components/`
- **.cursorrules**: Coding guidelines and standards

---

## 🔄 Next Steps After Phase 2

1. **Phase 3**: GrapesJS Integration
   - Install GrapesJS packages
   - Create EmailBuilder component
   - Replace EmailEditorBasic with EmailBuilder
   - Configure blocks and plugins

2. **Phase 4**: Advanced Features
   - Token system implementation
   - Preview system enhancement
   - Dynamic content (future)
   - A/B testing integration

---

**Status**: Ready for Implementation  
**Priority**: High - Foundation for all future enhancements  
**Estimated Effort**: 2-3 days for complete Phase 2 implementation

