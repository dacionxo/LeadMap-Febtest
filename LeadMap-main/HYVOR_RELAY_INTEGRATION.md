# Hyvor Relay Integration Guide

> **Hyvor Relay** is an open-source email API for developers, serving as a self-hosted alternative to services like AWS SES, Mailgun, and SendGrid. This guide explains how to integrate Hyvor Relay into LeadMap's email system.

## Overview

**Hyvor Relay** ([GitHub](https://github.com/hyvor/relay)) is a self-hosted email API that provides:
- REST API for sending emails
- Webhook support for tracking
- Self-hosted solution (full control over your email infrastructure)
- Open-source (AGPL-3.0 license)
- PHP-based backend

## Why Use Hyvor Relay?

- **Self-Hosted**: Full control over your email infrastructure
- **Open Source**: Transparent codebase, can be audited and customized
- **Privacy-First**: Your email data stays on your servers
- **Cost-Effective**: No per-email pricing, only infrastructure costs
- **Alternative to Commercial APIs**: Drop-in replacement for SES, Mailgun, SendGrid

## Integration Options

### Option 1: Add as a Provider (Recommended for Future Implementation)

Hyvor Relay can be integrated as an email provider in LeadMap's email system. This would allow users to use their self-hosted Hyvor Relay instance as a transactional email provider.

**Implementation Steps:**
1. Install Hyvor Relay on your server (see [Installation](#installation))
2. Add `hyvor-relay` to the provider types
3. Create a provider implementation file
4. Add configuration to environment variables
5. Update provider selection logic

### Option 2: Use as SMTP Backend (Current Implementation)

Since Hyvor Relay provides an SMTP interface, you can use it with LeadMap's existing SMTP provider configuration:

1. Configure Hyvor Relay to accept SMTP connections
2. Use LeadMap's existing SMTP mailbox/provider configuration
3. Point SMTP settings to your Hyvor Relay instance

### Option 3: Documentation Reference (Current Status)

Hyvor Relay is now documented in `EMAIL_RESOURCES.md` as a reference for developers who want to use self-hosted email solutions.

## Installation

> **Note**: These instructions install and self-host the external Hyvor Relay PHP/Laravel service (not LeadMap). Hyvor Relay is written in PHP/Laravel and runs as a separate service. Once deployed, LeadMap (Node.js/TypeScript) communicates with it via REST API.

### Prerequisites

- PHP 8.1 or higher
- MySQL/MariaDB database
- SMTP server (for sending emails)
- Composer (PHP dependency manager)

### Quick Start

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/hyvor/relay.git
   cd relay
   ```

2. **Install Dependencies**:
   ```bash
   composer install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database and SMTP settings
   ```

4. **Set Up Database**:
   ```bash
   php artisan migrate
   ```

5. **Start the Server**:
   ```bash
   php artisan serve
   ```

For detailed installation instructions, see the [Hyvor Relay GitHub repository](https://github.com/hyvor/relay).

## API Integration

### Basic Email Sending

Hyvor Relay provides a REST API for sending emails:

```bash
POST https://your-relay-instance.com/api/v1/send
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "to": "recipient@example.com",
  "subject": "Test Email",
  "html": "<h1>Hello from Hyvor Relay!</h1>",
  "from": "sender@yourdomain.com"
}
```

### API Endpoints

- `POST /api/v1/send` - Send email
- `GET /api/v1/stats` - Get sending statistics
- `GET /api/v1/webhooks` - Manage webhooks
- `POST /api/v1/webhooks` - Create webhook

For complete API documentation, refer to the [Hyvor Relay documentation](https://github.com/hyvor/relay).

## Integration with LeadMap

### Current Status

Hyvor Relay is documented as a reference option in `EMAIL_RESOURCES.md`. To fully integrate it as a provider:

### Future Implementation Steps

1. **Add Provider Type**:
   ```typescript
   // lib/email/types.ts
   export type EmailProviderType = 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'smtp' | 'generic' | 'hyvor-relay'
   ```

2. **Create Provider Implementation**:
   ```typescript
   // lib/email/providers/hyvor-relay.ts
   export async function hyvorRelaySend(
     config: ProviderConfig,
     payload: EmailPayload
   ): Promise<SendResult> {
     // Implementation using Hyvor Relay API
   }
   ```

3. **Add Environment Variables**:
   ```env
   HYVOR_RELAY_API_URL=https://your-relay-instance.com
   HYVOR_RELAY_API_KEY=your_api_key
   HYVOR_RELAY_FROM_EMAIL=noreply@yourdomain.com
   ```

4. **Update Provider Selection**:
   ```typescript
   // lib/email/providers/index.ts
   if (process.env.HYVOR_RELAY_API_KEY) return 'hyvor-relay'
   ```

## Configuration

### Environment Variables

```env
# Hyvor Relay Configuration
HYVOR_RELAY_API_URL=https://relay.yourdomain.com
HYVOR_RELAY_API_KEY=your_api_key_here
HYVOR_RELAY_FROM_EMAIL=noreply@yourdomain.com
HYVOR_RELAY_FROM_NAME=Your Company Name
```

### Provider Configuration

If implementing as a provider, you'll need to configure it in the `email_provider_credentials` table:

```sql
INSERT INTO email_provider_credentials (
  user_id,
  provider_type,
  provider_name,
  api_key_encrypted,
  from_email,
  active
) VALUES (
  'user-uuid',
  'hyvor-relay',
  'My Hyvor Relay Instance',
  'encrypted_api_key',
  'noreply@yourdomain.com',
  true
);
```

## Benefits of Self-Hosted Email

1. **Data Privacy**: All email data stays on your servers
2. **Cost Control**: No per-email fees, only infrastructure costs
3. **Customization**: Full control over email delivery logic
4. **Compliance**: Easier to meet data residency requirements
5. **No Vendor Lock-in**: Own your email infrastructure

## Comparison with Other Providers

| Feature | Hyvor Relay | Resend | SendGrid | AWS SES |
|---------|------------|--------|----------|---------|
| Self-Hosted | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Open Source | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Pricing | Infrastructure only | Per-email | Per-email | Per-email |
| Setup Complexity | Medium | Low | Low | Medium |
| Control | Full | Limited | Limited | Limited |

## Resources

- **GitHub Repository**: https://github.com/hyvor/relay
- **Documentation**: See the repository's README and docs
- **License**: AGPL-3.0
- **Language**: PHP
- **Related Projects**:
  - [Hyvor Post](https://github.com/hyvor/post) - Newsletter platform built on Hyvor Relay
  - [Hyvor Unfold](https://github.com/hyvor/unfold) - Link previews and embeds

## Security Considerations

When self-hosting Hyvor Relay:

1. **Keep it Updated**: Regularly update to latest version
2. **Secure API Keys**: Use strong, unique API keys
3. **HTTPS Only**: Always use HTTPS for API endpoints
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Monitoring**: Set up monitoring and alerting
6. **Backup**: Regular backups of database and configuration

## Support

- **GitHub Issues**: https://github.com/hyvor/relay/issues
- **Community**: Check the repository for community discussions
- **Documentation**: Refer to the repository's documentation

## License

Hyvor Relay is licensed under AGPL-3.0. Please review the license terms before use, especially if you plan to modify or distribute the software.

---

**Note**: This integration guide is a reference document. Full implementation as a provider option in LeadMap's email system would require additional development work. For now, Hyvor Relay can be used as an SMTP backend or referenced as a self-hosted email solution option.

