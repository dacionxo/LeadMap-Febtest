# Compose Email System - User Guide

**Version**: 1.0  
**Last Updated**: 2025  
**Status**: Complete

---

## 📧 Overview

The Compose Email system provides a comprehensive email composition interface with visual builder, templates, personalization tokens, A/B testing, and more. This guide will help you create professional emails efficiently.

---

## 🚀 Getting Started

### Accessing the Composer

1. Navigate to **Marketing** → **Compose Email**
2. The composer opens with default settings
3. Start by selecting a mailbox (sender) and entering recipients

### Basic Email Composition

1. **To Field**: Enter recipient email addresses (comma-separated)
2. **Subject**: Enter your email subject line
3. **Preview Text**: Optional preview text shown in email clients
4. **Content**: Use the visual builder or HTML editor to create your email

---

## 🎨 Editor Modes

### Visual Builder (Recommended)
- **Drag-and-drop** interface for easy email creation
- Pre-built blocks (header, text, images, buttons, etc.)
- Real-time preview
- Accessible via the "Builder" button

### HTML Editor
- Direct HTML editing
- Syntax highlighting
- Token insertion support
- Accessible via the "HTML" button

### Switching Modes
- Click mode buttons in the editor header
- Content is preserved when switching
- Visual builder content converts to HTML automatically

---

## 🎯 Key Features

### 1. Email Preview
- Click **Preview** button to see how your email looks
- Switch between Desktop, Tablet, and Mobile views
- Preview in different email clients (Gmail, Outlook, Apple Mail)
- Fullscreen mode for detailed viewing

### 2. Email Validation
- Click **Validate** button to check your email
- Shows errors (blocking), warnings, and recommendations
- Real-time validation as you type
- Error count badge on validation button

### 3. Templates
- Browse and select from email templates
- Templates pre-populate subject and content
- Organized by categories
- Search and filter templates

### 4. Personalization Tokens
- Click **Show Personalization Tokens** to open token selector
- Insert contact fields: `{contactfield=firstname}`
- Insert campaign fields: `{campaignfield=name}`
- Insert date/time tokens: `{date}`, `{time}`, `{datetime}`
- Tokens are replaced when email is sent

### 5. Trigger Links
- Click **Trigger Link** button to insert tracking links
- Links track clicks and can execute actions
- Search and filter available trigger links
- Preview link URLs before insertion

### 6. Draft Management
- **Auto-save**: Drafts save automatically every 3 seconds
- **Manual Save**: Click save button or press `Ctrl+S`
- **Load Draft**: Click **Load Draft** to browse and load saved drafts
- Drafts include all composition data (subject, content, settings)

### 7. A/B Testing
- Click **A/B Test** button to create variants
- Test subject lines, content, or from name
- Configure winner criteria (open rate, click rate, reply rate)
- Set minimum sample size and confidence level

### 8. Campaign Integration
- Click **Campaign** button to link email to a campaign
- Select existing campaign or create new one
- Campaign status indicators
- Search campaigns

### 9. Test Email
- Open preview modal
- Enter test recipient email
- Click **Send Test** to send test email
- Test emails are prefixed with `[TEST]`

---

## ⌨️ Keyboard Shortcuts

- **Ctrl+S**: Save draft
- **Ctrl+Enter**: Send email
- **Escape**: Cancel/close modals

---

## 📝 Best Practices

### Email Content
1. **Use table-based layouts** for better email client compatibility
2. **Use inline styles** instead of external CSS
3. **Add alt text** to all images for accessibility
4. **Use absolute URLs** for images and links
5. **Keep subject lines** under 50 characters
6. **Test in multiple email clients** before sending

### Personalization
1. **Use tokens** for dynamic content
2. **Test token replacement** with preview
3. **Provide fallback values** for optional tokens

### A/B Testing
1. **Test one variable at a time** for clear results
2. **Use sufficient sample size** (minimum 100 recipients)
3. **Wait for statistical significance** before declaring winner
4. **Document test results** for future reference

---

## 🔧 Advanced Features

### Email Settings Panel
- **Tracking**: Enable open, click, and reply tracking
- **UTM Parameters**: Add campaign tracking parameters
- **Scheduling**: Schedule emails for later
- **Batch Sending**: Send to large lists in batches
- **RSS Feeds**: Automatically send from RSS feeds

### Dynamic Content Blocks
- Create content variants based on contact properties
- Use filters to show different content to different segments
- Set default content for contacts that don't match filters

---

## ❓ Troubleshooting

### Email Builder Not Loading
- Refresh the page
- Check browser console for errors
- Try switching to HTML editor mode

### Validation Errors
- Review error messages in validation panel
- Fix blocking errors before sending
- Address warnings for better deliverability

### Draft Not Saving
- Check internet connection
- Verify you're logged in
- Try manual save (Ctrl+S)

### Test Email Not Received
- Check spam folder
- Verify recipient email address
- Check mailbox sending limits

---

## 📚 Additional Resources

- **API Documentation**: See `/api/emails` endpoints
- **Template Library**: Browse templates in template selector
- **Analytics**: View email performance in analytics dashboard

---

## 🆘 Support

For issues or questions:
1. Check this user guide
2. Review validation messages
3. Contact support team

---

**Last Updated**: 2025  
**Version**: 1.0

