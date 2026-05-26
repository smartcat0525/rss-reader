CREATE TABLE IF NOT EXISTS feeds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT    NOT NULL UNIQUE,
  title      TEXT    DEFAULT '',
  site_url   TEXT    DEFAULT '',
  last_poll  DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id       INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid          TEXT,
  title         TEXT,
  link          TEXT,
  content       TEXT,
  snippet       TEXT,
  author        TEXT,
  published_at  DATETIME,
  fetched_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  poll_batch_id TEXT,
  bookmarked    INTEGER DEFAULT 0,
  bookmarked_at DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_unique ON articles(feed_id, guid) WHERE guid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_unique_no_guid ON articles(feed_id, link) WHERE guid IS NULL;

CREATE TABLE IF NOT EXISTS filter_rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  enabled    INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS filter_conditions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id     INTEGER NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
  field       TEXT    NOT NULL,
  operator    TEXT    NOT NULL,
  value       TEXT    NOT NULL,
  logical_op  TEXT    DEFAULT 'AND'
);

CREATE TABLE IF NOT EXISTS filter_feed_rules (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
  feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  UNIQUE(rule_id, feed_id)
);
