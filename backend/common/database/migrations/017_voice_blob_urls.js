export const name = '017_voice_blob_urls'

export const up = `
  ALTER TABLE products ALTER COLUMN voice_file TYPE TEXT;
  ALTER TABLE services ALTER COLUMN voice_file TYPE TEXT;
  ALTER TABLE hiring_requirements ALTER COLUMN voice_file TYPE TEXT;
`
