-- Migration: Fix push_subscriptions table for upsert support
-- Run after 20240108120000_create_push_subscriptions.sql

-- Create unique index on the token expression for upsert support
-- This enables ON CONFLICT to work properly with subscription->>'token'
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_token ON push_subscriptions((subscription->>'token'));

-- Create index on user_id for fast lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Add updated_at column for tracking token refreshes
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

-- Add platform column at top level for easier querying
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS platform text;

-- Backfill platform from subscription JSON if empty
UPDATE push_subscriptions
SET platform = subscription->>'platform'
WHERE platform IS NULL AND subscription->>'platform' IS NOT NULL;

-- Add service_role policy for Edge Functions to manage all subscriptions
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON push_subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- Create a function to refresh push token
CREATE OR REPLACE FUNCTION refresh_push_token(
  p_user_id uuid,
  p_token text,
  p_platform text
) RETURNS void AS $$
BEGIN
  INSERT INTO push_subscriptions (user_id, subscription, platform, updated_at)
  VALUES (p_user_id, jsonb_build_object('token', p_token, 'platform', p_platform), p_platform, NOW())
  ON CONFLICT ((subscription->>'token'))
  DO UPDATE SET
    subscription = EXCLUDED.subscription,
    platform = EXCLUDED.platform,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_push_token(uuid, text, text) TO authenticated;
