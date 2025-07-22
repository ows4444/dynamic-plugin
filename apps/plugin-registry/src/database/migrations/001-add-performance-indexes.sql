-- Migration: Add performance indexes for plugin queries
-- This migration adds optimized indexes to improve query performance

BEGIN;

-- Create composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_status_category_rating 
ON plugins(status, category, rating DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_status_downloads 
ON plugins(status, download_count DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_status_published 
ON plugins(status, published_at DESC NULLS LAST);

-- Create GIN index for tags array queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_tags_gin 
ON plugins USING GIN(tags);

-- Create full-text search index for name and description
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_fulltext 
ON plugins USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Create index for author searches within status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_author_status 
ON plugins(author, status) WHERE author IS NOT NULL;

-- Create partial index for published plugins (most common queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_published_performance 
ON plugins(category, rating DESC, download_count DESC) 
WHERE status = 'published';

-- Create index for version queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_name_version_status 
ON plugins(name, version, status);

-- Add constraint index for better unique enforcement
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_name_version_unique 
ON plugins(name, version);

-- Create index for rating queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_rating_performance 
ON plugins(rating DESC, rating_count DESC) 
WHERE rating_count > 0 AND status = 'published';

-- Create index for download statistics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_download_stats 
ON plugins(download_count DESC, updated_at DESC) 
WHERE status = 'published';

-- Create index for recent plugins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_recent 
ON plugins(published_at DESC NULLS LAST) 
WHERE status = 'published' AND published_at IS NOT NULL;

-- Create index for plugin health checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plugins_health_check 
ON plugins(status, updated_at) 
WHERE status IN ('uploaded', 'validating', 'validated');

-- Statistics update for better query planning
ANALYZE plugins;

COMMIT;