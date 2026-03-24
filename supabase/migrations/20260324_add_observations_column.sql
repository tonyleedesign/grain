-- Two-pass DNA extraction: store Pass 1 observations for regeneration reuse.
-- Applied via Supabase MCP on 2026-03-24.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS observations text;
