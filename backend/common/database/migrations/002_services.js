export const name = '002_services'

export const up = `
  CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(80) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    original_price NUMERIC(12, 2) CHECK (original_price >= price),
    experience_years SMALLINT NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 60),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
    image_mime_type VARCHAR(30),
    image_file_name VARCHAR(180),
    image_content BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((image_content IS NULL AND image_mime_type IS NULL AND image_file_name IS NULL)
      OR (image_content IS NOT NULL AND image_mime_type IS NOT NULL AND image_file_name IS NOT NULL))
  );

  CREATE INDEX services_owner_updated_idx ON services(owner_user_id, updated_at DESC);
  CREATE TABLE service_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body VARCHAR(1000) NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (service_id, reviewer_user_id)
  );
  CREATE INDEX service_reviews_service_idx ON service_reviews(service_id, created_at DESC);
`
