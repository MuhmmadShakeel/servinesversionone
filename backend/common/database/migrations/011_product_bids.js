export const name = '011_product_bids'

export const up = `
  CREATE TABLE product_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    bidder_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX product_bids_product_amount_idx ON product_bids(product_id, amount DESC, created_at DESC);
  CREATE INDEX product_bids_bidder_idx ON product_bids(bidder_user_id, created_at DESC);
`
