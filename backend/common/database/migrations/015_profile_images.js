export const name = '015_profile_images'

export const up = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_content BYTEA;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_mime_type VARCHAR(30);
`
