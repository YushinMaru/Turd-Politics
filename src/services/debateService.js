const { db } = require('../db/db');
const { STATUS, POINTS } = require('../utils/constants');

/**
 * Create a new debate topic in the DB.
 */
function createDebate(guildId, topic, creatorId, sideALabel = 'For', sideBLabel = 'Against') {
  const stmt = db.prepare(`
    INSERT INTO debates (guild_id, topic, creator_id, status, side_a_label, side_b_label)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(guildId, topic, creatorId, STATUS.OPEN, sideALabel, sideBLabel);
  const debate = db.prepare('SELECT * FROM debates WHERE id = ?').get(result.lastInsertRowid);

  // Award points to creator and track topic count
  ensureUser(guildId, creatorId);
  db.prepare('UPDATE users SET points = points + ?, topics_created = topics_created + 1 WHERE guild_id = ? AND user_id = ?')
    .run(POINTS.CREATE_TOPIC, guildId, creatorId);

  auditLog(guildId, 'debate_created', creatorId, null, `Debate #${debate.id}: ${topic}`);
  return debate;
}

/**
 * Update debate with its Discord thread ID and announce message ID after creation.
 */
function setDebateThread(debateId, threadId, announceMessageId) {
  db.prepare('UPDATE debates SET thread_id = ?, announce_message_id = ? WHERE id = ?')
    .run(threadId, announceMessageId, debateId);
}

/**
 * Look up an active debate by its Discord thread ID.
 */
function getDebateByThreadId(threadId) {
  return db.prepare(`
    SELECT * FROM debates WHERE thread_id = ? AND status IN ('open', 'voting')
  `).get(threadId) || null;
}

/**
 * Get a single debate by ID (and optionally enforce guild).
 */
function getDebate(debateId, guildId = null) {
  if (guildId) {
    return db.prepare('SELECT * FROM debates WHERE id = ? AND guild_id = ?').get(debateId, guildId) || null;
  }
  return db.prepare('SELECT * FROM debates WHERE id = ?').get(debateId) || null;
}

/**
 * List debates by status for a guild.
 */
function listDebates(guildId, statuses = [STATUS.OPEN, STATUS.VOTING]) {
  const placeholders = statuses.map(() => '?').join(', ');
  return db.prepare(`SELECT * FROM debates WHERE guild_id = ? AND status IN (${placeholders}) ORDER BY created_at DESC`)
    .all(guildId, ...statuses);
}

/**
 * Change a debate's status to 'voting'. Returns updated debate.
 */
function openVoting(debateId, guildId, modId) {
  db.prepare(`UPDATE debates SET status = ?, voting_started_at = unixepoch() WHERE id = ? AND guild_id = ?`)
    .run(STATUS.VOTING, debateId, guildId);
  auditLog(guildId, 'debate_opened_voting', modId, null, `Debate #${debateId}`);
  return getDebate(debateId);
}

/**
 * Close a debate (mark as closed, set closed_at).
 */
function closeDebate(debateId, guildId, actorId) {
  db.prepare(`UPDATE debates SET status = ?, closed_at = unixepoch() WHERE id = ? AND guild_id = ?`)
    .run(STATUS.CLOSED, debateId, guildId);
  auditLog(guildId, 'debate_closed', actorId, null, `Debate #${debateId}`);
  return getDebate(debateId);
}

/**
 * Archive a debate.
 */
function archiveDebate(debateId, guildId, modId) {
  db.prepare(`UPDATE debates SET status = ? WHERE id = ? AND guild_id = ?`)
    .run(STATUS.ARCHIVED, debateId, guildId);
  auditLog(guildId, 'debate_archived', modId, null, `Debate #${debateId}`);
}

/**
 * Delete a debate from the DB.
 */
function deleteDebate(debateId, guildId, modId) {
  const debate = getDebate(debateId, guildId);
  if (!debate) return null;
  db.prepare('DELETE FROM debates WHERE id = ? AND guild_id = ?').run(debateId, guildId);
  auditLog(guildId, 'debate_deleted', modId, null, `Debate #${debateId}: ${debate.topic}`);
  return debate;
}

/**
 * Register a user as a participant in a debate.
 * Returns true if newly added, false if already registered.
 */
function addParticipant(debateId, userId, side = 'neutral') {
  const debate = getDebate(debateId);
  if (!debate) return false;

  const existing = db.prepare('SELECT 1 FROM participants WHERE debate_id = ? AND user_id = ?').get(debateId, userId);
  if (existing) return false;

  db.prepare('INSERT INTO participants (debate_id, user_id, side) VALUES (?, ?, ?)').run(debateId, userId, side);

  // Award participation points
  ensureUser(debate.guild_id, userId);
  db.prepare('UPDATE users SET points = points + ?, debates_participated = debates_participated + 1 WHERE guild_id = ? AND user_id = ?')
    .run(POINTS.PARTICIPATE, debate.guild_id, userId);

  return true;
}

/**
 * Get all participants for a debate.
 */
function getParticipants(debateId) {
  return db.prepare('SELECT * FROM participants WHERE debate_id = ?').all(debateId);
}

/**
 * Flag a debate for mod review.
 */
function flagDebate(debateId, guildId, reporterId) {
  auditLog(guildId, 'debate_flagged', reporterId, null, `Debate #${debateId} flagged for review`);
}

/**
 * Ensure a user row exists in the users table.
 */
function ensureUser(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO users (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
}

/**
 * Write an audit log entry.
 */
function auditLog(guildId, action, actorId, targetId, details) {
  db.prepare('INSERT INTO audit_log (guild_id, action, actor_id, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(guildId, action, actorId || null, targetId || null, details || null);
}

module.exports = {
  createDebate,
  setDebateThread,
  getDebate,
  getDebateByThreadId,
  listDebates,
  openVoting,
  closeDebate,
  archiveDebate,
  deleteDebate,
  addParticipant,
  getParticipants,
  flagDebate,
  ensureUser,
  auditLog,
};
