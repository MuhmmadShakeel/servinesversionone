export const name = '012_listing_voice'

export const up = `
  ALTER TABLE products ADD COLUMN voice_file VARCHAR(80), ADD COLUMN voice_mime_type VARCHAR(30), ADD COLUMN voice_duration_seconds NUMERIC(5, 2);
  ALTER TABLE services ADD COLUMN voice_file VARCHAR(80), ADD COLUMN voice_mime_type VARCHAR(30), ADD COLUMN voice_duration_seconds NUMERIC(5, 2);
  ALTER TABLE hiring_requirements ADD COLUMN voice_file VARCHAR(80), ADD COLUMN voice_mime_type VARCHAR(30), ADD COLUMN voice_duration_seconds NUMERIC(5, 2);
  ALTER TABLE products ADD CONSTRAINT products_voice_complete CHECK ((voice_file IS NULL AND voice_mime_type IS NULL AND voice_duration_seconds IS NULL) OR (voice_file IS NOT NULL AND voice_mime_type IS NOT NULL AND voice_duration_seconds > 0 AND voice_duration_seconds <= 60));
  ALTER TABLE services ADD CONSTRAINT services_voice_complete CHECK ((voice_file IS NULL AND voice_mime_type IS NULL AND voice_duration_seconds IS NULL) OR (voice_file IS NOT NULL AND voice_mime_type IS NOT NULL AND voice_duration_seconds > 0 AND voice_duration_seconds <= 60));
  ALTER TABLE hiring_requirements ADD CONSTRAINT hiring_voice_complete CHECK ((voice_file IS NULL AND voice_mime_type IS NULL AND voice_duration_seconds IS NULL) OR (voice_file IS NOT NULL AND voice_mime_type IS NOT NULL AND voice_duration_seconds > 0 AND voice_duration_seconds <= 60));
`
