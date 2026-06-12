CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    cover_url VARCHAR(512),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    chapter_num INT NOT NULL,
    section_num INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    dependencies UUID[] DEFAULT '{}',
    map_zone VARCHAR(100) DEFAULT 'default',
    map_pos_x INT NOT NULL DEFAULT 0,
    map_pos_y INT NOT NULL DEFAULT 0,
    word_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_source_chapter_section UNIQUE(source_id, chapter_num, section_num)
);

CREATE TABLE IF NOT EXISTS content_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    raw_text TEXT NOT NULL,
    clean_text TEXT NOT NULL,
    translation TEXT,
    audio_url VARCHAR(512),
    CONSTRAINT unique_chunk_sequence UNIQUE(chunk_id, sequence)
);

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

CREATE INDEX IF NOT EXISTS idx_chunks_source_id ON chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_content_nodes_chunk_sequence ON content_nodes(chunk_id, sequence);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_chunk ON user_progress(user_id, chunk_id);
