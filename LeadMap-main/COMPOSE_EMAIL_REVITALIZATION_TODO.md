# Compose Email System Revitalization - World-Class To-Do List

## 🎯 Objective
Revitalize the compose email system on `/dashboard/marketing` page utilizing Mautic patterns, Context7 documentation, and .cursorrules guidelines to create a world-class email composition experience.

---

## 📋 Phase 1: Foundation & Architecture

### 1.1 Component Structure & Organization
- [ ] **Analyze current ComposeEmail.tsx component** - Review existing implementation
- [ ] **Design new component architecture** - Plan modular, reusable components
- [ ] **Create component hierarchy**:
  - [ ] `ComposeEmail.tsx` (Main container)
  - [ ] `EmailEditor.tsx` (Rich text/visual editor)
  - [ ] `EmailBuilder.tsx` (Drag-and-drop builder - Mautic-inspired)
  - [ ] `EmailComposerSidebar.tsx` (Settings, templates, tokens)
  - [ ] `EmailPreview.tsx` (Live preview with device views)
  - [ ] `EmailSettingsPanel.tsx` (Sender, scheduling, tracking)
  - [ ] `TemplateSelector.tsx` (Template browser and selection)
  - [ ] `TokenSelector.tsx` (Personalization tokens - Mautic pattern)
- [ ] **Define TypeScript interfaces** - Following .cursorrules (interfaces over types)
- [ ] **Set up component state management** - useState/useReducer patterns

### 1.2 Mautic Pattern Research & Integration
- [ ] **Research Mautic email builder patterns**:
  - [ ] GrapesJS integration for visual builder
  - [ ] MJML support for responsive emails
  - [ ] Template system architecture
  - [ ] Token/personalization system
  - [ ] Dynamic content filters
- [ ] **Review Mautic reference code**:
  - [ ] `mautic-reference/plugins/GrapesJsBuilderBundle/`
  - [ ] `mautic-reference/app/bundles/EmailBundle/`
- [ ] **Document Mautic patterns to adopt**:
  - [ ] Email builder architecture
  - [ ] Template loading and management
  - [ ] Token replacement system
  - [ ] Dynamic content filtering
  - [ ] Preview generation

