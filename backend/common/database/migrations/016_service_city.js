export const name = '016_service_city'

export const up = `
  ALTER TABLE services ADD COLUMN city VARCHAR(80);
`
