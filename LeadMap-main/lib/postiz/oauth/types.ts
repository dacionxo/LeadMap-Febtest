/**
 * OAuth Types and Interfaces for Postiz Social Media Integration
 * Based on Postiz's social.integrations.interface.ts
 */

export interface AuthTokenDetails {
  id: string; // External account ID from the provider
  name: string;
  error?: string;
  accessToken: string; // The obtained access token
  refreshToken?: string; // The refresh token, if applicable
  expiresIn?: number; // The duration in seconds for which the access token is valid
  picture?: string;
  username: string;
  additionalSettings?: {
    title: string;
    description: string;
    type: 'checkbox' | 'text' | 'textarea';
    value: any;
    regex?: string;
  }[];
}

export interface GenerateAuthUrlResponse {
  url: string;
  codeVerifier: string;
  state: string;
}

export interface OAuthAuthenticateParams {
  code: string;
  codeVerifier: string;
  refresh?: string;
}

export interface ClientInformation {
  client_id: string;
  client_secret: string;
  instanceUrl?: string;
}

/**
 * Base interface for OAuth authentication
 */
export interface IOAuthProvider {
  /**
   * Generate the OAuth authorization URL for the provider
   */
  generateAuthUrl(clientInformation?: ClientInformation): Promise<GenerateAuthUrlResponse>;

  /**
   * Authenticate using the OAuth callback code
   */
  authenticate(
    params: OAuthAuthenticateParams,
    clientInformation?: ClientInformation
  ): Promise<AuthTokenDetails | string>;

  /**
   * Refresh an expired access token
   */
  refreshToken(refreshToken: string): Promise<AuthTokenDetails>;

  /**
   * Re-connect/re-authenticate an existing account
   */
  reConnect?(
    id: string,
    requiredId: string,
    accessToken: string
  ): Promise<Omit<AuthTokenDetails, 'refreshToken' | 'expiresIn'>>;
}

/**
 * Provider identifier constants
 */
export enum SocialProviderIdentifier {
  X = 'x',
  TWITTER = 'twitter', // Alias for X
  INSTAGRAM = 'instagram',
  INSTAGRAM_STANDALONE = 'instagram-standalone',
  LINKEDIN = 'linkedin',
  LINKEDIN_PAGE = 'linkedin-page',
  FACEBOOK = 'facebook',
  TIKTOK = 'tiktok',
  YOUTUBE = 'youtube',
  THREADS = 'threads',
  PINTEREST = 'pinterest',
}

// Type for provider identifier strings
export type ProviderIdentifier = string

/**
 * OAuth state data stored temporarily during OAuth flow
 */
export interface OAuthState {
  workspaceId: string;
  userId: string;
  provider: string;
  codeVerifier: string;
  state: string;
  redirectUri?: string;
  expiresAt: Date;
}

/**
 * OAuth callback result
 */
export interface OAuthCallbackResult {
  success: boolean;
  error?: string;
  socialAccountId?: string;
  authDetails?: AuthTokenDetails;
}