### 1.3 Technology Stack Selection
- [ ] **Evaluate email builder options**:
  - [ ] GrapesJS (Mautic's choice) - visual drag-and-drop
  - [ ] React Email - modern React-based email components
  - [ ] Unlayer - commercial email builder
  - [ ] MJML - responsive email framework
- [ ] **Choose rich text editor** (if not using full builder):
  - [ ] React Quill
  - [ ] Draft.js
  - [ ] Slate
  - [ ] Tiptap (recommended for modern React)
- [ ] **Decide on MJML support** - Mautic uses MJML for responsive emails
- [ ] **Plan dependency integration** - Update package.json

---

## 📋 Phase 2: Visual Email Builder (Mautic-Inspired)

### 2.1 GrapesJS Integration (Following Mautic Pattern)
- [ ] **Install and configure GrapesJS**:
  - [ ] Add `grapesjs` package
  - [ ] Add `grapesjs-preset-newsletter` or custom preset
  - [ ] Add `grapesjs-mjml` for MJML support
  - [ ] Configure plugins and blocks
- [ ] **Create EmailBuilder component**:
  - [ ] Initialize GrapesJS editor
  - [ ] Configure email-specific blocks (header, footer, text, image, button, etc.)
  - [ ] Set up responsive canvas
  - [ ] Configure storage/export (HTML, MJML)
- [ ] **Implement block library**:
  - [ ] Header block (logo, navigation)
  - [ ] Text blocks (paragraph, heading, quote)
  - [ ] Image block (with alt text, link support)
  - [ ] Button/CTA block
  - [ ] Divider/Spacer block
  - [ ] Social media block
  - [ ] Footer block
  - [ ] Custom blocks for LeadMap features
- [ ] **Style editor interface**:
  - [ ] TailwindCSS styling per .cursorrules
  - [ ] Dark mode support
  - [ ] Mobile-responsive builder interface
  - [ ] Accessible controls (keyboard navigation, ARIA labels)

### 2.2 Template System Integration
- [ ] **Template selection UI**:
  - [ ] Template browser/gallery
  - [ ] Template categories/folders
  - [ ] Template preview thumbnails
  - [ ] Template search and filtering
- [ ] **Template loading**:
  - [ ] Load template HTML/MJML
  - [ ] Inject into GrapesJS editor
  - [ ] Preserve template structure
  - [ ] Allow template customization
- [ ] **Template saving**:
  - [ ] Save as new template option
  - [ ] Update existing template
  - [ ] Template versioning (if applicable)
- [ ] **Integration with existing template system**:
  - [ ] Use existing `EmailTemplates.tsx` component
  - [ ] Connect to `/api/email-templates` endpoints
  - [ ] Support template folders/categories

### 2.3 MJML Support (Mautic Standard)
- [ ] **MJML integration**:
  - [ ] Install `mjml` and `mjml-react` packages
  - [ ] Add MJML parser/compiler
  - [ ] Convert MJML to HTML for sending
  - [ ] Support MJML templates
- [ ] **MJML builder mode**:
  - [ ] Option to edit in MJML code view
  - [ ] Sync between visual and MJML views
  - [ ] Validate MJML syntax
- [ ] **Responsive email generation**:
  - [ ] Compile MJML to responsive HTML
  - [ ] Test across email clients
  - [ ] Fallback for unsupported clients

---

## 📋 Phase 3: Personalization & Tokens (Mautic Pattern)

### 3.1 Token System Implementation
- [ ] **Design token architecture**:
  - [ ] Token format: `{contactfield=firstname}` (Mautic pattern)
  - [ ] Token categories (contact, campaign, email, custom)
  - [ ] Token validation and replacement
- [ ] **Create TokenSelector component**:
  - [ ] Token browser with categories
  - [ ] Search/filter tokens
  - [ ] Insert token into editor
  - [ ] Token preview/tooltip
- [ ] **Token categories** (Mautic-inspired):
  - [ ] Contact tokens: `{contactfield=firstname}`, `{contactfield=email}`, etc.
  - [ ] Campaign tokens: `{campaignfield=name}`, `{campaignfield=description}`
  - [ ] Email tokens: `{emailfield=subject}`, `{emailfield=fromname}`
  - [ ] Date/time tokens: `{date}`, `{time}`, `{datetime}`
  - [ ] Custom tokens (user-defined)
- [ ] **Token replacement service**:
  - [ ] Server-side token replacement (before sending)
  - [ ] Client-side preview replacement
  - [ ] Token validation
  - [ ] Error handling for missing tokens

### 3.2 Dynamic Content (Mautic Feature)
- [ ] **Dynamic content filters**:
  - [ ] Design filter system (contact attributes, behavior, segments)
  - [ ] Create DynamicContent component
  - [ ] Filter builder UI
  - [ ] Multiple content variants per token
- [ ] **Dynamic content blocks**:
  - [ ] Add dynamic content block to builder
  - [ ] Configure default content
  - [ ] Add filter-based variants
  - [ ] Preview dynamic content
- [ ] **Integration with segments**:
  - [ ] Use segment data for filtering
  - [ ] Real-time segment updates
  - [ ] Segment-based content variants

---

## 📋 Phase 4: Email Settings & Configuration

### 4.1 Sender Configuration
- [ ] **Sender settings panel**:
  - [ ] Mailbox selector (existing functionality)
  - [ ] Sender name field
  - [ ] Sender email field (from selected mailbox)
  - [ ] Reply-to address configuration
  - [ ] From name customization
- [ ] **Mailbox validation**:
  - [ ] Check mailbox active status
  - [ ] Validate sender email format
  - [ ] Display mailbox provider info
  - [ ] Handle mailbox errors gracefully

### 4.2 Scheduling & Send Options
- [ ] **Send type options** (Mautic-inspired):
  - [ ] Send Now
  - [ ] Schedule (date/time picker)
  - [ ] Batch Schedule (send in batches)
  - [ ] RSS Schedule (automatically from RSS)
  - [ ] Smart Send (AI-optimized timing)
- [ ] **Scheduling UI**:
  - [ ] Date/time picker (accessible, keyboard navigation)
  - [ ] Timezone handling
  - [ ] Schedule preview
  - [ ] Edit/cancel scheduled emails
- [ ] **Batch scheduling**:
  - [ ] Configure batch size
  - [ ] Set batch intervals
  - [ ] Preview batch schedule

### 4.3 Tracking & Analytics
- [ ] **Tracking options**:
  - [ ] Click tracking toggle
  - [ ] Open tracking toggle
  - [ ] UTM parameter tracking
  - [ ] Link tracking (trigger links integration)
- [ ] **UTM tracking configuration**:
  - [ ] UTM source, medium, campaign fields
  - [ ] Auto-generate UTM parameters
  - [ ] Custom UTM tags
  - [ ] Preview UTM-tagged URLs
- [ ] **Integration with analytics**:
  - [ ] Connect to email analytics system
  - [ ] Preview tracking capabilities
  - [ ] Link to analytics dashboard

---

## 📋 Phase 5: Preview & Testing

### 5.1 Email Preview System
- [ ] **Multi-device preview**:
  - [ ] Desktop preview (desktop email client view)
  - [ ] Mobile preview (mobile email client view)
  - [ ] Tablet preview
  - [ ] Dark mode preview
- [ ] **Email client preview**:
  - [ ] Gmail preview
  - [ ] Outlook preview
  - [ ] Apple Mail preview
  - [ ] Mobile email client previews
- [ ] **Live preview**:
  - [ ] Real-time preview as user edits
  - [ ] Token replacement in preview
  - [ ] Responsive preview updates
  - [ ] Preview with sample data

### 5.2 Testing Features
- [ ] **Test email functionality**:
  - [ ] Send test email button
  - [ ] Test email recipient selector
  - [ ] Multiple test recipients
  - [ ] Test email tracking
- [ ] **Spam score checker**:
  - [ ] Integrate spam scoring (existing functionality)
  - [ ] Display spam score in UI
  - [ ] Spam score warnings/recommendations
  - [ ] Improve spam score suggestions
- [ ] **Email validation**:
  - [ ] HTML validation
  - [ ] Link validation
  - [ ] Image validation
  - [ ] Accessibility validation
  - [ ] Email client compatibility warnings

---

## 📋 Phase 6: Advanced Features (Mautic-Inspired)

### 6.1 A/B Testing Integration
- [ ] **A/B test creation from composer**:
  - [ ] Create variant button
  - [ ] Variant type selection (subject, content, from)
  - [ ] Variant editor
  - [ ] Test configuration (sample size, duration, winner criteria)
- [ ] **Integration with ABTestingDashboard**:
  - [ ] Link to A/B test dashboard
  - [ ] View test results
  - [ ] Declare winner functionality

### 6.2 Content Blocks & Snippets
- [ ] **Snippets integration**:
  - [ ] Insert snippet button
  - [ ] Snippet browser
  - [ ] Snippet search
  - [ ] Snippet preview
- [ ] **Reusable content blocks**:
  - [ ] Save selection as block
  - [ ] Block library
  - [ ] Block categories
  - [ ] Block versioning

### 6.3 Trigger Links Integration
- [ ] **Trigger link creation**:
  - [ ] Create trigger link from email
  - [ ] Link action configuration
  - [ ] Preview trigger link behavior
- [ ] **Trigger link insertion**:
  - [ ] Insert trigger link button
  - [ ] Link action selector
  - [ ] Link preview

---

## 📋 Phase 7: User Experience & Accessibility

### 7.1 UI/UX Improvements
- [ ] **Modern, intuitive interface**:
  - [ ] Clean, uncluttered design
  - [ ] Clear visual hierarchy
  - [ ] Intuitive navigation
  - [ ] Helpful tooltips and hints
- [ ] **Responsive design**:
  - [ ] Mobile-friendly composer
  - [ ] Tablet optimization
  - [ ] Touch-friendly controls
- [ ] **Loading states**:
  - [ ] Skeleton loaders (use existing LoadingSkeleton component)
  - [ ] Progress indicators
  - [ ] Optimistic UI updates
- [ ] **Error handling**:
  - [ ] User-friendly error messages
  - [ ] Error recovery options
  - [ ] Validation feedback
  - [ ] Use ErrorBoundary component

### 7.2 Accessibility (Per .cursorrules)
- [ ] **Keyboard navigation**:
  - [ ] Full keyboard support
  - [ ] Tab order optimization
  - [ ] Keyboard shortcuts
  - [ ] Focus indicators
- [ ] **Screen reader support**:
  - [ ] ARIA labels on all interactive elements
  - [ ] ARIA descriptions for complex UI
  - [ ] Live regions for dynamic content
  - [ ] Semantic HTML structure
- [ ] **Visual accessibility**:
  - [ ] Sufficient color contrast
  - [ ] Focus indicators
  - [ ] Text scaling support
  - [ ] High contrast mode support

### 7.3 Performance Optimization
- [ ] **Code splitting**:
  - [ ] Lazy load email builder
  - [ ] Lazy load preview
  - [ ] Dynamic imports for heavy components
- [ ] **Optimization**:
  - [ ] Memoization (React.memo, useMemo, useCallback)
  - [ ] Debounce preview updates
  - [ ] Virtual scrolling for large lists
  - [ ] Image optimization
- [ ] **Caching**:
  - [ ] Cache templates
  - [ ] Cache mailbox list
  - [ ] Cache token definitions
  - [ ] Browser storage for drafts

---

## 📋 Phase 8: Integration & APIs

### 8.1 API Integration
- [ ] **Email sending API**:
  - [ ] Integrate with `/api/emails/send`
  - [ ] Handle API errors gracefully
  - [ ] Progress tracking for large sends
  - [ ] Success/error feedback
- [ ] **Template API integration**:
  - [ ] Load templates from `/api/email-templates`
  - [ ] Save templates
  - [ ] Template CRUD operations
- [ ] **Campaign API integration**:
  - [ ] Save as campaign option
  - [ ] Link to campaign builder
  - [ ] Campaign performance tracking
- [ ] **Draft saving**:
  - [ ] Auto-save drafts
  - [ ] Manual save draft
  - [ ] Load saved drafts
  - [ ] Draft versioning

### 8.2 Real-time Features
- [ ] **Real-time collaboration** (optional):
  - [ ] Multi-user editing
  - [ ] Cursor positions
  - [ ] Change tracking
  - [ ] Comments/annotations
- [ ] **Real-time preview**:
  - [ ] Live HTML updates
  - [ ] Real-time token replacement
  - [ ] Instant validation feedback

---

## 📋 Phase 9: Code Quality & Documentation

### 9.1 Code Quality (Per .cursorrules)
- [ ] **TypeScript**:
  - [ ] All components typed with interfaces
  - [ ] No `any` types (except where necessary)
  - [ ] Proper type inference
  - [ ] Type-safe API calls
- [ ] **Error handling**:
  - [ ] Try-catch blocks for async operations
  - [ ] Error boundaries
  - [ ] User-friendly error messages
  - [ ] Error logging
- [ ] **Code organization**:
  - [ ] Modular components
  - [ ] Reusable utilities
  - [ ] Clear file structure
  - [ ] Consistent naming conventions
- [ ] **Testing** (if applicable):
  - [ ] Unit tests for utilities
  - [ ] Component tests
  - [ ] Integration tests
  - [ ] E2E tests for critical flows

### 9.2 Documentation
- [ ] **Component documentation**:
  - [ ] JSDoc comments
  - [ ] Prop type documentation
  - [ ] Usage examples
  - [ ] Component stories (Storybook if applicable)
- [ ] **User documentation**:
  - [ ] User guide for email composer
  - [ ] Template creation guide
  - [ ] Token usage guide
  - [ ] Video tutorials (optional)

---

## 📋 Phase 10: Deployment & Monitoring

### 10.1 Deployment
- [ ] **Build optimization**:
  - [ ] Verify production build
  - [ ] Check bundle sizes
  - [ ] Optimize dependencies
- [ ] **Feature flags** (if needed):
  - [ ] Gradual rollout
  - [ ] A/B testing new features
  - [ ] Rollback capability

### 10.2 Monitoring & Analytics
- [ ] **Usage analytics**:
  - [ ] Track composer usage
  - [ ] Feature adoption metrics
  - [ ] Error tracking
- [ ] **Performance monitoring**:
  - [ ] Load time metrics
  - [ ] User interaction tracking
  - [ ] Error rates

---

## 🎨 Design Principles (Following .cursorrules)

### Visual Design
- ✅ Use TailwindCSS for all styling
- ✅ Dark mode support
- ✅ Mobile-responsive design
- ✅ Consistent spacing and typography
- ✅ Accessible color contrast

### Code Standards
- ✅ TypeScript interfaces (not types) for object shapes
- ✅ Functional components with hooks
- ✅ Descriptive naming (handle* for event handlers)
- ✅ Early returns for error conditions
- ✅ Guard clauses for validation
- ✅ Proper error handling and logging

### Mautic Patterns to Follow
- ✅ GrapesJS for visual email builder
- ✅ MJML for responsive emails
- ✅ Token system: `{contactfield=fieldname}`
- ✅ Dynamic content filters
- ✅ Template system with folders
- ✅ A/B testing integration
- ✅ Preview with device views

---

## 📊 Success Metrics

### Functional Requirements
- [ ] Users can compose emails using visual builder
- [ ] Users can compose emails using code/HTML editor
- [ ] Templates can be loaded and customized
- [ ] Tokens can be inserted and replaced
- [ ] Emails can be previewed on multiple devices
- [ ] Emails can be sent immediately or scheduled
- [ ] Emails integrate with tracking and analytics

### Quality Requirements
- [ ] All TypeScript errors resolved
- [ ] All accessibility requirements met
- [ ] Mobile-responsive design
- [ ] Performance: < 3s initial load
- [ ] Error handling for all edge cases
- [ ] User-friendly error messages

### User Experience Requirements
- [ ] Intuitive interface (no training required)
- [ ] Clear visual feedback
- [ ] Helpful tooltips and guidance
- [ ] Fast, responsive interactions
- [ ] Professional, modern design

---

## 🔄 Iteration Plan

### Sprint 1: Foundation (Week 1-2)
- Phase 1: Foundation & Architecture
- Phase 2.1: GrapesJS Integration (basic setup)

### Sprint 2: Builder & Templates (Week 3-4)
- Phase 2: Visual Email Builder
- Phase 2.2: Template System Integration
- Phase 5.1: Basic Preview

### Sprint 3: Features (Week 5-6)
- Phase 3: Personalization & Tokens
- Phase 4: Email Settings & Configuration
- Phase 6.1: A/B Testing Integration

### Sprint 4: Polish & Integration (Week 7-8)
- Phase 7: User Experience & Accessibility
- Phase 8: Integration & APIs
- Phase 9: Code Quality & Documentation
- Phase 10: Deployment & Monitoring

---

## 📝 Notes

- **Priority**: Focus on visual builder and template system first (highest user value)
- **Dependencies**: Review existing email template API and campaign builder for integration points
- **Mautic Reference**: Use `mautic-reference/` directory for pattern research
- **Context7**: Use Context7 MCP tools for library documentation (GrapesJS, MJML, React Email)
- **.cursorrules**: Follow all coding guidelines, especially TypeScript interfaces, error handling, and accessibility

---

**Document Version**: 1.0  
**Last Updated**: 2025  
**Status**: Planning Phase  
**Next Steps**: Review with team, prioritize features, begin Sprint 1

