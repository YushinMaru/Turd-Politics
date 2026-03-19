const { db } = require('../db/db');
const { VOTE, POINTS } = require('../utils/constants');
const { ensureUser, auditLog, closeDebate, getDebate } = require('./debateService');

/**
 * Cast a vote on a debate. Returns { ok, reason } where ok=false means already voted or banned.
 */
function castVote(debateId, voterId, voteChoice) {
  const existing = db.prepare('SELECT 1 FROM votes WHERE debate_id = ? AND voter_id = ?').get(debateId, voterId);
  if (existing) return { ok: false, reason: 'You have already voted on this debate.' };

  if (![VOTE.SIDE_A, VOTE.SIDE_B, VOTE.DRAW].includes(voteChoice)) {
    return { ok: false, reason: 'Invalid vote choice.' };
  }

  db.prepare('INSERT INTO votes (debate_id, voter_id, vote) VALUES (?, ?, ?)').run(debateId, voterId, voteChoice);
  return { ok: true };
}

/**
 * Get vote tally for a debate.
 */
function getTally(debateId) {
  const rows = db.prepare('SELECT vote, COUNT(*) as count FROM votes WHERE debate_id = ? GROUP BY vote').all(debateId);
  const tally = { side_a: 0, side_b: 0, draw: 0 };
  for (const row of rows) {
    tally[row.vote] = row.count;
  }
  return tally;
}

/**
 * Determine winner from tally. Returns 'side_a', 'side_b', 'draw', or 'no_votes'.
 */
function determineWinner(tally) {
  const { side_a, side_b, draw } = tally;
  const total = side_a + side_b + draw;
  if (total === 0) return 'no_votes';
  if (draw > side_a && draw > side_b) return 'draw';
  if (side_a > side_b) return 'side_a';
  if (side_b > side_a) return 'side_b';
  return 'draw'; // tie between sides
}

/**
 * Save the vote poll message info so we can edit it later.
 */
function saveVoteMessage(debateId, channelId, messageId, voteClosesAt) {
  db.prepare(`
    INSERT OR REPLACE INTO vote_messages (debate_id, channel_id, message_id, vote_closes_at)
    VALUES (?, ?, ?, ?)
  `).run(debateId, channelId, messageId, voteClosesAt);
}

/**
 * Get vote message info for a debate.
 */
function getVoteMessage(debateId) {
  return db.prepare('SELECT * FROM vote_messages WHERE debate_id = ?').get(debateId) || null;
}

/**
 * Get all open vote messages (for scheduler restart recovery).
 */
function getAllOpenVoteMessages() {
  return db.prepare(`
    SELECT vm.*, d.guild_id, d.topic, d.side_a_label, d.side_b_label
    FROM vote_messages vm
    JOIN debates d ON d.id = vm.debate_id
    WHERE d.status = 'voting'
  `).all();
}

/**
 * Award points to winners after a vote closes.
 * Winners = all participants on the winning side.
 */
function awardWinnerPoints(debate, winnerSide) {
  if (winnerSide === 'no_votes' || winnerSide === 'draw') return;

  const sideLabel = winnerSide === 'side_a' ? 'for' : 'against';
  const winners = db.prepare(`
    SELECT user_id FROM participants WHERE debate_id = ? AND (side = ? OR side = 'neutral')
  `).all(debate.id, sideLabel);

  for (const winner of winners) {
    ensureUser(debate.guild_id, winner.user_id);
    db.prepare('UPDATE users SET points = points + ?, wins = wins + 1 WHERE guild_id = ? AND user_id = ?')
      .run(POINTS.WIN_DEBATE, debate.guild_id, winner.user_id);
  }

  // Award losses to other side
  const loserSideLabel = sideLabel === 'for' ? 'against' : 'for';
  const losers = db.prepare(`
    SELECT user_id FROM participants WHERE debate_id = ? AND side = ?
  `).all(debate.id, loserSideLabel);

  for (const loser of losers) {
    db.prepare('UPDATE users SET losses = losses + 1 WHERE guild_id = ? AND user_id = ?')
      .run(debate.guild_id, loser.user_id);
  }

  auditLog(debate.guild_id, 'debate_winner_awarded', null, null, `Debate #${debate.id} — winner: ${winnerSide}`);
}

/**
 * Send DM notifications to all subscribers of a debate.
 */
async function notifySubscribers(client, debateId, message) {
  const subs = db.prepare('SELECT user_id FROM subscriptions WHERE debate_id = ?').all(debateId);
  for (const sub of subs) {
    try {
      const user = await client.users.fetch(sub.user_id);
      await user.send(message);
    } catch {
      // User has DMs closed or blocked the bot — skip silently
    }
  }
}

module.exports = {
  castVote,
  getTally,
  determineWinner,
  saveVoteMessage,
  getVoteMessage,
  getAllOpenVoteMessages,
  awardWinnerPoints,
  notifySubscribers,
};
