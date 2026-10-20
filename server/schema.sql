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
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
