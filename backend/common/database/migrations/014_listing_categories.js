export const name = '014_listing_categories'

export const up = `
  CREATE TABLE listing_categories (
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('service', 'product', 'hiring')),
    name VARCHAR(80) NOT NULL,
    PRIMARY KEY (kind, name)
  );

  INSERT INTO listing_categories (kind, name) VALUES
    ('service', 'Design & Creative'), ('service', 'Technology'), ('service', 'Writing'),
    ('service', 'Marketing'), ('service', 'Home Services'), ('service', 'Education'),
    ('product', 'Home & Living'), ('product', 'Electronics'), ('product', 'Fashion'),
    ('product', 'Beauty'), ('product', 'Accessories'), ('product', 'Other'),
    ('hiring', 'Design & Creative'), ('hiring', 'Development'), ('hiring', 'Writing'),
    ('hiring', 'Marketing'), ('hiring', 'Home Services'), ('hiring', 'Education');

  INSERT INTO listing_categories (kind, name)
    SELECT 'service', upper(left(category, 1)) || substring(category FROM 2) FROM services
    UNION SELECT 'product', upper(left(category, 1)) || substring(category FROM 2) FROM products
    UNION SELECT 'hiring', upper(left(category, 1)) || substring(category FROM 2) FROM hiring_requirements
    ON CONFLICT DO NOTHING;

  CREATE FUNCTION remember_listing_category() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE category_kind TEXT;
  BEGIN
    NEW.category := upper(left(trim(NEW.category), 1)) || substring(trim(NEW.category) FROM 2);
    category_kind := CASE TG_TABLE_NAME
      WHEN 'services' THEN 'service' WHEN 'products' THEN 'product' ELSE 'hiring' END;
    INSERT INTO listing_categories (kind, name) VALUES (category_kind, NEW.category)
      ON CONFLICT DO NOTHING;
    RETURN NEW;
  END $$;
  CREATE TRIGGER remember_service_category BEFORE INSERT OR UPDATE OF category ON services
    FOR EACH ROW EXECUTE FUNCTION remember_listing_category();
  CREATE TRIGGER remember_product_category BEFORE INSERT OR UPDATE OF category ON products
    FOR EACH ROW EXECUTE FUNCTION remember_listing_category();
  CREATE TRIGGER remember_hiring_category BEFORE INSERT OR UPDATE OF category ON hiring_requirements
    FOR EACH ROW EXECUTE FUNCTION remember_listing_category();

  UPDATE services SET category = category WHERE category <> upper(left(category, 1)) || substring(category FROM 2);
  UPDATE products SET category = category WHERE category <> upper(left(category, 1)) || substring(category FROM 2);
  UPDATE hiring_requirements SET category = category WHERE category <> upper(left(category, 1)) || substring(category FROM 2);
`
