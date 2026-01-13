-- Email Verification Tokens Table
-- Stores tokens for email verification during signup

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_used_at ON email_verification_tokens(used_at);

-- RLS Policies
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (via API routes)
CREATE POLICY "Service role can manage verification tokens"
  ON email_verification_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_email_verification_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM email_verification_tokens
  WHERE expires_at < NOW()
     OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '24 hours');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_expired_email_verification_tokens() TO service_role;
