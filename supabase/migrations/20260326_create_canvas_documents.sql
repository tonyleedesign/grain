-- Persist tldraw canvas documents in Supabase instead of browser-local storage.

CREATE TABLE IF NOT EXISTS canvas_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  document_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canvas_id)
);

CREATE INDEX IF NOT EXISTS canvas_documents_canvas_id_idx
  ON canvas_documents(canvas_id);
