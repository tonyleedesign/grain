ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS frame_shape_id text;

CREATE INDEX IF NOT EXISTS boards_canvas_id_frame_shape_id_idx
  ON boards(canvas_id, frame_shape_id);
