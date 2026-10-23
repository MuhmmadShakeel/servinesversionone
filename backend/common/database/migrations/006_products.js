export const name = '006_products'

export const up = `
  CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    category VARCHAR(80) NOT NULL,
    description VARCHAR(3000) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    original_price NUMERIC(12, 2) CHECK (original_price >= price),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 0 AND 999999),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
    bidding_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    bidding_started_at TIMESTAMPTZ,
    bidding_ends_at TIMESTAMPTZ,
    image_mime_type VARCHAR(30),
    image_file_name VARCHAR(180),
    image_content BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((image_content IS NULL AND image_mime_type IS NULL AND image_file_name IS NULL)
      OR (image_content IS NOT NULL AND image_mime_type IS NOT NULL AND image_file_name IS NOT NULL)),
    CHECK (status <> 'active' OR (image_content IS NOT NULL AND quantity > 0)),
    CONSTRAINT products_bidding_window_check CHECK (
      (NOT bidding_enabled AND bidding_started_at IS NULL AND bidding_ends_at IS NULL)
      OR (bidding_enabled AND bidding_started_at IS NOT NULL AND bidding_ends_at > bidding_started_at)
    )
  );
  CREATE INDEX products_owner_updated_idx ON products(owner_user_id, updated_at DESC);
  CREATE TABLE product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body VARCHAR(1000) NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, reviewer_user_id)
  );
  CREATE INDEX product_reviews_product_idx ON product_reviews(product_id, created_at DESC);
`
