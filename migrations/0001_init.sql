CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('visitor', 'agent')),
  content TEXT NOT NULL,
  discord_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_visitor_created
  ON messages (visitor_id, created_at);
