-- AI Spaces: Community visualizations table
CREATE TABLE IF NOT EXISTS visualization_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    preview_url TEXT,
    html_content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Spaces: Likes table for tracking user likes
CREATE TABLE IF NOT EXISTS visualization_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visualization_id UUID NOT NULL REFERENCES visualization_spaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(visualization_id, user_id)
);

-- AI Spaces: Views tracking for analytics
CREATE TABLE IF NOT EXISTS visualization_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visualization_id UUID NOT NULL REFERENCES visualization_spaces(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visualization_spaces_user_id ON visualization_spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_visualization_spaces_created_at ON visualization_spaces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visualization_spaces_tags ON visualization_spaces USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_visualization_spaces_likes_count ON visualization_spaces(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_visualization_likes_visualization_id ON visualization_likes(visualization_id);
CREATE INDEX IF NOT EXISTS idx_visualization_likes_user_id ON visualization_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_visualization_views_visualization_id ON visualization_views(visualization_id);

-- Enable RLS on all spaces tables
ALTER TABLE visualization_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualization_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visualization_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for visualization_spaces
CREATE POLICY "Public visualizations are viewable by everyone" ON visualization_spaces
    FOR SELECT
    USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can create own visualizations" ON visualization_spaces
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visualizations" ON visualization_spaces
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own visualizations" ON visualization_spaces
    FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for visualization_likes
CREATE POLICY "Users can view likes on public visualizations" ON visualization_likes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM visualization_spaces 
            WHERE visualization_spaces.id = visualization_likes.visualization_id 
            AND (visualization_spaces.is_public = TRUE OR visualization_spaces.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can like/unlike visualizations" ON visualization_likes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies for visualization_views
CREATE POLICY "Users can view analytics on own visualizations" ON visualization_views
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM visualization_spaces 
            WHERE visualization_spaces.id = visualization_views.visualization_id 
            AND visualization_spaces.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can record views on public visualizations" ON visualization_views
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM visualization_spaces 
            WHERE visualization_spaces.id = visualization_views.visualization_id 
            AND visualization_spaces.is_public = TRUE
        )
    );

-- Function to increment likes count
CREATE OR REPLACE FUNCTION increment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE visualization_spaces 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.visualization_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement likes count
CREATE OR REPLACE FUNCTION decrement_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE visualization_spaces 
    SET likes_count = GREATEST(likes_count - 1, 0) 
    WHERE id = OLD.visualization_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment views count
CREATE OR REPLACE FUNCTION increment_views_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE visualization_spaces 
    SET views_count = views_count + 1 
    WHERE id = NEW.visualization_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for likes count
CREATE TRIGGER increment_likes_trigger
    AFTER INSERT ON visualization_likes
    FOR EACH ROW
    EXECUTE FUNCTION increment_likes_count();

CREATE TRIGGER decrement_likes_trigger
    AFTER DELETE ON visualization_likes
    FOR EACH ROW
    EXECUTE FUNCTION decrement_likes_count();

-- Triggers for views count
CREATE TRIGGER increment_views_trigger
    AFTER INSERT ON visualization_views
    FOR EACH ROW
    EXECUTE FUNCTION increment_views_count();

-- Trigger for updated_at on visualization_spaces
CREATE TRIGGER update_visualization_spaces_updated_at
    BEFORE UPDATE ON visualization_spaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get trending visualizations
CREATE OR REPLACE FUNCTION get_trending_visualizations(limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    title TEXT,
    description TEXT,
    preview_url TEXT,
    tags TEXT[],
    likes_count INTEGER,
    views_count INTEGER,
    created_at TIMESTAMPTZ,
    author_username TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.id,
        vs.user_id,
        vs.title,
        vs.description,
        vs.preview_url,
        vs.tags,
        vs.likes_count,
        vs.views_count,
        vs.created_at,
        p.username as author_username
    FROM visualization_spaces vs
    LEFT JOIN profiles p ON p.id = vs.user_id
    WHERE vs.is_public = TRUE
    ORDER BY vs.likes_count DESC, vs.views_count DESC, vs.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get visualizations by tag
CREATE OR REPLACE FUNCTION get_visualizations_by_tag(search_tag TEXT, limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    title TEXT,
    description TEXT,
    preview_url TEXT,
    tags TEXT[],
    likes_count INTEGER,
    views_count INTEGER,
    created_at TIMESTAMPTZ,
    author_username TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.id,
        vs.user_id,
        vs.title,
        vs.description,
        vs.preview_url,
        vs.tags,
        vs.likes_count,
        vs.views_count,
        vs.created_at,
        p.username as author_username
    FROM visualization_spaces vs
    LEFT JOIN profiles p ON p.id = vs.user_id
    WHERE vs.is_public = TRUE
    AND search_tag = ANY(vs.tags)
    ORDER BY vs.likes_count DESC, vs.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user liked a visualization
CREATE OR REPLACE FUNCTION has_user_liked_visualization(viz_id UUID, usr_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM visualization_likes 
        WHERE visualization_id = viz_id 
        AND user_id = usr_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_trending_visualizations(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_visualizations_by_tag(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_liked_visualization(UUID, UUID) TO authenticated;

-- Grant execute to anon for public viewing
GRANT EXECUTE ON FUNCTION get_trending_visualizations(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_visualizations_by_tag(TEXT, INTEGER) TO anon;
