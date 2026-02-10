CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_type   TEXT DEFAULT 'prisoners_dilemma',
  player1_id  TEXT REFERENCES users(id),
  player2_id  TEXT REFERENCES users(id),
  p1_score    INTEGER,
  p2_score    INTEGER,
  winner_id   TEXT,
  played_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS friends (
  user_id    TEXT REFERENCES users(id),
  friend_id  TEXT REFERENCES users(id),
  status     TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id)
);
