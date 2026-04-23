-- Add dna_version column to board_extractions.
-- null = legacy WebAppDNA/ImageGenDNA
-- 'design-md-v1' = new web DesignMD format
ALTER TABLE board_extractions ADD COLUMN IF NOT EXISTS dna_version text;
