export const name = '009_listing_shares'

export const up = `
  ALTER TABLE services ADD COLUMN share_count INTEGER NOT NULL DEFAULT 0 CHECK (share_count >= 0);
  ALTER TABLE hiring_requirements ADD COLUMN share_count INTEGER NOT NULL DEFAULT 0 CHECK (share_count >= 0);
  ALTER TABLE products ADD COLUMN share_count INTEGER NOT NULL DEFAULT 0 CHECK (share_count >= 0);
`
