CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255),
    display_name VARCHAR(255),
    password_hash TEXT,
    provider VARCHAR(100),
    provider_user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_identity ON users(provider, provider_user_id)
    WHERE provider IS NOT NULL AND provider_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(120),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    cover_url VARCHAR(512),
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    sort_order INT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE sources ADD COLUMN IF NOT EXISTS slug VARCHAR(120);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_slug_unique ON sources(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sources_type_active ON sources(type, is_active);
CREATE INDEX IF NOT EXISTS idx_sources_status_order ON sources(status, sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    chapter_num INT NOT NULL,
    section_num INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    dependencies UUID[] DEFAULT '{}',
    map_zone VARCHAR(100) DEFAULT 'default',
    map_pos_x INT NOT NULL DEFAULT 0,
    map_pos_y INT NOT NULL DEFAULT 0,
    word_count INT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_source_chapter_section UNIQUE(source_id, chapter_num, section_num)
);

ALTER TABLE chunks ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS content_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    raw_text TEXT NOT NULL,
    clean_text TEXT NOT NULL,
    translation TEXT,
    audio_url VARCHAR(512),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_chunk_sequence UNIQUE(chunk_id, sequence)
);

ALTER TABLE content_nodes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE content_nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE content_nodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    highest_wpm FLOAT DEFAULT 0.0,
    highest_accuracy FLOAT DEFAULT 0.0,
    stars_earned INT DEFAULT 0,
    last_node_sequence INT DEFAULT 1,
    is_completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_chunk UNIQUE(user_id, chunk_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_progress_user_id_fkey'
    ) THEN
        ALTER TABLE user_progress
            ADD CONSTRAINT user_progress_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chunks_source_id ON chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_source_section ON chunks(source_id, chapter_num, section_num);
CREATE INDEX IF NOT EXISTS idx_content_nodes_chunk_sequence ON content_nodes(chunk_id, sequence);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_chunk ON user_progress(user_id, chunk_id);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
