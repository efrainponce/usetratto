-- Migration 010: settings support

-- Profile: job title for users
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;

-- Board member permission: restrict visibility to items owned by the member only
-- When restrict_to_own = true, the member only sees items where owner_id = their user_id
ALTER TABLE board_members ADD COLUMN IF NOT EXISTS restrict_to_own boolean NOT NULL DEFAULT false;
