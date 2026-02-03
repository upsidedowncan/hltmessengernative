-- Fix security tables to allow NULL for fields not available in ipinfo.io Lite API
-- ipinfo.io Lite only returns: ip, asn, as_name, as_domain, country_code, country, continent_code, continent

-- Drop existing tables and recreate with nullable fields
DROP TABLE IF EXISTS user_trusted_locations CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS account_lockouts CASCADE;
DROP TABLE IF EXISTS user_security_settings CASCADE;

-- Security System: User trusted locations table
CREATE TABLE IF NOT EXISTS user_trusted_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    region TEXT,
    country TEXT,
    country_code TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    trust_score DECIMAL(3,2) DEFAULT 1.00,
    login_count INTEGER DEFAULT 1,
    first_login_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ip_address)
);

-- Security System: Login attempts table for AI training
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    region TEXT,
    country TEXT,
    country_code TEXT,
    device_fingerprint TEXT,
    user_agent TEXT,
    trusted_location BOOLEAN DEFAULT FALSE,
    distance_km DECIMAL(10,2),
    anomaly_score DECIMAL(5,2),
    ai_reasoning TEXT,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security System: Account lockouts table
CREATE TABLE IF NOT EXISTS account_lockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    triggered_by VARCHAR(50) DEFAULT 'system',
    anomaly_score DECIMAL(5,2),
    ip_address INET,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, expires_at)
);

-- Security System: User security preferences
CREATE TABLE IF NOT EXISTS user_security_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    location_tracking_enabled BOOLEAN DEFAULT TRUE,
    max_trusted_locations INTEGER DEFAULT 5,
    lockout_duration_hours INTEGER DEFAULT 24,
    anomaly_threshold DECIMAL(3,2) DEFAULT 0.75,
    require_2fa_on_new_device BOOLEAN DEFAULT FALSE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_trusted_locations_user_id ON user_trusted_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trusted_locations_login_count ON user_trusted_locations(login_count DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_user_id ON account_lockouts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_expires_at ON account_lockouts(expires_at);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_at ON account_lockouts(locked_at DESC);

-- Enable RLS on all security tables
ALTER TABLE user_trusted_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own trusted locations" ON user_trusted_locations
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own login attempts" ON login_attempts
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view own lockouts" ON account_lockouts
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own security settings" ON user_security_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_trusted_locations_updated_at
    BEFORE UPDATE ON user_trusted_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_security_settings_updated_at
    BEFORE UPDATE ON user_security_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired lockouts (can be called via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_lockouts()
RETURNS void AS $$
BEGIN
    UPDATE account_lockouts
    SET released_at = NOW()
    WHERE released_at IS NULL
    AND expires_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active lockout for user
CREATE OR REPLACE FUNCTION get_active_lockout(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    reason TEXT,
    expires_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT al.id, al.reason, al.expires_at, al.locked_at
    FROM account_lockouts al
    WHERE al.user_id = p_user_id
    AND al.released_at IS NULL
    AND al.expires_at > NOW()
    ORDER BY al.locked_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's login statistics
CREATE OR REPLACE FUNCTION get_user_login_stats(p_user_id UUID)
RETURNS TABLE (
    total_attempts BIGINT,
    successful_attempts BIGINT,
    failed_attempts BIGINT,
    trusted_locations_count INTEGER,
    unique_countries TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_attempts,
        COUNT(*) FILTER (WHERE success)::BIGINT AS successful_attempts,
        COUNT(*) FILTER (WHERE NOT success)::BIGINT AS failed_attempts,
        (SELECT COUNT(*) FROM user_trusted_locations WHERE user_id = p_user_id)::INTEGER,
        ARRAY(
            SELECT DISTINCT country 
            FROM user_trusted_locations 
            WHERE user_id = p_user_id 
            AND country IS NOT NULL
        ) AS unique_countries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_expired_lockouts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_lockout(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_login_stats(UUID) TO authenticated;
