CREATE TABLE IF NOT EXISTS captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source_channel text NOT NULL,
  source_type text NOT NULL,
  original_url text,
  canonical_url text,
  title text,
  site_name text,
  preview_image_url text,
  content_kind text NOT NULL DEFAULT 'bookmark',
  image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  storage_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT captures_source_channel_check CHECK (source_channel IN ('extension', 'telegram')),
  CONSTRAINT captures_source_type_check CHECK (source_type IN ('url', 'page_url', 'image_upload', 'direct_media_url')),
  CONSTRAINT captures_content_kind_check CHECK (content_kind IN ('bookmark', 'embed_candidate', 'image', 'video')),
  CONSTRAINT captures_status_check CHECK (status IN ('received', 'ready', 'applied', 'failed'))
);

CREATE INDEX IF NOT EXISTS captures_canvas_id_status_idx
  ON captures(canvas_id, status);

CREATE INDEX IF NOT EXISTS captures_user_id_created_at_idx
  ON captures(user_id, created_at DESC);
