-- Persist user intent fields so regeneration after refresh preserves them.
-- Applied via Supabase MCP on 2026-03-24.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS source_context text;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS appeal_context text;
