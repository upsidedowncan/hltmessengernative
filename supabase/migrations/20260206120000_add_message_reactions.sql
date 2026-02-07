-- Migration: Add reactions to messages

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;
