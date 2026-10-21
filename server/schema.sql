CREATE TABLE IF NOT EXISTS inquiries (
 id uuid PRIMARY KEY, name varchar(120) NOT NULL, email varchar(254) NOT NULL,
 message text NOT NULL, status varchar(20) NOT NULL DEFAULT 'new'
 CHECK (status IN ('new','read','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_created_idx ON inquiries (created_at DESC);
CREATE TABLE IF NOT EXISTS content_entries (
 key varchar(100) NOT NULL, lang varchar(2) NOT NULL CHECK(lang IN ('ru','he','en')),
 value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(key,lang)
);
CREATE TABLE IF NOT EXISTS news_posts (
 id uuid PRIMARY KEY, slug varchar(140) NOT NULL UNIQUE,
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS news_translations (
 post_id uuid NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
 lang varchar(2) NOT NULL CHECK(lang IN ('ru','he','en')),
 title varchar(180) NOT NULL, body text NOT NULL, PRIMARY KEY(post_id,lang)
);

CREATE TABLE IF NOT EXISTS admin_users (
 id uuid PRIMARY KEY, username varchar(80) NOT NULL UNIQUE,
 password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Required by the current inquiry inbox and assignment routes. Keep this
-- idempotent so existing databases can apply the schema without losing records.
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES admin_users(id);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS priority varchar(10) NOT NULL DEFAULT 'normal'
 CHECK(priority IN ('low','normal','high','urgent'));
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS due_at timestamptz;
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_invites (
 token_hash char(64) PRIMARY KEY,
 email varchar(254) NOT NULL,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_invites_expiry_idx ON admin_invites(expires_at);

-- Client chat: per-inquiry bearer capability; never store the raw token.
CREATE TABLE IF NOT EXISTS inquiry_client_access (
 inquiry_id uuid PRIMARY KEY REFERENCES inquiries(id) ON DELETE CASCADE,
 token_hash char(64) NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inquiry_chat_messages (
 id uuid PRIMARY KEY,
 inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
 sender_kind varchar(16) NOT NULL CHECK(sender_kind IN ('client','employee')),
 sender_id uuid REFERENCES admin_users(id),
 message text NOT NULL CHECK(char_length(message) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiry_chat_history_idx ON inquiry_chat_messages(inquiry_id,created_at,id);

-- Admin opt-in browser push subscriptions; never store visitor identifiers.
CREATE TABLE IF NOT EXISTS visit_push_subscriptions (
 endpoint text PRIMARY KEY,
 p256dh text NOT NULL,
 auth text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
