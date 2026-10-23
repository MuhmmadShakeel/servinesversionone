export const name = '013_chat_read_receipts'

export const up = `
  ALTER TABLE chat_conversations ADD COLUMN requester_read_at TIMESTAMPTZ;
  ALTER TABLE chat_conversations ADD COLUMN owner_read_at TIMESTAMPTZ;
`
