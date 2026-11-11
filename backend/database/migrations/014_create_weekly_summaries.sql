-- 014_create_weekly_summaries.sql
-- One row per user and week once that week's summary was sent. The row is written in the
-- same transaction as the notification, so a summary is never sent twice (not after a
-- server restart, not when two runs overlap). week_start is the Monday of the week.

CREATE TABLE weekly_summaries (
  user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  week_start DATE        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, week_start)
);