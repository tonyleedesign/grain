-- Normalize evolving AI extraction data into a separate table.
-- boards stays the stable identity record; board_extractions stores user inputs
-- and extracted outputs over time.

CREATE TABLE IF NOT EXISTS board_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  medium text,
  use_case text,
  source_context text,
  appeal_context text,
  observations text,
  dna_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_extractions_board_id_idx
  ON board_extractions(board_id);

CREATE INDEX IF NOT EXISTS board_extractions_board_id_created_at_idx
  ON board_extractions(board_id, created_at DESC);

ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS latest_extraction_id uuid;

-- Backfill one extraction row from any legacy data still stored on boards.
WITH inserted AS (
  INSERT INTO board_extractions (
    board_id,
    medium,
    use_case,
    source_context,
    appeal_context,
    observations,
    dna_data
  )
  SELECT
    b.id,
    b.medium,
    b.use_case,
    b.source_context,
    b.appeal_context,
    b.observations,
    b.dna_data
  FROM boards b
  WHERE NOT EXISTS (
    SELECT 1
    FROM board_extractions be
    WHERE be.board_id = b.id
  )
    AND (
      b.medium IS NOT NULL OR
      b.use_case IS NOT NULL OR
      b.source_context IS NOT NULL OR
      b.appeal_context IS NOT NULL OR
      b.observations IS NOT NULL OR
      b.dna_data IS NOT NULL
    )
  RETURNING id, board_id
)
UPDATE boards b
SET latest_extraction_id = inserted.id
FROM inserted
WHERE b.id = inserted.board_id
  AND b.latest_extraction_id IS NULL;

-- Ensure latest_extraction_id points at the newest extraction row.
UPDATE boards b
SET latest_extraction_id = latest.id
FROM LATERAL (
  SELECT be.id
  FROM board_extractions be
  WHERE be.board_id = b.id
  ORDER BY be.created_at DESC
  LIMIT 1
) latest
WHERE b.latest_extraction_id IS DISTINCT FROM latest.id;
