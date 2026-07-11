-- Kanban app schema
-- Run via: npm run migrate

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boards (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS board_members (
  board_id  INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(20) NOT NULL DEFAULT 'collaborator', -- 'owner' | 'collaborator'
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

CREATE TABLE IF NOT EXISTS columns (
  id         SERIAL PRIMARY KEY,
  board_id   INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
  id          SERIAL PRIMARY KEY,
  column_id   INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user_id ON board_members(user_id);
