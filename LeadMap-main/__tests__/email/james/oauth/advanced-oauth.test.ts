/**
 * Advanced OAuth Tests
 * 
 * Comprehensive tests for advanced OAuth/OIDC utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { OIDCTokenValidator, createOIDCTokenValidator } from '@/lib/email/james/oauth/advanced-oauth'

describe('OIDC Token Validator', () => {
  let validator: OIDCTokenValidator

  beforeEach(() => {
    validator = createOIDCTokenValidator({
      clientId: 'test-client',
      claim: 'email',
    })
  })

  describe('validateToken', () => {
    it('should reject invalid JWT format', async () => {
      const result = await validator.validateToken('invalid-token')
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject expired tokens', async () => {
      // Create expired token (simplified - would need proper JWT library)
      const expiredPayload = {
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
        email: 'test@example.com',
      }
      const expiredToken = `header.${Buffer.from(JSON.stringify(expiredPayload)).toString('base64')}.signature`

      const result = await validator.validateToken(expiredToken)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('expired')
    })

    it('should extract email from valid token', async () => {
      const validPayload = {
        exp: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
        iat: Math.floor(Date.now() / 1000),
        email: 'test@example.com',
        sub: 'user-123',
      }
      const validToken = `header.${Buffer.from(JSON.stringify(validPayload)).toString('base64')}.signature`

      const result = await validator.validateToken(validToken)
      // Note: Without actual signature verification, this will still validate structure
      expect(result.email).toBe('test@example.com')
      expect(result.userId).toBe('user-123')
    })
  })
})

