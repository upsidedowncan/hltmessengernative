-- Migration: Add notification categories table for action buttons
-- Run after existing migrations

-- Table for notification categories (defines action buttons)
CREATE TABLE IF NOT EXISTS notification_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id TEXT NOT NULL,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category_id)
);

-- Enable RLS
ALTER TABLE notification_categories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own notification categories" ON notification_categories
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_notification_categories_user_id ON notification_categories(user_id);

-- Common category definitions (for reference):
-- 'call_incoming' → [accept, decline, busy]
-- 'chat_message' → [reply, mark_read]
-- 'friend_request' → [accept, decline]
-- 'missed_call' → [callback, message]
