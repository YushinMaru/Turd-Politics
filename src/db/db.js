const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './turd_politics.db';
const db = new Database(path.resolve(dbPath));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    -- Server configuration per guild
    CREATE TABLE IF NOT EXISTS servers (
      guild_id TEXT PRIMARY KEY,
      debates_channel_id TEXT,
      results_channel_id TEXT,
      modqueue_channel_id TEXT,
      auditlog_channel_id TEXT,
      vote_duration_hours INTEGER DEFAULT 48,
      max_topic_length INTEGER DEFAULT 200,
      auto_debate_interval_days INTEGER DEFAULT 0,
      auto_close_days INTEGER DEFAULT 0,
      last_bot_debate_at INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Debate topics
    CREATE TABLE IF NOT EXISTS debates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      thread_id TEXT,
      announce_message_id TEXT,
      status TEXT DEFAULT 'open',
      side_a_label TEXT DEFAULT 'For',
      side_b_label TEXT DEFAULT 'Against',
      is_bot_debate INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      voting_started_at INTEGER,
      closed_at INTEGER,
      FOREIGN KEY (guild_id) REFERENCES servers(guild_id)
    );

    -- Who participated in which debate and on which side
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      side TEXT DEFAULT 'neutral',
      joined_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(debate_id, user_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id)
    );

    -- Community votes on debate outcomes
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id INTEGER NOT NULL,
      voter_id TEXT NOT NULL,
      vote TEXT NOT NULL,
      voted_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(debate_id, voter_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id)
    );

    -- Tracks the vote poll message so we can edit it
    CREATE TABLE IF NOT EXISTS vote_messages (
      debate_id INTEGER PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      vote_closes_at INTEGER NOT NULL,
      FOREIGN KEY (debate_id) REFERENCES debates(id)
    );

    -- User reputation per guild
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      debates_participated INTEGER DEFAULT 0,
      topics_created INTEGER DEFAULT 0,
      UNIQUE(guild_id, user_id)
    );

    -- Debate bans
    CREATE TABLE IF NOT EXISTS bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      banned_by TEXT NOT NULL,
      reason TEXT,
      banned_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(guild_id, user_id)
    );

    -- /flip-flop accusations
    CREATE TABLE IF NOT EXISTS flip_flops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      accuser_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      debate_id INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- /bs calls
    CREATE TABLE IF NOT EXISTS bs_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      caller_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      debate_id INTEGER,
      countered INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Tournaments
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'signup',
      bracket_json TEXT DEFAULT '{}',
      current_round INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(guild_id, name)
    );

    -- Tournament participants
    CREATE TABLE IF NOT EXISTS tournament_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      eliminated INTEGER DEFAULT 0,
      UNIQUE(tournament_id, user_id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    );

    -- Debate DM subscriptions
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      UNIQUE(debate_id, user_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id)
    );

    -- Role config (maps role names to Discord role IDs per guild)
    CREATE TABLE IF NOT EXISTS roles_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      role_id TEXT NOT NULL,
      UNIQUE(guild_id, role_name)
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT,
      target_id TEXT,
      details TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // Migrations: add new columns to existing tables if they don't exist yet
  const migrations = [
    "ALTER TABLE servers ADD COLUMN auto_debate_interval_days INTEGER DEFAULT 0",
    "ALTER TABLE servers ADD COLUMN auto_close_days INTEGER DEFAULT 0",
    "ALTER TABLE servers ADD COLUMN last_bot_debate_at INTEGER DEFAULT 0",
    "ALTER TABLE debates ADD COLUMN is_bot_debate INTEGER DEFAULT 0",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch {} // Silently skip if column already exists
  }

  console.log('[DB] Database initialized successfully.');
}

module.exports = { db, initDB };
