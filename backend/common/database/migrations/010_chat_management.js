export const name = '010_chat_management'

export const up = `
  ALTER TABLE chat_messages ADD COLUMN edited_at TIMESTAMPTZ;
  ALTER TABLE chat_conversations ADD COLUMN requester_cleared_at TIMESTAMPTZ;
  ALTER TABLE chat_conversations ADD COLUMN owner_cleared_at TIMESTAMPTZ;
`
