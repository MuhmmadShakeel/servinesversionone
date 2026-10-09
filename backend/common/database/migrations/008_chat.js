export const name = '008_chat'

export const up = `
  CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_type VARCHAR(20) NOT NULL CHECK (listing_type IN ('service', 'hiring', 'product')),
    listing_id UUID NOT NULL,
    listing_title VARCHAR(160) NOT NULL,
    requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (requester_user_id <> owner_user_id),
    UNIQUE (listing_type, listing_id, requester_user_id)
  );
  CREATE INDEX chat_conversations_requester_idx ON chat_conversations(requester_user_id, updated_at DESC);
  CREATE INDEX chat_conversations_owner_idx ON chat_conversations(owner_user_id, updated_at DESC);

  CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body VARCHAR(2000) NOT NULL CHECK (length(btrim(body)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX chat_messages_conversation_idx ON chat_messages(conversation_id, created_at DESC, id DESC);
`
